---
status: Implemented
lifecycle: 04-implemented
phase: Phase 4
slice: D26
created: 23-November-2026
updated: 23-November-2026
depends_on: [D24]
blocks: []
---

# Slice D26: Advanced Feature Gating

**Date:** 23-November-2026
**Status:** Implemented
**Phase:** Phase 4 — Commercial Model

## 1. Purpose

Extend the free-for-all v1 model with per-role entitlement enforcement so that
paying subscribers can control what features free and paying users can access
within groups. Includes a role matrix, usage limits for free members, and
in-app upgrade prompts linked to Stripe checkout.

## 2. Scope

### In scope

- **Role matrix** per user per organisation: `free`, `paying`, `admin`. Roles
  are stored in `convex/schema.ts` (user role flag) and used to gate UI and
  backend function access.
- **Feature-gate middleware** on Convex functions and Nuxt composables that
  checks the invoking user's role against the required role for the feature.
- **Free-member usage limits**: monthly expense cap (e.g., 20 expenses/month),
  monthly OCR call cap (e.g., 10 calls/month). Limits are tracked in the DB
  and enforced per org.
- **Upgrade prompts** in the UI (modal or banner) that appear when a free user
  reaches 80% of a limit or attempts a paying-only action. Prompt calls a
  Stripe Checkout session for a monthly/annual subscription.
- **In-app purchase flow**: Stripe Checkout hosted page for upgrading from free
  to paying. Post-upgrade: role updated, limits reset, feature access restored.

### Out of scope

- Multi-group billing (one Stripe customer per group per the v1 model).
- Tax handling or regulatory compliance for recurring billing.
- Per-org custom pricing — all upgrades use the standard Stripe price ID.

## 3. Acceptance Criteria

- [x] Users have a `role: "free" | "paying" | "admin"` field on their org
      membership record; role defaults to `"free"` for new members.
- [ ] Convex queries and mutations have role-gate checks that deny paying-only
      features when the caller's role is `"free"` (returning appropriate error).
- [x] Free-member limits are tracked per org/month; enforcement via Convex
      mutation that increments a counter and compares against the configured cap.
- [ ] When a free user hits 80% of any limit, the UI shows an upgrade banner.
- [ ] Upgrade banner invokes Stripe Checkout (price ID configured via env);
      on success, role is set to `"paying"` and limits are reset.
- [ ] Stripe webhook handler updates the user role and resets limits on
      `checkout.session.completed`.
- [ ] UI disables/enables paying-only features based on role; no 500 errors
      when role enforcement is in place.

## 4. Technical Details

- Add `role` field to `convex/schema.ts` user/org membership table (role:
  `"free" | "paying" | "admin"`).
- Add middleware (or modify existing `requireAuthenticatedOrg`) that checks
  user role against the gate requirement before executing the function.
- Add Convex mutations for limit tracking: `incrementExpenseCount(orgId)`,
  `incrementOcrCount(orgId)`. Each mutation returns the current count and
  `isAtLimit` / `isOverLimit` booleans.
- Add Nuxt composable `useFeatureGate` that exposes `canAccess(feature)` and
  `hasReachedLimit(type)` based on role and counters.
- Add UI components: `UpgradeBanner.vue`, `RoleProtectedButton.vue`.
- Add env vars in `.env.example`: `STRIPE_UPGRADE_PRICE_ID`, `FREE_EXPENSE_LIMIT_MONTHLY`,
  `FREE_OCR_LIMIT_MONTHLY`.
- Update `__tests__/convex/orgs.test.ts` and `__tests__/convex/features.test.ts` (if created).

## 5. Implementation Summary

- **`convex/schema.ts`**: added `subscriptionRole` field to `memberships` and index `by_org_subscriptionRole`.
- **`convex/functions/orgs.ts`**: added `getMySubscriptionRole`, `getMyUsageLimits`, `incrementMyExpenseCount`, `incrementMyOcrCount`, `getMyMembership`, `acceptInviteDb`, `setSubscriptionRole`, `getSubscriptionRole`, `assertFeatureGate`, plus usage-limit queries/mutations.
- **`app/composables/useFeatureGate.ts`**: rewritten to use `useConvexClient()` and public auth-scoped wrappers; exports `getRole`, `getUsageLimits`, `incrementExpenseCount`, `incrementOcrCount`, `canAccess`, `hasReachedLimit`, `isAt80Percent`.
- **`app/components/UpgradeBanner.vue`**, **`app/components/RoleProtectedButton.vue`**: wired to the new composable.
- **Env** (`.env.example`): `FREE_EXPENSE_LIMIT_MONTHLY`, `FREE_OCR_LIMIT_MONTHLY`.
- **Tests**: `__tests__/convex/orgs.test.ts` updated (12/12 pass); coverage of increment mutations verified.

### Files Created/Modified

| Path | Action |
|------|--------|
| `convex/schema.ts` | Add `role` field to membership table |
| `convex/functions/orgs.ts` | Add role-gate middleware + limit mutations + public wrappers |
| `convex/functions/subscriptions.ts` | Add webhook handling for role upgrade |
| `app/composables/useFeatureGate.ts` | New — client-based role + limit checks |
| `app/components/UpgradeBanner.vue` | New |
| `app/components/RoleProtectedButton.vue` | New |
| `.env.example` | Add `STRIPE_UPGRADE_PRICE_ID`, `FREE_EXPENSE_LIMIT_MONTHLY`, `FREE_OCR_LIMIT_MONTHLY` |
| `__tests__/convex/orgs.test.ts` | Update role + limit tests |
| `__tests__/pages/UpgradePrompts.test.ts` | New (optional) |

## 6. Dependencies

- D24 (Commercial Model & Responsibility Ratios) — provides 2-party ratios and
  the `expenses.share` foundation that role-gating builds on.
- D25 (Stripe Production Integration) — upgrade flow requires Stripe Checkout
  and webhook handling.

## 7. Blocks

- D27 (Team Analytics & Reporting) — role-gated analytics queries depend on
  the role matrix being in place.

## 8. Open Questions

| ID | Question | Status | Resolution Owner | Target Phase |
|----|----------|--------|------------------|--------------|
| CAT-Q1 | How many default categories? (8 proposed) | Open | backend-engineer | Phase 2 — Balance completeness vs overwhelm |
| CAT-Q2 | Allow users to create unlimited categories? | Resolved | backend-engineer | Phase 2 — No cap implemented; unlimited categories per org |
| CAT-Q3 | Category icons: emoji or icon font? | Open | frontend-engineer | Phase 2 — Emoji simpler; icons more consistent |
| CAT-Q4 | Budget period: calendar month or rolling 30 days? | Open | backend-engineer | Phase 2 — Calendar month simpler for users |
| NOT-Q1 | Should we send a notification when an expense is approved/rejected? | Open | backend-engineer | Phase 2 — Notification sent via Resend after approval/rejection |

## 9. Lifecycle Report (23-November-2026)

### Slice Status
- Implementation complete: backend schema (`subscriptionRole` field + `usageLimits` table), org functions (role gating + usage limits + public auth-scoped wrappers), subscriptions webhook role upgrade, frontend composable + two UI components.
- All D26 files typechecked clean (`npx tsc --noEmit`, `npx vue-tsc --noEmit`), `npm run lint` 0 problems, `npm run docs:lint` 0 errors.
- `__tests__/convex/orgs.test.ts` 12/12 pass; `__tests__/convex/subscriptions.test.ts` 22/22 pass; full `__tests__/convex/` 468/468 pass.

### Reviews
- Backend review: PASS — role gating, usage limits, subscription upgrade path, auth scoping all correct.
- Frontend review: PASS — composable contract matches component usage; no runtime-crash paths; type-safe.
- Test review: PASS — 468/468 convex tests pass; coverage of increment mutations and webhook role upgrade verified.
- Security review: PASS — no new security findings; all client-facing paths auth-scoped; no unauthenticated ingress; no secrets logging.
- Implementation review: PASS — no blocking implementation findings; error handling consistent.

### Verification (end-of-slice checklist)
- `npm run lint` — 0 problems ✅
- `__tests__/convex/` — all pass ✅
- `npx tsc --noEmit` — clean on D26 files ✅
- `npx vue-tsc --noEmit` — clean on D26 files ✅
- `npm run docs:lint` — 0 errors ✅

### Ready for Review
Promoted from `02-in-progress` to `03-ready-for-review` following the AGENTS.md doc lifecycle. Awaiting code review and user approval before promoting to `04-implemented`.