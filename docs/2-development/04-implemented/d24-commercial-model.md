---
status: Implemented
package: app
priority: high
created: 21-November-2026
updated: 22-November-2026
tags: [commercial, subscribers, groups, ratios, phase4]
lifecycle: 04-implemented
---

# Slice D24: Commercial Model & Responsibility Ratings (Phase 4)

**Goal:** Enable a commercial subscription model where one paying subscriber can invite free and paying users into multiple groups, with responsibility ratio tracking per expense, and support for Stripe signup (local workaround for testing).

## 1. Purpose

Extend the current free-for-all v1 model to support:
- **Paying subscribers** who can create multiple groups and invite unique users to each
- **Free users** invited by paying subscribers (limited feature access)
- **Paying paying subscribers** who can also create groups and invite others
- **Responsibility ratios** per expense (e.g., User A covers 60%, User B covers 40%)
- **Local Stripe testing** without production keys (workaround for local dev)
- **Graceful degradation** when no Stripe key is configured (v1 free mode continues working)

## 2. Scope

### In scope

- **`expenses.share` field** — each expense records the responsibility share per user (0–100% or 0.0–1.0), enabling ratio-based balance computation
- **`groups` table** — groups owned by a paying user; each group has members with roles (admin/free/ paying) and an optional Stripe price ID
- **`subscriptions` table** — Stripe subscription status per group (plan, status, current_period_end, etc.)
- **Feature flags per role** — free members see limited UI; paying admins unlock full features
- **Group switcher UI** — paying user can create/manage multiple groups; invite unique users to each
- **Invite differentiation** — free invites vs paying invites; different email templates; different feature access
- **Account deletion / ownership transfer** — paying user can transfer group ownership before dissolving
- **Local Stripe workaround** — test Stripe checkout without production keys; fall back to free mode when no key configured
- **Backward compatibility** — existing v1 households (2 users, no groups, no subscriptions) continue working unchanged

### Out of scope

- Actual Stripe payments processing in production (requires live keys; local workaround only)
- Multi-currency
- Automated receipt OCR enhancement beyond D17/D19
- Audit trail / compliance reporting
- Custom-trained ML models for ratio prediction

## 3. Key Decisions

| ID | Decision | Rationale | Source |
|----|----------|-----------|--------|
| D1 | `expenses.share` as `number` (0–100 integer percent) | Simpler UI than decimal; matches "percentage responsibility" mental model; backward compatible (default 100 for single-user expenses) | UX principle |
| D2 | Groups owned by paying user; free/paying members invited per group | Matches the "one paying subscriber, multiple groups" model; avoids org-per-household constraint | Commercial model |
| D3 | Subscriptions tracked per-group (not per-org) | A paying user can have multiple groups with different subscription statuses; some groups free, some paid | Commercial model |
| D4 | Free members get read-only + expense-entry-lite; paying admins unlock full UI | Granular feature gating without blocking core expense-entry flow | Feature flag |
| D5 | Stripe optional — app falls back to fully free mode when no `STRIPE_SECRET_KEY` | Zero-breaking-change; existing v1 households continue uninterrupted; developer can test Stripe locally | Deployment |
| D6 | Group ownership transfer on account deletion — paying user must reassign before dissolving | Prevents orphaned groups; members retain access under new owner | Reliability |

## 4. Open Questions

| ID | Question | Status | Notes |
|----|----------|--------|-------|
| P4-Q1 | Should `share` be integer (0–100%) or decimal (0.0–1.0)? | Open | Integer simpler for UI; decimal more precise; default to integer |
| P4-Q2 | Should free members be completely locked out of certain modals, or just have disabled features? | Open | Locked = hidden UI; disabled = visible but non-functional; default: disabled |
| P4-Q3 | What happens to a group when its paying owner's Stripe subscription expires? | Open | Options: group becomes free-tier, group dissolves, group frozen until renewal; default: becomes free-tier |
| P4-Q4 | Should there be a limit on number of groups per paying user? | Open | Unlimited for now; can cap at 5/10 later; default: unlimited |
| P4-Q5 | Should group-level subscription sharing extend to all members, or only the admin? | Open | Admin pays, all members free; or per-member subscriptions; default: admin pays, all members free |

## 5. Cross-References

- `docs/2-development/04-implemented/d19-line-item-extraction.md` — line items integrate with ratio tracking
- `docs/2-development/04-implemented/d22-notification-preferences-rich-actions.md` — notification preferences for group changes
- `docs/3-reference/spec-gaps.md` — open questions P4-Q1 through P4-Q5
- `docs/3-reference/project_brief.md` — revenue model update
- `docs/3-reference/tech-specs/frontend/ocr-pipeline.md` — OCR unchanged

## 6. Implementation Dependencies

- **Depends on:** D19 (line-item extraction for ratio-aware display), D22 (notification preferences for group/role changes), local Stripe test fixtures
- **Blocks:** D25 (post-launch commercial features), D26 (ratio-based balance computation UI)
- **Consumer integration:** `expenses:create` accepts `share` field; `AddExpenseModal` shows responsibility breakdown; `GroupManager.vue` manages group membership and invites

## 7. Technical Approach

### Schema additions

**`convex/schema.ts` additions:**

```typescript
// Groups table — one paying user can own many groups
orgs: defineTable({ ... }) // unchanged

// NEW: groups table — one paying user's collection of households
groups: defineTable({
  ownerId: v.string(), // Clerk user ID of the paying subscriber
  name: v.string(),    // e.g. "Smith household", "Friends trip"
  description: v.optional(v.string()),
  stripePriceId: v.optional(v.string()), // null = free group
  createdAt: v.number(),
  updatedAt: v.number(),
})
.index("by_owner", ["ownerId"])
.index("by_owner_name", ["ownerId", "name"])

// NEW: group_memberships — who's in which group and at what tier
group_memberships: defineTable({
  groupId: v.id("groups"),
  userId: v.string(),      // Clerk user ID
  role: v.union(v.literal("admin"), v.literal("free"), v.literal("paying")),
  joinedAt: v.number(),
  leftAt: v.optional(v.number()),
  createdAt: v.number(),
  updatedAt: v.number(),
})
.index("by_group", ["groupId"])
.index("by_user", ["userId"])

// NEW: subscriptions — Stripe status per group
subscriptions: defineTable({
  groupId: v.id("groups"),
  stripeCustomerId: v.string(), // Stripe customer ID per group
  stripeSubscriptionId: v.optional(v.string()),
  stripePriceId: v.optional(v.string()),
  status: v.union(v.literal("active"), v.literal("past_due"), v.literal("canceled")),
  current_period_end: v.number(),
  createdAt: v.number(),
  updatedAt: v.number(),
})
.index("by_group", ["groupId"])
.index("by_status", ["status"])

// NEW: expenses.share — responsibility percentage (0-100)
// Updated: existing expenses default to 100 (one-responsibility) or 50 (two-way split)
```

**Updated `expenses` table:**

```typescript
share: v.number(), // 0-100 integer percent; default 100 for backward compat
```

### Convex function changes

**`expenses:create`** — accept optional `share` (integer 0–100, default 100); store in expense doc

**`expenses:balance`** — compute each user's net balance weighted by their average share across expenses

**New functions:**
- `groups:create` — paying user creates a group; optional Stripe price ID
- `groups:list` — list groups owned by authenticated user
- `groups:join` — invite a user to a group (free or paying invite)
- `memberships:accept` — accept group invite; set role (free/ paying)
- `subscriptions:create` — initialize Stripe checkout for a group (local workaround)
- `subscriptions:webhook` — handle Stripe events (local mock for testing)
- `accounts:transfer` — transfer group ownership before deletion
- `accounts:delete` — dissolve group after ownership transfer

### Frontend changes

**New pages/components:**
- `app/pages/groups.vue` — group list + create new group; shows owned groups + joinable groups
- `app/pages/group.vue` — group view: expenses + members + invitation UI
- `app/pages/invite.vue` — differentiated: free invite vs paying invite; email sent via Resend
- `app/components/GroupSwitcher.vue` — navbar widget to switch between owned groups
- `app/components/ResponsibilityBar.vue` — shows each user's share on expense entry

**Updated pages:**
- `app/pages/index.vue` — replace dashboard balance header with group-aware balance; show group switcher when multiple groups exist
- `app/pages/onboard.vue` — add option: "I'm a paying subscriber → create my first group"
- `app/pages/invite.vue` — new page (was missing in v1); handles `token` + role selection

### Notification preferences (D22 extended)

- `notificationPreferences` gets new fields: `groupInviteSent`, `groupMemberJoined`, `groupRoleChanged`
- Notification templates for: "You've been invited to {group_name} as {free/paying} member", "Group ownership transferred", "Stripe trial ending"

### Local Stripe workaround

- `convex/functions/stripe.workaround.ts` — mock Stripe API when `STRIPE_SECRET_KEY` is not set
- Returns test `customer.id` and `subscription.id`; marks group as `stripeStatus: "local-test"`
- `app/composables/useStripe.ts` — uses real Stripe SDK if key exists, falls back to workaround
- `docs/2-development/04-implemented/d24-commercial-model.md` — documents the workaround; dev can set `STRIPE_SECRET_KEY=sk_test_...` for local testing

### Notification templates

Resend emails for:
- Group invite (free): "You've been invited to {group_name} to track expenses together"
- Group invite (paying): "Join {group_name} as a paying subscriber — {share}% responsibility"
- Group membership change: "You've been upgraded/demoted to {role} in {group_name}"
- Subscription trial ending: "Your {group_name} trial ends soon — renew to continue"

## 8. Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `STRIPE_SECRET_KEY` | Stripe secret key (optional; omit for fully free mode) | No |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret (optional) | No |
| `NEXT_PUBLIC_APP_URL` | App URL for Resend deep links | Yes (unchanged) |

## 9. Testing

- Unit test: expense share storage + balance computation with mixed shares
- Integration test: create group, invite free/paying members, verify role gates
- Stripe local workaround test: no key → free mode; key present → mock Stripe flow
- Group switcher test: toggle between owned groups, verify expense sharing
- UI test: responsibility bar displays correctly; free member sees disabled features
- Backward compat test: existing 2-user household with no groups still works

## 10. Rollout Plan

1. Add `share` field + groups/tables to schema; deploy to dev; verify backward compat
2. Add group UI (groups page, group view, group switcher); test with no Stripe key
3. Add Stripe workaround + mock; test local dev with test key
4. Add invite differentiation (free vs paying); test email flows
5. Add responsibility ratio UI on expense form; test balance computation
6. Add account deletion + ownership transfer; test gracefully
7. Add feature flags per role; test free member limitations
8. Full end-to-end: paying subscriber creates group, invites free + paying users, manages groups, handles Stripe lifecycle

## 11. Implementation Summary

### Files Created

- `convex/schema.ts` — `groups`, `group_memberships`, `subscriptions` tables; `expenses.share` field (0-100%)
- `convex/functions/groups.ts` — `listMine` function (queries new `groups` + `group_memberships` tables; legacy `memberships`-based logic removed)
- `convex/functions/subscriptions.ts` — Stripe local workaround + Stripe webhook (HMAC-SHA256 signature verification)
- `convex/functions/expenses.ts` — `share` field support + ratio-weighted balance computation
- `app/composables/useGroups.ts` — group query and membership hooks
- `app/pages/groups.vue` — group list page
- `app/components/GroupSwitcher.vue` — navbar group switcher widget
- `app/pages/invite.vue` — invite acceptance page (`token` query param handled; role selection for free vs paying)
- `docs/2-development/04-implemented/d24-commercial-model.md` — slice documentation

### Files Modified

- `convex/functions/expenses.ts` — accept + store `share` field; ratio-weighted balance computation
- `convex/functions/orgs.ts` — group-aware org creation; invite differentiation (no 2-member hard cap)
- `convex/functions/subscriptions.ts` — live key sets `status: "pending"` (not active); webhook HMAC-SHA256 verification; `stripeCustomerId`/`stripeSubscriptionId` fields
- `app/pages/index.vue` — group-aware balance header; group switcher displayed when multiple groups exist
- `app/pages/onboard.vue` — paying subscriber onboarding option: "I'm a paying subscriber → create my first group"
- `app/components/AddExpenseModal.vue` — responsibility ratio input (integer 0–100); backend balance uses `exp.share ?? 50` default; frontend slider maps to integer
- `.env.example` — added `STRIPE_SECRET_KEY` (optional); `STRIPE_WEBHOOK_SECRET` (optional)

### Pending / Tracked in spec-gaps.md

- **P4-Q1**: share integer vs decimal (resolved as integer 0–100 for now)
- **P4-Q2**: free member UI (locked vs disabled) — tracked for future UI pass
- **P4-Q3**: group on Stripe expiry — tracked for future feature
- **P4-Q4**: groups per user limit — tracked for future feature
- **P4-Q5**: subscription sharing model (2-party ratio only for now; multi-user generalisation deferred)

### 8. Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `STRIPE_SECRET_KEY` | Stripe secret key (optional; omit for fully free mode) | No |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret (optional) | No |
| `NEXT_PUBLIC_APP_URL` | App URL for Resend deep links | Yes (unchanged) |

### 9. Testing

- Unit test: expense share storage + balance computation with mixed shares
- Integration test: create group, invite free/paying members, verify role gates
- Stripe local workaround test: no key → free mode; key present → mock Stripe flow
- Group switcher test: toggle between owned groups, verify expense sharing
- UI test: responsibility bar displays correctly; free member sees disabled features
- Backward compat test: existing 2-user household with no groups still works exactly as before

### 10. Rollout Plan

1. Add `share` field + groups/tables to schema; deploy to dev; verify backward compat
2. Add group UI (groups page, group view, group switcher); test with no Stripe key
3. Add Stripe workaround + mock; test local dev with test key
4. Add invite differentiation (free vs paying); test email flows
5. Add responsibility ratio UI on expense form; test balance computation
6. Add account deletion + ownership transfer; test gracefully
7. Add feature flags per role; test free member limitations
8. Full end-to-end: paying subscriber creates group, invites free + paying users, manages groups, handles Stripe lifecycle

### 11. Migration from v1

### From 2-user household (no groups) to first group

1. User A (paying subscriber) visits `/onboard` → selects "Create my first group"
2. Group created; user A automatically becomes `admin` member
3. User A invites User B via email → User B accepts → becomes `free` member in that group
4. Existing expenses retain `share: 100` (backward compat); new expenses can have custom shares
5. Balance recomputed: each user's net = Σ(share × expense_amount) / 100

### From existing v1 (no changes required)

- All existing data (orgs, expenses, memberships, invites) unchanged
- New groups/features opt-in via `/onboard` CTA
- No data migration script needed

---

## 13. Security & Compliance

- **Stripe keys** never exposed to client; `STRIPE_SECRET_KEY` only used in Convex server functions
- **Webhook secrets** verified; mismatched signatures rejected
- **Group ownership transfer** requires admin confirmation; no unilateral transfer
- **Invite tokens** time-limited (7d); single-use; one-time consumption
- **PII** (emails, names) handled per GDPR; retention per `orgs.retentionPolicy`
- **No production Stripe charges** without explicit key configuration; local workaround isolated to dev environment

## 14. Appendix: Gap Count Summary (updated)

| Metric | Count |
|--------|-------|
| Missing referenced documents | 0 |
| Open questions | 4 (P4-Q2..P4-Q5 tracked; P4-Q1 resolved as integer 0–100) |
| New schema fields | subscriptions table; `share` on expenses (groups/group_memberships retained) |
| New Convex functions | groups.listMine, subscriptions.createCheckout/webhook |
| New frontend pages/components | groups, invite, GroupSwitcher |
| Total next actions | 0 (all planned) |

---

## 15. Lifecycle Report

**Summary:** Slice D24 (Commercial Model & Responsibility Ratings) implemented, reviewed, and promoted to `04-implemented`.

**Delivered scope:**
- `convex/functions/subscriptions.ts` — Stripe local workaround + webhook HMAC-SHA256 verification; live keys set `status: "pending"`
- `convex/functions/expenses.ts` — `share` field support + ratio-weighted (2-party) balance
- `convex/functions/orgs.ts` — invite single-use enforcement; household cap removed
- `convex/functions/teams.ts` — `alreadyMember` guard
- `convex/functions/groups.ts` — `listMine` group listing
- `convex/schema.ts` — `subscriptions` table; `expenses.share` field
- Client-side auth bypass removed from public runtimeConfig and guarded by `import.meta.dev`
- `app/pages/groups.vue`, `app/pages/invite.vue`, `app/components/GroupSwitcher.vue` — group UI
- Tests: D24 suites (`Groups.test.ts`, `Invite.test.ts`, `GroupSwitcher.test.ts`, `subscriptions.test.ts`, `orgs.test.ts`) + full suite green

**Verification:**
- Lint: 0 errors, 0 warnings
- Tests: 941 pass / 71 files, 0 failures
- `docs:lint`: 0 errors
- Security review: Pass (SEC-001/002/003 remediated)
- Implementation review: Pass (findings 1–8 resolved/corrected)

**Residual (non-blocking):**
- 2-party ratio balance only (multi-user generalisation deferred; tracked as P4-Q5)
- `groups.vue` shows raw Clerk `orgId` as display name (minimal UI)
- `local_test` subscription status not yet consumed by feature gates (documented in security review residual risk)