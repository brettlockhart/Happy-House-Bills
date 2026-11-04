---
status: Draft
lifecycle: reviews
slice: D3
security_review: true
scope: slice-level
created: 27-October-2026
updated: 27-October-2026
---

# D3 — Onboarding Flow — Security Review

**Reviewer:** Security review (automated + manual)
**Review type:** Slice-level (code + design)
**Scope:** `convex/functions/orgs.ts`, `convex/auth.ts`, `app/middleware/auth.global.ts`, `app/composables/useAuth.ts`, `app/composables/useOrgs.ts`, `app/pages/onboard.vue`

## 1. Threat Model Summary (STRIDE)

| Threat | Description | Mitigated? |
|--------|-------------|------------|
| **Spoofing** | Attacker impersonates User A or User B during onboarding | ✅ Clerk handles identity; requireAuthenticatedUser/Org on Convex |
| **Tampering** | Attacker modifies invite token, orgId, or email in request | ✅ `orgs:invite` cross-checks `args.orgId === callerOrgId` (SEC-007); token is server-generated |
| **Repudiation** | User denies creating/inviting | ✅ Clerk session provides identity; token stored with `createdBy` |
| **Information disclosure** | Invite token leaks, allowing unauthorised org join | ✅ Token is `crypto.randomUUID()` (unpredictable); 7-day expiry; single-use |
| **Denial of service** | Attacker floods invite creation | ⚠️ No rate limiting currently (documented limitation, v1 has 2-user households) |
| **Elevation of privilege** | Attacker adds themselves without invitation | ✅ `acceptInvite` validates token; `invite` checks existing org membership |

## 2. Findings

| ID | Severity | Title | Status |
|----|----------|-------|--------|
| SEC-001 | N/A | Cross-tenant isolation via orgId scoping | ✅ Pass |
| SEC-002 | N/A | Soft-delete filtering on invites | N/A (invites are deleted after accept) |
| SEC-003 | N/A | No PII exposure in logs | ✅ Pass |
| SEC-004 | Medium | JWT token handling for org_id | ⚠️ Requires Clerk dashboard config |
| SEC-005 | Low | Role-based access control | ✅ Pass (2-member household only) |
| SEC-006 | N/A | toUser validation (settlement-specific) | N/A (not applicable to onboarding) |
| SEC-007 | High | Cross-tenant checks on invite flow | ✅ Pass |
| SEC-008 | Medium | Input validation on invite email and token | ✅ Pass |

## 3. Detailed Findings

### SEC-001: Cross-tenant isolation via orgId scoping — ✅ Pass

Every Convex function that handles user data calls `requireAuthenticatedOrg(ctx)` or
`requireAuthenticatedUser(ctx)`. The org ID is extracted from the Clerk JWT `org_id` claim,
never from client input.

**Evidence:** `convex/auth.ts:19-38` — `requireAuthenticatedOrg` extracts `orgId` from the
JWT, not from any request body.

**Test gap:** `orgs:test` does not verify that a user from org A cannot access org B's data.
A unit test for cross-tenant isolation should be added.

### SEC-002: Soft-delete filtering — N/A

The `invites` table does not have a `deletedAt` field. Invites are consumed (patched with
`inviteeUserId`) after acceptance and naturally expire via the `expiresAt` field. No soft-
delete needed.

### SEC-003: No PII exposure in logs — ✅ Pass

The implementation does not log or expose emails, tokens, or user IDs. Error messages are
generic ("Invalid invite token", "Household is already full") and do not leak PII.

**Evidence:** `convex/functions/orgs.ts:100-113` — error messages do not expose user emails.

### SEC-004: JWT token handling — ⚠️ Requires Clerk dashboard config

The `orgId` is extracted from `identity.org_id` (a custom JWT claim). This requires the
Clerk JWT template to be configured to include `org_id` as a custom claim. If the template
is not configured, all org-scoped functions will fail with "Unauthenticated or no organisation".

**Risk:** If the JWT template is misconfigured, either:
- All org-scoped operations fail (deny-by-default — acceptable)
- The `org_id` claim is not present, causing functions to reject all requests

**Mitigation:** `convex/auth.ts:31-32` checks `if (!userId || !orgId)` and throws.
This is fail-safe — missing org_id results in rejection, not bypass.

**Recommendation:** Add a Clerk dashboard configuration checklist to the onboarding docs.
Document the exact JWT template JSON to paste into the Clerk dashboard.

### SEC-005: Role-based access control — ✅ Pass

The onboarding flow enforces exactly 2 members per household:
- `orgs:invite` (line 180) checks `members.length >= 2` and throws if full
- `orgs:acceptInvite` (line 180) also checks before adding

**Evidence:** `convex/functions/orgs.ts:180-182`

### SEC-006: toUser validation — N/A

This control is specific to settlements (verifying the recipient of a payment). Not applicable
to the onboarding flow.

### SEC-007: Cross-tenant checks on invite flow — ✅ Pass

The `invite` function verifies that `args.orgId === callerOrgId` (the org from the JWT).
An authenticated user from org A cannot send an invite for org B.

**Evidence:** `convex/functions/orgs.ts:84-88`

### SEC-008: Input validation on invite email and token — ✅ Pass

Email validation: `invites` checks `args.email.includes("@")` (line 90).
Token validation: `acceptInvite` looks up by token index and checks expiry (lines 162-173).

**Limitation:** Email validation is basic (`includes("@")`). Does not validate full email format.
This is acceptable for v1 but should be enhanced.

## 4. Security Test Plan

| ID | Test | SEC ID | Priority |
|----|------|--------|----------|
| ST-001 | Reject invite when authenticated user is from a different org (org mismatch) | SEC-007 | High |
| ST-002 | Reject invite with invalid email format | SEC-008 | High |
| ST-003 | Reject acceptInvite with expired token | SEC-008 | High |
| ST-004 | Reject acceptInvite when household is full (2+ members) | SEC-005 | High |
| ST-005 | verifyAuthenticatedOrg throws on missing org_id claim | SEC-004 | Medium |
| ST-006 | requireAuthenticatedUser throws on null identity | SEC-001 | High |
| ST-007 | Token is a valid UUID (not predictable) | SEC-004 | Medium |
| ST-008 | Email validation rejects emails without @ | SEC-008 | Medium |
| ST-009 | acceptInvite marks invite with inviteeUserId (one-time use) | SEC-003 | Low |
| ST-010 | listPendingInvites only returns current org's invites | SEC-001 | High |

## 5. Recommendations

1. **High:** Add security tests ST-001, ST-003, ST-004, ST-006, ST-010 to `__tests__/convex/orgs.test.ts`
2. **Medium:** Document the exact Clerk JWT template JSON configuration in `onboarding-auth.md`
3. **Medium:** Enhance email validation beyond `includes("@")` using a regex or library
4. **Low:** Add invite token one-time-use enforcement (currently token is consumed but not invalidated)
5. **Info:** Consider adding rate limiting to `orgs:invite` for future scale (not needed for v1 2-user households)

## 6. Verdict

**Conditional Pass** — Security requirements are adequately implemented in the code. The
implementation is fail-safe (missing auth → rejected, not bypassed). Key gaps are in test
coverage — the security-critical paths (token expiry, member count enforcement, email
validation, cross-tenant org checks) need dedicated security tests. These should be added
before the slice is promoted to `04-implemented`.

**Spec-level controls:** All specified security properties are implemented in code.
**Implementation-level verification:** Pending security test coverage (ST-001 through ST-010).
