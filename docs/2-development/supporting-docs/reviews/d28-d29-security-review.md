# Security Review Report: D28 Account Deletion & Ownership Transfer + D29 Multi-user Responsibility Ratios

**Status:** Final
**Scope:** D28 (41c29a7) + D29 (1987af0)
**Date:** 24-November-2026
**Reviewer:** security-engineer
**Verdict:** Needs revision — 6 High/Medium findings requiring code changes

---

## Scope and Sensitivity

| Field | Value |
|-------|-------|
| Affected files | `convex/functions/orgs.ts` (transferOwnership, deleteAccount), `convex/functions/expenses.ts` (create, updateExpenseShare, balance), `convex/functions/retention.ts`, `convex/crons.ts` |
| Authentication or authorisation | Yes — ownership transfer, account deletion, share editing |
| Billing or entitlements | Yes — subscriptionRole "paying" / "admin" entitlement gates |
| File upload or export | Yes — deleteAccount export payload (GDPR export-before-purge) |
| Iframe, CSP, or preview | No |
| User data or PII | Yes — expenses, settlements, membership data, PII in export |

---

## Threat Model (STRIDE Summary)

| Asset | Trust boundary | Data flow | Threat (STRIDE) | Mitigation | Residual risk |
|-------|----------------|-----------|-----------------|------------|---------------|
| Org membership & role state | Convex DB — org-scoped | transferOwnership mutates role + subscriptionRole | **Elevation of Privilege** (viewer→admin via paying sub), **Spoofing** (arbitrary target userId) | requireAuthenticatedOrg, subscriptionRole rank check | **Medium** — missing team role gate, status check |
| User account + PII | Convex DB — user-scoped | deleteAccount soft-deletes membership, expenses, settlements; returns export | **Information Disclosure** (read access retained after deletion), **Tampering** (retention mismatch), **Repudiation** (no audit log) | Soft delete, 90-day claim | **High** — read access not revoked, retention 30d ≠ 90d, no purge cron |
| Expense shares (financial ratios) | Convex DB — org-scoped | updateExpenseShare / create accept arbitrary userIds in shares | **Tampering** (balance manipulation via fictitious userIds), **Elevation** (admin grants paying seat free) | assertFeatureGate (subscriptionRole admin), sum-to-100 validation | **Medium** — no org membership validation on share userIds |
| Retention / purge job | Convex scheduler | scheduleRetention chains itself daily but never initially scheduled | **Denial of Service** (data never purged → retention violation) | Internal action with self-schedule | **High** — no cron entry, never runs |

---

## Security Checklist

| Control | Status | Evidence |
|---------|--------|----------|
| Authentication enforced at server boundary | ✅ Pass | `requireAuthenticatedOrg` on all mutations; Clerk org_id claim |
| Authorisation checked per operation | ❌ Fail | `transferOwnership` only checks subscriptionRole, not team role; `updateExpenseShare` uses subscriptionRole "admin" gate; queries lack membership status check |
| Inputs validated and size-limited | ⚠️ Partial | Shares sum-to-100 validated; **no max length on userId strings**, no org membership validation for targetUserId/share userIds |
| Output encoded for HTML, CSS, and JavaScript contexts | N/A | No HTML/JS output from these mutations |
| CSP configured for preview and exports | N/A | No preview/iframe in scope |
| Iframe sandbox and postMessage origin validated | N/A | Not in scope |
| Secrets absent from client code, logs, and errors | ✅ Pass | No secrets in these code paths |
| Rate limits and replay protections configured | ❌ Fail | No rate limiting on transferOwnership, deleteAccount, updateExpenseShare |
| Webhook signatures verified | N/A | No webhooks in these changes |
| Dependency findings triaged | ❌ Not checked | npm audit not run as part of this review |

---

## Findings

| # | File or area | Finding | Severity | Required action |
|---|--------------|---------|----------|-----------------|
| SEC-001 | `orgs.ts:transferOwnership` | **Missing team role check — privilege escalation**. Mutation only checks `subscriptionRole` rank ≥ paying. A `viewer` with subscriptionRole `paying` (or `admin`) can invoke full ownership transfer, promoting a target to `ROLES.ADMIN` and demoting themselves. This bypasses `ROLE_PERMISSIONS` where `team:manage` is admin-only. | Medium | Add team role check: require `callerMembership.role === "admin"` in addition to subscriptionRole rank. |
| SEC-002 | `orgs.ts:transferOwnership` | **No membership status validation on caller**. Does not filter `callerMembership.status === "active"` or `!deletedAt`. A suspended/deleted membership (from `deleteAccount`) with paying subscriptionRole can still transfer ownership. | Medium | Add `if (callerMembership.status !== "active" || callerMembership.deletedAt) throw Error`. |
| SEC-003 | `orgs.ts:transferOwnership` (member-only) | **Entitlement inflation — `member-only` grants `paying` to target without downgrading caller**. Both caller (retains admin) and target become `subscriptionRole: "paying"`, creating two paying seats from one subscription. `full` mode correctly downgrades caller. | Medium | In `member-only` branch, downgrade caller's `subscriptionRole` to `free` (or document that this mode is for adding a second paying member intentionally). |
| SEC-004 | `orgs.ts:transferOwnership` | **Target userId not validated against Clerk / org membership**. `full` transfer inserts admin membership for any arbitrary string `targetUserId`. No verification target exists in Clerk, accepted invite, or consented. Allows granting admin to phantom user. | Low | Validate `targetUserId` exists in Clerk (`/users/{id}`) and/or has accepted org invite; or require `targetMembership` to pre-exist with status active. |
| SEC-005 | `orgs.ts:transferOwnership`, `deleteAccount` | **Missing audit log for security-sensitive operations**. `auditLogs` table exists but neither mutation writes to it. Repudiation risk for ownership transfer and account deletion. | Low | Write audit log entries: `{action: "transfer_ownership", ...}`, `{action: "delete_account", ...}`. |
| SEC-006 | `orgs.ts:deleteAccount`, `retention.ts`, `crons.ts` | **Retention period mismatch + purge job never scheduled**. `deleteAccount` returns `retentionDays: 90`. `retention.ts` uses `RETENTION_DAYS = 30`. `scheduleRetention` self-chains but no cron entry exists → job never runs. Memberships also never purged. GDPR compliance gap. | High | 1. Align retention constant (90 days per spec). 2. Add `crons.daily("retention-purge", ..., internal.functions.retention.scheduleRetention)`. 3. Extend purge to memberships with deletedAt. |
| SEC-007 | `orgs.ts:deleteAccount`, all query functions | **Account deletion does not revoke read access**. `deleteAccount` sets membership `status: "suspended"`, `deletedAt`. But **all query functions** (`list`, `pending`, `balance`, etc.) only call `requireAuthenticatedOrg`, which derives orgId from Clerk token and does **not** check local membership status. A deleted user with a valid Clerk session/org membership retains full read access to org expenses/settlements/balances. Clerk org membership also not revoked. | High | Option A: Add membership status check to `requireAuthenticatedOrg` (shared helper). Option B: Add `assertActiveMembership` check at start of every query/mutation that exposes org data. Also call Clerk API to remove user from org on `deleteAccount`. |
| SEC-008 | `orgs.ts:deleteAccount` | **Missing audit log for account deletion** (same as SEC-005). | Low | Write audit log entry. |
| SEC-009 | `orgs.ts:deleteAccount` export | **GDPR export incomplete** — only includes expenses (enteredBy) and settlements. Missing: receipt images, profile data, notifications, audit logs, goals, budgets, categories created, notification preferences, etc. | Low | Document scope limitation; expand export if full GDPR Art 15/20 compliance required. |
| SEC-010 | `orgs.ts:deleteAccount` | **No check that caller membership is active** — suspended/pending memberships could invoke. | Low | Add `if (membership.status !== "active" || membership.deletedAt) throw Error`. |
| SEC-011 | `expenses.ts:updateExpenseShare`, `create` | **Share userIds not validated against org membership**. Admin can assign shares to arbitrary userIds (non-members, other orgs, fictitious). Enables balance manipulation (e.g., assign 100% to fake user so real members owe 0; assign 0% to a real member to reduce their obligation). | Medium | Validate each `userId` in shares exists in org memberships with status active. |
| SEC-012 | `expenses.ts:updateExpenseShare` | **No check that expense is not soft-deleted**. Can modify shares on expenses with `deletedAt` set (from `deleteAccount`). | Medium | Add `if (expense.deletedAt) throw Error("Expense is deleted")`. |
| SEC-013 | `expenses.ts:updateExpenseShare` | **Missing audit log for financial record mutation**. | Low | Write audit log entry. |
| SEC-014 | `expenses.ts:create` | **Shares array accepts arbitrary userIds** (same as SEC-011 at creation time). | Low | Same fix as SEC-011. |
| SEC-015 | `expenses.ts:balance` | **Balance integrity issue**: if shares array omits the payer, payer's `ownPercent=0` → payer owed 100% of amount; other unlisted users owe 0 → balances don't sum to zero. Not directly exploitable but financial integrity risk. | Low | Validate shares array includes all org members, or at least includes the payer. Document fallback behaviour. |
| SEC-016 | `expenses.ts` schema, mutations | **No max length on `userId` strings in shares / targetUserId** — unbounded input (DoS/storage). Convex `v.string()` has no max length by default. | Low | Add length check: `userId.length <= 64` (Clerk user IDs are ~25 chars). |
| SEC-017 | All three mutations | **No rate limiting** on sensitive operations (transferOwnership, deleteAccount, updateExpenseShare). | Low | Add per-user/org rate limit (e.g., 5/hour) via usageLimits pattern or dedicated table. |

---

## Residual Risk

| Finding | Residual risk after fix | Acceptance rationale |
|---------|-------------------------|---------------------|
| SEC-001/002/003 | Low — team role + status checks close the escalation paths; member-only entitlement semantics clarified | Requires code change |
| SEC-006 | Medium — retention cron must be deployed and monitored; 90-day purge must be verified in staging | Requires code + infra change |
| SEC-007 | Medium — revoking Clerk org membership is async and may not be instant; queries must gate on local membership status | Requires architectural decision (Option A vs B) |
| SEC-011/012 | Low — membership validation on share userIds + deletedAt check close manipulation paths | Requires code change |
| SEC-015 | Low — documented; admin authority over ratios is intentional | Acceptable with documentation |

---

## Approval

| Decision | Approver | Date | Notes |
|----------|----------|------|-------|
| Needs revision — fix SEC-001, SEC-002, SEC-003, SEC-006, SEC-007, SEC-011, SEC-012 before merge | — | — | — |

---

## Next Gate

Code fixes → re-review → promote D28/D29 to `04-implemented` after all High/Medium findings resolved.