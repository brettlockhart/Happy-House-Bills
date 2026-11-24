---
status: Implemented
lifecycle: 04-implemented
phase: Phase 4
slice: D29
created: 23-November-2026
updated: 24-November-2026
depends_on: [D24]
blocks: []
---

# Slice D29: Multi-user Responsibility Ratios

**Date:** 23-November-2026
**Status:** Implemented
**Phase:** Phase 4 — Commercial Model

## 1. Purpose

Generalise the 2-party `expenses.share` ratio model from D24 to support N-user groups
(e.g., a household of 3 or 4 members sharing an expense). Each expense records per-member
responsibility percentages (summing to 100%), and the balance computation uses
ratio-weighted contributions per member.

## 2. Scope

### In scope

- **Schema extension**: `expenses.share` from scalar (0–100%) to array of
  `{ userId: string, percent: number }` entries; validation that shares sum to 100%.
- **Balance computation**: `balance = total × (share/100)` per user; displayed as
  "You cover X%" in the balance header.
- **UI**: expense row shows "% paid by each member"; modal to edit shares
  (paying admin only); share validation prevents sum != 100%.
- **Migration**: existing 2-party expenses keep their existing `share` field; the
  new array form is applied on creation or share edit.

### Out of scope

- Per-user share tracking across multiple groups (single group model for v1).
- Split expense UX (multiple expenses or single with items) — deferred.

## 3. Acceptance Criteria

- [x] `expenses:create` accepts `shares: [{ userId, percent }]` and validates shares sum to 100%; rejects with error if sum != 100%.
- [x] `expenses:balance` returns ratio-weighted per-user balance using `shares` array; falls back to legacy scalar `share` for existing expenses.
- [ ] Expense row UI shows "% paid by each member" for each expense — deferred to frontend slice.
- [ ] Share edit modal (paying admin only) allows updating shares — deferred to frontend slice.
- [x] `updateExpenseShare` mutation (paying admin only) validates sum == 100% and updates shares.
- [x] Existing 2-party expenses continue to work without migration via legacy scalar `share` fallback.

## 4. Technical Details

- Extend `convex/functions/expenses.ts` with `createExpense` mutation accepting
  `share: Array<{ userId: string, percent: number }>`. Validate sum == 100%.
- Extend `convex/functions/expenses.ts` with `updateExpenseShare` mutation (paying admin only).
- Update `convex/functions/expenses.ts` balance computation to use ratio-weighted formula.
- Update `app/components/ExpenseRow.vue` (or new `ShareBreakdown.vue`) to display per-member shares.
- Update `app/components/AddExpenseModal.vue` (or new `ShareEditor.vue`) with share editor.
- Update `__tests__/convex/expenses.test.ts` for new share array validation.

## 5. Files Created/Modified

| Path | Action |
|------|--------|
| `convex/functions/expenses.ts` | Update — `shares` array + `updateExpenseShare` + balance |
| `convex/schema.ts` | Update — add `shares` array field |
| `app/components/ShareEditor.vue` | Deferred — to frontend slice |
| `app/components/ShareBreakdown.vue` | Deferred — to frontend slice |
| `app/components/AddExpenseModal.vue` | Deferred — to frontend slice |
| `app/components/ExpenseRow.vue` | Deferred — to frontend slice |
| `__tests__/convex/expenses.test.ts` | Update — shares validation + update + balance tests |

## 6. Dependencies

- D24 — Commercial Model & Responsibility Ratios (2-party ratios; `expenses.share` field).
- D26 — Advanced Feature Gating (paying admin only for share editing).

## 7. Blocks

- P4-Q5 (multi-user ratio generalisation) — this slice resolves the generalisation.

## 8. Open Questions

| ID | Question | Status | Resolution Owner | Target Phase |
|----|----------|--------|------------------|--------------|
| P4-Q5 | Multi-user ratio generalisation (N-user groups)? | Open | backend-engineer | Phase 4 — resolved by D29 backend; UI deferred |

## 9. Implementation Summary

Backend implemented in `convex/functions/expenses.ts` and `convex/schema.ts`:

- `expenses:create` — accepts optional `shares: Array<{ userId, percent }>`; validates:
  - Array non-empty, each `userId` non-empty, each `percent` finite 0–100, sum == 100%.
  - Existing scalar `share` validation retained for backward compatibility.
- `expenses:updateExpenseShare` — new mutation (paying admin only via `assertFeatureGate`):
  - Validates shares sum == 100%, validates each entry, updates expense `shares` atomically.
- `expenses:balance` — rewritten to compute ratio-weighted per-user balance:
  - Uses `shares` array when present (N-party), with legacy fallback to scalar `share`
    (2-party) and legacy no-share default (partner owes 100%).
  - Per-expense: `ownPercent` from `shares` array or legacy `share`; payer owed
    `amount × (100 - ownPercent)/100`, non-payer owes `amount × ownPercent/100`.
- Schema: added `shares: v.optional(v.array(v.object({ userId, percent })))` to `expenses`.
- Existing `share` scalar field retained for migration-free backward compatibility.

Tests added in `__tests__/convex/expenses.test.ts`:
- Shares array validation (sum == 100%, percent bounds, empty userId, sum != 100%).
- `updateExpenseShare` success + sum validation + non-admin rejection.
- Balance with `shares` array (payer owed 40, non-payer owes 60).

UI components (`ShareEditor.vue`, `ShareBreakdown.vue`, `AddExpenseModal.vue` update)
deferred to a follow-up frontend slice.

## 10. Lifecycle Report

- 23-November-2026: Moved from `01-draft` → `02-in-progress`; proposal refined (removed unrelated LI-Q1-Q3).
- 24-November-2026: Backend mutations `updateExpenseShare` + ratio-weighted `balance` + `shares` schema implemented; typecheck clean; lint 0 problems; expenses tests 65/65 pass; full suite 974/974 pass.
- 24-November-2026: Promoted to `04-implemented` via Option A (full promotion). Security re-review: 6/8 concerns pass; 2 remain open (access control SEC-011/012, audit logs SEC-005/008/013) — flagged for follow-up; SEC-004, SEC-007, SEC-017 residual.