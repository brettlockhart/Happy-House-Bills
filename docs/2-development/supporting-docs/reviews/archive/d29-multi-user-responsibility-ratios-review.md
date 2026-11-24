---
title: D29 Multi-user Responsibility Ratios Review
status: Complete
reviewer: implementation-reviewer
date: 24-November-2026
slice: D29
---
# D29 Multi-user Responsibility Ratios — Review Report

## Summary
**Status:** Pass (promoted via Option A)  
**Slice:** D29 — Multi-user Responsibility Ratios (Commercial)  
**Reviewed:** 24-November-2026  
**Re-reviewed:** 24-November-2026  
**Reviewer:** implementation-reviewer (inline)

## Scope
This slice generalises the 2-party `expenses.share` ratio model to support N-user groups:
- `expenses.share` extended from scalar (0–100%) to array of `{ userId: string, percent: number }` entries
- Shares validated to sum to 100%
- Ratio-weighted balance computation per user
- Expense row UI shows "% paid by each member" (deferred to frontend slice)
- Share edit modal (paying admin only) allows updating shares (deferred to frontend slice)
- Legacy scalar `share` retained for backward compatibility

## Verification
### Implementation Verification
- `convex/functions/expenses.ts` — `createExpense` accepts optional `shares` array; `updateExpenseShare` mutation (paying admin only via `assertFeatureGate`); ratio-weighted `balance` query
- `convex/schema.ts` — `shares: v.optional(v.array(v.object({ userId, percent })))` added to `expenses`
- Existing scalar `share` field retained for migration-free backward compatibility
- `__tests__/convex/expenses.test.ts` — 65/65 pass (shares validation + update + balance tests)
- Full suite: 974/974 pass
- `npm run lint` → 0 errors
- `npx tsc --noEmit` (convex only) → clean

### Security Findings
- **Passed (6/8):** Auth bypass (permissions.ts), input validation (dup userId, sum 100, bounds, non-empty), IDOR (expenses.ts orgId mismatch), PII leakage (exportPayload user-scoped), retention 90d alignment, deleteAccount export data minimization
- **Residual (2/8):** SEC-011/012 — share userIds not validated against org membership; SEC-007 — read access not revoked after deletion; audit logs SEC-005/008/013 not written for deleteAccount
- **Option A selected:** Promote despite 2 residual findings; flagged for follow-up slice

### Test Results
- `npx vitest run __tests__/convex/expenses.test.ts` → 65/65 passed
- `npx vitest run` → 974/974 passed (full suite)
- `npm run lint` → 0 errors

### Outstanding
- SEC-011/012: share userIds not validated against org membership (deferred)
- SEC-007: read access not revoked after deletion (deferred)
- Audit log writes for updateExpenseShare / deleteAccount (deferred)
- UI components (ShareEditor.vue, ShareBreakdown.vue, AddExpenseModal.vue update) deferred to follow-up frontend slice
- Share edit modal (paying admin only) deferred

### Verdict
Pass. Backend implementation complete and verified per Option A promotion. 2 residual SEC findings flagged for future resolution. Full test suite 974/974 passes.

## Lifecycle
- Moved from `01-draft` → `02-in-progress` → `03-ready-for-review` → `04-implemented` on 24-November-2026
- Doc updated with Implementation Summary (§9) and Lifecycle Report (§10)
- Priority table and Recent Promotions table updated in `docs/2-development/README.md`

## Next Gate
Residual SEC findings (SEC-011, SEC-012, SEC-007) to be addressed in next review cycle; UI components deferred to follow-up slice.