---
status: Draft
lifecycle: 01-draft
phase: Phase 4
slice: D29
created: 23-November-2026
updated: 23-November-2026
depends_on: [D24]
blocks: []
---

# Slice D29: Multi-user Responsibility Ratios

**Date:** 23-November-2026
**Status:** Draft
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

- [ ] `expenses:create` accepts `share: [{ userId, percent }]` and validates shares sum
      to 100%; rejects with error if sum != 100%.
- [ ] `expenses:balance` returns per-user ratio-weighted balance: `balance[userId] = total × (share/100)`.
- [ ] Expense row UI shows "% paid by each member" for each expense.
- [ ] Share edit modal (paying admin only) allows updating shares; validation prevents
      sum != 100%.
- [ ] Existing 2-party expenses continue to work without migration.

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
| `convex/functions/expenses.ts` | Update — share array + balance computation |
| `convex/schema.ts` | Update — share field type |
| `app/components/ShareEditor.vue` | New |
| `app/components/ShareBreakdown.vue` | New |
| `app/components/AddExpenseModal.vue` | Update |
| `app/components/ExpenseRow.vue` | Update |
| `__tests__/convex/expenses.test.ts` | Update |

## 6. Dependencies

- D24 — Commercial Model & Responsibility Ratios (2-party ratios; `expenses.share` field).
- D26 — Advanced Feature Gating (paying admin only for share editing).

## 7. Blocks

- P4-Q5 (multi-user ratio generalisation) — this slice resolves the generalisation.

## 8. Open Questions

| ID | Question | Status | Resolution Owner | Target Phase |
|----|----------|--------|------------------|--------------|
| LI-Q1 | `OPENROUTER_OCR_MODEL` vs custom trained model for accuracy? | Open | backend-engineer | Phase 2 — Start with `google/gemini-2.5-flash`; evaluate on real receipts |
| LI-Q2 | How to handle split expense UX — multiple expenses or single with items? | Open | frontend-engineer | Phase 2 — Design review needed |
| LI-Q3 | Should line items persist for audit/receipt view? | Open | backend-engineer | Phase 2 — Storage cost vs utility trade-off |
| P4-Q5 | Multi-user ratio generalisation (N-user groups)? | Open | backend-engineer | Phase 4 — 2-party ratio only in v1; generalisation deferred |