---
status: Complete
lifecycle: reviews
slice: D6
test_report: true
created: 28-October-2026
updated: 29-October-2026
---

# D6 — Test Coverage Report

## Summary

| Metric | Value |
|--------|-------|
| Total test files | 12 |
| Total tests | 183 passing |
| Test failures | 0 |
| D6 source files reviewed | 4 (2 tested, 2 untested) |

**D6 scope coverage (frontend source files only):**

Coverage was obtained by running Vitest with an extended `coverage.include` that adds `app/utils/*.ts` and `app/components/*.vue`. The default `vitest.config.ts` restricts coverage to `convex/**/*.ts` only, so frontend files do not appear in the standard coverage report.

| File | % Stmts | % Branch | % Funcs | % Lines |
|------|---------|----------|---------|---------|
| `app/utils/formatting.ts` | 85% | 83.33% | 100% | 85.71% |
| `app/components/EntryList.vue` | 58.33% | 13.63% | 14.28% | 59.09% |
| `app/components/SettleUpModal.vue` | 0% | 0% | 0% | 0% |
| `app/components/AddExpenseModal.vue` (existing) | 0% | 0% | 0% | 0% |

**Note on `app/utils/` and `app/components/` files:** The Vitest coverage configuration (`vitest.config.ts`) restricts coverage `include` to `convex/**/*.ts` only. Frontend `.vue` and `app/utils/*.ts` files do not appear in the standard v8 coverage report. Extended coverage was run manually for this review; full details below.

## File-by-File Analysis

### app/utils/formatting.ts

| Metric | Value |
|--------|-------|
| % Stmts | 85% |
| % Branch | 83.33% |
| % Funcs | 100% |
| % Lines | 85.71% |

**Uncovered lines:** Line 31 (`if (diffDays < 7) return \`${diffDays} days ago\`;`); line 32 (`return formatDate(d.toISOString());`).

Three functions, all invoked (100% function coverage), but `formatRelativeDate` has two uncovered execution paths:

- **`diffDays < 7` branch (line 31):** No test exercises the "N days ago" case (2–6 days ago). Branch b8 records 0 hits across both locations.
- **`formatDate(d.toISOString())` fallback (line 32):** No test exercises 7+ days ago, which falls through to `formatDate`. Statement s19 records 0 hits.

**Covered:**
- `formatCurrency` — positive number, zero, negative, string parsing, NaN guard (5 tests)
- `formatDate` — ISO string, Unix timestamp, invalid input (3 tests)
- `formatRelativeDate` — `diffDays === 0` ("Today"), `diffDays === 1` ("Yesterday"), invalid input (3 tests)

**Uncovered paths:**
- `formatCurrency("abc")` — `parseFloat("abc")` returns `NaN`, hitting the `isNaN` guard (line 3) via the *string* code path. The existing NaN test passes `NaN` directly, not through the string route.
- `formatRelativeDate` with 2–6 days difference — the `diffDays < 7` branch (line 31) is never entered.
- `formatRelativeDate` with 7+ days difference — falls through to `formatDate(d.toISOString())` (line 32), never executed.
- `formatRelativeDate` with future dates — `diffDays` is negative, so `diffDays < 7` is true, producing `"-N days ago"`. This is likely a bug (or at least undocumented behaviour) but is untested.

**Test file:** `__tests__/utils/formatting.test.ts` — 11 tests

### app/components/EntryList.vue

| Metric | Value |
|--------|-------|
| % Stmts | 58.33% |
| % Branch | 13.63% |
| % Funcs | 14.28% |
| % Lines | 59.09% |

**Uncovered lines/functions:** The `entries` computed data-mapping loop bodies (expense mapping, settlement mapping, sort comparator), `handleApprove` and `handleReject` function bodies, the `v-for` entry rendering template, and the approve/reject button click handlers.

The component has 7 functions (compiled from template + script):

| Function | Line | Times called | Status |
|----------|------|-------------|--------|
| `entries` computed callback | 17 | 1 | Covered (empty data path) |
| Sort comparator `() => ...` | 57 | 0 | **Uncovered** — no entries to sort |
| `handleApprove` | 60 | 0 | **Uncovered** |
| `handleReject` | 66 | 0 | **Uncovered** |
| `v-for` render function | 81 | 0 | **Uncovered** |
| Approve button click handler | 95 | 0 | **Uncovered** |
| Reject button click handler | 102 | 0 | **Uncovered** |

Only 1 of 7 functions is covered (14.28%). Only 3 of 22 branch locations are covered (13.63%).

**Covered:**
- Empty state rendering (`entries.length === 0` → true path)

**Uncovered:**
- Expense-to-entry mapping (`exp._id`, `exp.date`, `exp.amount`, `exp.notes || exp.category`, `exp.status === "pending"`, `exp.enteredBy === props.currentUserId`, `exp.paidBy`)
- Settlement-to-entry mapping (both `fromUser` description branches)
- Date-descending sort comparator
- `handleApprove` — type guard `if (expense.type === "expense")` and `approveExpense(expense.id)` call
- `handleReject` — type guard `if (expense.type === "expense")` and `rejectExpense(expense.id)` call
- Template: `v-for` entry rendering, amount display, date display, type label
- Template: approve/reject button visibility condition `entry.isPending && entry.type === 'expense' && !entry.isMine`

**Test file:** `__tests__/components/EntryList.test.ts` — 2 tests

The second test ("formats currency correctly") does **not** mount the `EntryList` component. It imports `formatCurrency` from the mocked `~/utils/formatting` module and asserts its output directly. This test provides zero component coverage and is a false positive — it inflates the test count while leaving the component untested.

### app/components/SettleUpModal.vue

| Metric | Value |
|--------|-------|
| % Stmts | 0% |
| % Branch | 0% |
| % Funcs | 0% |
| % Lines | 0% |

**No test file exists.** The entire component is untested.

**Key untested logic:**
- `handleSubmit` (line 29): the `amount <= 0` early-return guard (line 30, branch b0) prevents submission of zero or negative amounts. Neither the guard path nor the emit-and-reset path is exercised.
- `form` reactive state initialisation (lines 23–27): `fromUser` defaults to `props.currentUserId`, `toUser` defaults to `props.partnerUserId`.
- Template: `v-if="isOpen"` conditional rendering (line 37) — both open and closed states untested.
- Template: `@click.self="() => emit('close')` — overlay-click-to-close behaviour untested.
- Template: `v-model.number="form.amount"` with `step="0.01"`, `min="0.01"`, `required` — form validation untested.
- Template: Cancel button emits `close` (line 49) untested.
- Template: `partnerName` default fallback (line 46: `props.partnerName || "your partner"`) untested.

### app/components/AddExpenseModal.vue (existing component)

| Metric | Value |
|--------|-------|
| % Stmts | 0% |
| % Branch | 0% |
| % Funcs | 0% |
| % Lines | 0% |

**Not in scope for D6 review** (pre-existing component from an earlier slice). No test file exists. The D6 slice integration uses `AddExpenseModal` in `app/pages/index.vue` (lines 100–105), but the modal's own logic (`handleSubmit`, reactive form state, prop handling) has zero test coverage.

**Key untested logic (for reference):**
- `handleSubmit` (line 51): emits submit with form data, resets all form fields — no guard on `amount <= 0` (unlike `SettleUpModal`).
- Template: `v-if="isOpen"`, `@click.self` close, form inputs with `v-model` bindings.
- Template: edit vs. add mode (`props.expense ? "Edit Expense" : "Add Expense"`).

## Gaps

### High Priority (Remaining)

- [ ] **`SettleUpModal.vue` — 0% coverage, no test file.** The entire component is untested. `handleSubmit`'s `amount <= 0` guard, emit-and-reset logic, conditional rendering, and overlay-close behaviour all lack tests. This is a D6-created component with critical settlement logic (amount validation, emit payload shape).

- [ ] **`EntryList.vue` data rendering — no test mounts the component with actual data.** Both test cases use empty `ref([])` for all composables. The `entries` computed's mapping loops (lines 29–55) never iterate, so expense and settlement entry construction is completely untested.

- [ ] **`EntryList.vue` sorting — untested.** The `all.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())` comparator (line 57) is never executed. Sorting direction (descending by date), date parsing, and mixed expense/settlement ordering are all unverified.

- [ ] **`EntryList.vue` `handleApprove` / `handleReject` — 0% execution.** Both handler functions (lines 60–64, 66–70) are never called. The type guards (`if (expense.type === "expense")`) and the calls to `approveExpense`/`rejectExpense` are untested. Settlement items should be no-ops (type guard prevents mutation call) but this is unverified.

- [ ] **`EntryList.vue` button visibility — untested.** The `v-if="entry.isPending && entry.type === 'expense' && !entry.isMine"` condition (line 91) has 0% branch coverage. No test verifies that approve/reject buttons appear for pending foreign expenses or are hidden for own expenses, approved/rejected expenses, or settlements.

### Medium Priority (Remaining)

- [ ] **`EntryList.test.ts` second test is a false positive.** The "formats currency correctly" test (test #2) does not mount `EntryList` at all — it imports the mocked `formatCurrency` and asserts its output. This test should either be removed or replaced with an actual component-mount test that verifies currency formatting within the rendered entry.

- [ ] **`formatRelativeDate` — "N days ago" branch (line 31) untested.** No test case provides a date 2–6 days in the past, leaving the `diffDays < 7` condition and its template literal return uncovered.

- [ ] **`formatRelativeDate` — 7+ days fallback (line 32) untested.** No test case provides a date 7+ days in the past, leaving the `formatDate(d.toISOString())` call uncovered.

- [ ] **`formatCurrency` — string-to-NaN path untested.** `formatCurrency("abc")` should return `"$0.00"` (parseFloat returns NaN, isNaN guard triggers), but only `formatCurrency(NaN)` is tested. The string code path into the NaN guard is not exercised.

- [ ] **`formatDate` — empty string and non-ISO date strings untested.** `formatDate("")` and `formatDate("not-a-date")` would return `"Invalid date"`, but only `formatDate("invalid")` is tested. Date strings without time components (e.g., `"2025-10-26"`) are untested.

- [ ] **`AddExpenseModal.vue` — 0% coverage (pre-existing gap).** This existing component is integrated into D6's `app/pages/index.vue` but has no tests. Notably, `handleSubmit` (line 51) lacks an `amount <= 0` guard, unlike `SettleUpModal`.

### Low Priority

- [ ] **`formatRelativeDate` — future dates untested.** A date in the future produces a negative `diffDays`, which is neither 0 nor 1, and `diffDays < 7` is true for negative values, producing `"-N days ago"`. This is likely unintended behaviour but is untested.

- [ ] **`formatRelativeDate` — boundary at exactly 7 days.** `diffDays === 7` falls through to `formatDate()` (line 32). The boundary between "6 days ago" and the formatDate fallback is untested.

- [ ] **`formatCurrency` — floating-point precision.** Values like `45.225` may round unexpectedly due to `Intl.NumberFormat` behaviour with banker's rounding. Untested.

- [ ] **`EntryList.vue` — `exp.notes || exp.category` fallback (line 35).** The branch where `notes` is empty/undefined (falling back to `category`) is untested because no expense data is ever provided.

- [ ] **`EntryList.vue` — settlement description branches (lines 48–50).** Both the "You paid them/partner" and "Partner paid you" description strings are untested due to no settlement data in tests.

## Recommendations

1. **High — Create `__tests__/components/SettleUpModal.test.ts`.** Add tests for: `handleSubmit` with valid amount (emits submit with `{ amount, fromUser, toUser }`), `handleSubmit` with `amount <= 0` (early return, no emit), `isOpen=false` (component not rendered), `isOpen=true` (component rendered), overlay-click-to-close (`@click.self`), Cancel button, and `partnerName` default fallback. Mock `useSettlements` composable.

2. **High — Rewrite `EntryList.test.ts` with data-driven tests.** Replace the false-positive "formats currency correctly" test with a test that mounts `EntryList` with mocked composable data (expenses + settlements) and verifies:
   - Expense entries render with correct description, amount (via mocked `formatCurrency`), and relative date (via mocked `formatRelativeDate`)
   - Settlement entries render with correct "You paid/partner" description
   - Entries are sorted by date descending (provide entries with different dates, assert order)
   - `exp.notes || exp.category` fallback when notes is absent

3. **High — Add `handleApprove` and `handleReject` tests to `EntryList.test.ts`.** Mount with a pending foreign expense, click the approve button, and assert `approveExpense` is called with the correct ID. Same for reject. Verify that clicking approve/reject on a settlement item does NOT call the mutation functions (type guard).

4. **High — Add button visibility tests to `EntryList.test.ts`.** Verify buttons appear for: pending expense entered by another user. Verify buttons are hidden for: own pending expense, approved expense, rejected expense, settlement.

5. **Medium — Extend `formatting.test.ts` with edge cases.** Add tests for: `formatRelativeDate` with 2–6 days ago ("N days ago"), `formatRelativeDate` with 7+ days ago (falls through to `formatDate`), `formatCurrency("abc")` (string-to-NaN path), `formatDate("")` (empty string), `formatDate` with non-ISO date strings, `formatCurrency` with floating-point precision values.

6. **Medium — Add tests for `AddExpenseModal.vue`.** Create `__tests__/components/AddExpenseModal.test.ts` covering `handleSubmit`, form field bindings, edit mode (expense prop present), and add mode (no expense prop). Note the missing `amount <= 0` guard in `handleSubmit` — consider whether this should be fixed or documented.

7. **Low — Consider future-date handling in `formatRelativeDate`.** The negative `diffDays` path produces `"-N days ago"` which is incorrect. Consider clamping or adding an "in N days" branch. Add tests once the intended behaviour is clarified.

8. **Info — Extend coverage config to include frontend files.** Update `vitest.config.ts` `coverage.include` to add `"app/utils/**/*.ts"` and `"app/components/**/*.vue"`. This would bring frontend coverage into the standard report for future slices, eliminating the need for manual extended-coverage runs.
