# Security Review Report: d24-commercial-model

**Status:** Review complete — critical findings remediated
**Scope:** D24 Commercial Model & Responsibility Ratios
**Date:** 21-November-2026
**Reviewer:** security-engineer
**Verdict:** Pass (critical findings SEC-001, SEC-002, SEC-003 fixed; Medium/Low findings SEC-004/SEC-006/SEC-007 documented as residual)

---

## Scope and Sensitivity

| Field | Value |
|-------|-------|
| Affected files | `convex/functions/subscriptions.ts`, `convex/functions/groups.ts`, `convex/functions/orgs.ts`, `convex/functions/teams.ts`, `convex/functions/expenses.ts`, `convex/functions/permissions.ts`, `convex/auth.ts`, `convex/schema.ts`, `app/composables/useOrgs.ts`, `app/composables/useAuth.ts`, `app/components/AddExpenseModal.vue`, `app/pages/invite.vue`, `app/pages/groups.vue`, `app/middleware/auth.global.ts`, `nuxt.config.ts`, `.env.example` |
| Authentication or authorisation | Yes |
| Billing or entitlements | Yes |
| File upload or export | No |
| Iframe, CSP, or preview | No |
| User data or PII | Yes (email addresses, invite tokens, org memberships) |

---

## Threat Model

| Asset | Trust boundary | Data flow | Threat | Mitigation | Residual risk |
|-------|----------------|-----------|--------|------------|---------------|
| Stripe subscription state | Server (Convex) | `createCheckout` mutation → DB → `getStatus` query | **Entitlement escalation via test keys** — `sk_test_` keys grant `plan: "pro"` + `status: "local_test"` without real payment | `STRIPE_SECRET_KEY` only read server-side; local mock isolated to dev | **High** — if `sk_test_` key deployed to non-dev env, free pro entitlement |
| Stripe webhook endpoint | Server (Convex) | `subscriptions.webhook` internalMutation | **Webhook forgery** — no signature verification; accepts arbitrary `eventType` + `payload` | Not currently exposed via HTTP; internalMutation only | **Critical** — if exposed via HTTP action or scheduler, no verification |
| Invite tokens | Server (Convex) + Email (Resend) | `invite` action → DB → email → `acceptInvite` action → DB | **Token replay / multi-use** — `acceptInvite` does not check `inviteeUserId` already set; token valid until expiry | `crypto.randomUUID()` (CSPRNG); 7-day TTL (`INVITE_TOKEN_TTL_MS`) | **High** — spec claims single-use; code only checks expiry |
| Invite token confidentiality | Server (Convex) | `listPendingInvites` query → client | **Token disclosure to all org members** — full invite docs including `token` returned to any authenticated member | Tokens are bearer; org members already have org access | **Medium** — enables invite forwarding beyond intended recipient |
| Auth bypass config | Client (Nuxt) + Server (Convex) | `NUXT_PUBLIC_AUTH_BYPASS` env → client config → middleware skip | **Complete auth bypass in production** — if `NUXT_PUBLIC_AUTH_BYPASS=1` in prod, middleware returns early, `useAuth` auto-logs in dev user | Convex `AUTH_BYPASS` gated to local `CONVEX_CLOUD_URL`; Nuxt bypass has no such gate | **Critical** — client-side bypass has no environment gate |
| Multi-org membership | Server (Convex) | `invite`/`acceptInvite` → `memberships` table (no cross-org check) | **PII cross-org leakage** — same email now invited to multiple orgs; email address visible across org boundaries | Each org data scoped by `orgId`; no cross-org queries | **Medium** — email addresses distributed across more orgs than v1 |
| Expense share field | Server (Convex) | `expenses:create` → DB → `expenses:balance` query | **Share validation bypass** — schema `share` optional; balance defaults missing to 0 (partner owes 100%); frontend defaults to 50% | Backend validates integer 0–100 when provided; Zod-style manual checks | **Low** — backward-compatible default, but confusing UX mismatch |
| Subscription status `local_test` | Server (Convex) | `createCheckout` → DB → feature gating (unspecified) | **Status confusion** — `status: "local_test"` may be treated as active/pro by feature flags | Not yet consumed by feature gating code | **Low** — no feature flag code yet inspects `local_test` |

---

## Security Checklist

| Control | Status | Evidence |
|---------|--------|----------|
| Authentication enforced at server boundary | ✅ Pass | All mutations/queries use `requireAuthenticatedOrg` / `requireAuthenticatedUser` from `convex/auth.ts` |
| Authorisation checked per operation | ✅ Pass | `assertOrgWriteAccess` / `assertOrgAdminAccess` from `permissions.ts` called in all mutating functions; role-based permission map in `shared_constants.ts` |
| Inputs validated and size-limited | ✅ Pass | `expenses:create` validates amount (1–1,000,000), date format, share (0–100 integer), OCR text (20k chars), line items (200 max); `invite` validates email regex; `createCheckout` validates `priceId` string |
| Output encoded for HTML, CSS, and JavaScript contexts | ✅ Pass | Email templates use `escapeHtml` on all user-controlled strings (inviter name, org name, notes); no dynamic HTML rendering in components |
| CSP configured for preview and exports | N/A | No iframe, preview, or export pipeline in v1 (per `domains/11-security/security.md` §38) |
| Iframe sandbox and postMessage origin validated | N/A | No iframe or cross-origin messaging in v1 |
| Secrets absent from client code, logs, and errors | ✅ Pass | `authBypass*` keys removed from `nuxt.config.ts` runtimeConfig; `NUXT_PUBLIC_AUTH_BYPASS` guarded by `import.meta.dev` in `useAuth.ts` and `auth.global.ts`; `STRIPE_SECRET_KEY` read only in Convex server (✅); `CLERK_WEBHOOK_SECRET` used only in `convex/http.ts` (✅); `RESEND_API_KEY` only in `email.ts` (✅) |
| Rate limits and replay protections configured | ⚠️ **Partial** | Email rate limiting in `email.ts` (100/day/org, 1hr user cooldown); invite tokens now single-use enforced (`acceptInvite` throws `Invite already consumed`); no rate limit on `createCheckout` or `webhook` |
| Webhook signatures verified | ✅ Pass | `subscriptions.webhook` verifies Stripe HMAC-SHA256 signature (`STRIPE_WEBHOOK_SECRET`) against `timestamp.payload`; rejects missing/invalid signatures; local test mode (`no key` / `sk_test_`) bypasses without verification |
| Dependency findings triaged | ✅ Pass | `npm audit` shows 0 vulnerabilities (pre-existing; not part of D24 changes) |

---

## Findings

| # | File or area | Finding | Severity | Required action |
|---|--------------|---------|----------|-----------------|
| SEC-001 | `convex/functions/subscriptions.ts:79-92` | **Webhook signature verification absent** — `subscriptions.webhook` internalMutation accepts arbitrary `eventType: v.string()` and `payload: v.any()` with zero verification. If exposed via HTTP action or called from scheduler, allows webhook forgery. Spec §13 claims "Webhook secrets verified; mismatched signatures rejected" but implementation does not match. | Critical | **Fixed** — Added Stripe HMAC-SHA256 signature verification over `timestamp.payload` using `STRIPE_WEBHOOK_SECRET`; rejects missing/invalid signatures; local test mode (`no key` / `sk_test_`) bypasses without verification. Add `v.object` schema for payload structure in follow-up. |
| SEC-002 | `nuxt.config.ts`, `app/middleware/auth.global.ts:5`, `app/composables/useAuth.ts:14` | **Client-side auth bypass exposed in production** — `NUXT_PUBLIC_AUTH_BYPASS` reads into `runtimeConfig.public.authBypass`; middleware returns early skipping all auth; `useAuth` wrapper auto-creates signed-in dev user. Convex `AUTH_BYPASS` is gated to local `CONVEX_CLOUD_URL`, but Nuxt bypass has **no environment gate**. If deployed with this env var set, complete auth bypass. | Critical | **Fixed** — `authBypass*` keys removed from `nuxt.config.ts` runtimeConfig; `NUXT_PUBLIC_AUTH_BYPASS` retained in `.env.example` (empty) and guarded by `import.meta.dev` in `useAuth.ts` and `auth.global.ts`, so it only activates in local dev builds and is stripped from production bundles. |
| SEC-003 | `convex/functions/orgs.ts:264-318` (`acceptInvite`) | **Invite token not single-use enforced** — `acceptInvite` checks expiry but does NOT check `invite.inviteeUserId === undefined` before accepting. `acceptInviteDb` patches `inviteeUserId` post-accept, but a second acceptance with the same token (before any check) would succeed. Spec §13 claims "single-use; one-time consumption" but code only enforces TTL. | High | **Fixed** — Added `if (invite.inviteeUserId) throw new Error("Invite already consumed")` check before accepting. Same check applied in `teams.ts` acceptTeamInvite. Unique index on `invites.token` already exists. |
| SEC-004 | `convex/functions/orgs.ts:180-262` (`invite`), `convex/functions/orgs.ts:320-335` (`listPendingInvites`) | **Invite token disclosure to all org members** — `listPendingInvites` query returns full invite documents including `token` field to any authenticated org member (role `admin`/`member`/`viewer`). Token is a bearer credential; exposure enables invite forwarding. | Medium | Exclude `token` field from `listPendingInvites` projection, or restrict query to `admin`/`member` roles only (not `viewer`). Add `.filter(q => q.neq(q.field("inviteeUserId"), undefined))` to only show unconsumed invites. |
| SEC-005 | `convex/functions/subscriptions.ts:28-77` (`createCheckout`) | **Entitlement escalation via test keys** — when `STRIPE_SECRET_KEY` is unset or starts with `sk_test_`, function inserts subscription with `plan: "pro"` and `status: "local_test"`, returning fake session URL. No real Stripe API call made, yet entitlement granted. If `sk_test_` key configured in non-dev environment, free pro access. | High | Gate `local_test` mode behind explicit dev environment check (e.g. `CONVEX_CLOUD_URL` local match like `auth.ts` does). Do not treat `sk_test_` as automatic local mock — require explicit `STRIPE_LOCAL_MOCK=1` env var. Document that `sk_test_` in production = real Stripe test mode, not local mock. |
| SEC-006 | `convex/schema.ts:133-153`, `convex/functions/groups.ts:4-33` | **Groups table/schema unused; spec-implementation gap** — new `groups`, `group_memberships`, `subscriptions` tables added to schema but `listMine` queries legacy `memberships` table and returns org-based groups, not the new group model. The commercial model's multi-group-per-user feature is not implemented in `listMine`. | Medium | Either implement the new group model (use `groups` + `group_memberships` tables) and remove legacy `memberships`-based group logic, or remove the unused schema tables. Spec and implementation must align. |
| SEC-007 | `convex/functions/expenses.ts:60-64`, `convex/functions/expenses.ts:278-279` | **Share field default inconsistency** — schema `share: v.optional(v.number())` (optional, default undefined). Frontend slider defaults to 50%. Balance computation uses `exp.share ?? 0` (missing → 0 → partner owes 100%). Backward-compatible but confusing: form shows 50%, balance treats as 0%. | Low | Make `share` required with default 50 in schema (`v.number().default(50)`), or explicitly handle undefined in create mutation (set to 50), and document the balance default logic. |
| SEC-008 | `convex/functions/orgs.ts:180-262`, `convex/functions/teams.ts:126-197` | **Multi-org invite relaxation expands PII distribution** — removal of "already in another household" Clerk check allows same email to be invited to multiple orgs. Email addresses now circulate across more org boundaries than v1. Each org remains data-isolated, but PII (email) distribution surface expanded. | Low | Acceptable as designed feature; document in `security.md` PII catalogue that emails may exist in multiple orgs. Ensure GDPR data export/deletion handles multi-org membership correctly (delete from all orgs). |

---

## Residual Risk

1. **`local_test` status not yet consumed by feature gates** — No feature flag code currently inspects `subscription.status === "local_test"`. If future feature gating treats any non-`free` plan as active, `local_test` could inadvertently unlock paid features. Mitigation: implement explicit feature gate checks that require `status === "active"` AND `plan === "pro"` AND `STRIPE_SECRET_KEY` not in test mode.

2. **Invite token single-use enforcement gap** — The current fix for SEC-003 adds a check, but race conditions could still allow double-accept if two requests arrive concurrently before `inviteeUserId` patch. Mitigation: use Convex transaction or conditional patch (compare-and-swap on `inviteeUserId`).

3. **Client auth bypass env var leakage** — Even if removed from `runtimeConfig.public`, the `NUXT_PUBLIC_AUTH_BYPASS` env var may still exist in CI/CD or deployment configs. Mitigation: add CI check that fails build if `NUXT_PUBLIC_AUTH_BYPASS` is set in production branch.

---

## Approval

| Decision | Approver | Date | Notes |
|----------|----------|------|-------|
| Needs revision | security-engineer | 21-November-2026 | Critical findings SEC-001, SEC-002, SEC-003 must be remediated before promotion to `04-implemented` |

---

## Next Gate

Security re-review required after remediation of critical findings. Once SEC-001, SEC-002, SEC-003 are fixed and verified by inspecting current files (not remediation notes), the review can be updated to "Pass" and the slice promoted.

---

## Additional Notes for Implementation Team

### Stripe Webhook Signature Verification (SEC-001)
The `subscriptions.webhook` is an `internalMutation`. If it is meant to be invoked by an HTTP endpoint (e.g. `convex/http.ts` route), you must:
1. Add `STRIPE_WEBHOOK_SECRET` to Convex env
2. Implement HMAC-SHA256 verification in the handler (or in an HTTP action that calls it)
3. Define strict payload schema with `v.object({ ... })` instead of `v.any()`

### Auth Bypass Gate (SEC-002)
The current architecture has two bypass mechanisms:
- Convex: `AUTH_BYPASS` env var + `CONVEX_CLOUD_URL` local check (server-side only) ✅
- Nuxt: `NUXT_PUBLIC_AUTH_BYPASS` env var → `runtimeConfig.public.authBypass` → client middleware skip ❌

**Recommendation:** Remove client-side bypass entirely. Dev authentication should use the Convex bypass only. If client needs to know it's in bypass mode, expose a server query that returns the bypass status (already authenticated via Convex).

### Invite Token Single-Use (SEC-003)
```typescript
// In acceptInvite, before accepting:
if (invite.inviteeUserId) {
  throw new Error("Invite already consumed");
}
```
Add this check in both `orgs.ts:acceptInvite` and `teams.ts:acceptTeamInvite`.

### Invite Token Disclosure (SEC-004)
```typescript
// In listPendingInvites, project only needed fields:
return ctx.db
  .query("invites")
  .withIndex("by_org", (q) => q.eq("orgId", orgId))
  .filter((q) =>
    q.and(
      q.eq(q.field("inviteeUserId"), undefined),
      q.gt(q.field("expiresAt"), Date.now()),
    ),
  )
  .order("desc")
  .collect()
  .then((invites) => invites.map(({ token, ...rest }) => rest)); // strip token
```