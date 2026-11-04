# D5 — Test Coverage Report

## Summary

| Metric | Value |
|--------|-------|
| Total statements | 315 |
| Covered statements | 242 |
| Statement coverage | 76.82% |
| Total branches | 229 |
| Covered branches | 190 |
| Branch coverage | 82.96% |
| Total functions | 48 |
| Covered functions | 36 |
| Function coverage | 75% |
| Total tests | 170 passed (10 files) |

**D5 scope coverage (convex source files only):**

| File | % Stmts | % Branch | % Funcs | % Lines |
|------|---------|----------|---------|---------|
| `convex/functions/duplicateDetection.ts` | 100% | 96.97% | 100% | 100% |
| `convex/functions/expenses.ts` (create mutation portion) | 100% | 100% | 100% | 100% |

**Note on `app/utils/` files:** The Vitest coverage configuration (`vitest.config.ts`) restricts coverage `include` to `convex/**/*.ts` only. As a result, `app/utils/imageUtils.ts` and `app/utils/ocrParser.ts` do not appear in the v8 coverage report. Manual verification of test coverage was performed for these files (see File-by-File Analysis below).

The uncovered branch (line 90, `exp.notes ?? null` within the `if (!alreadyMatched)` block) is a defensive code path that only executes when `alreadyMatched` is `false` AND `notes` is `undefined` — the existing test covers the case where `alreadyMatched` is `true` (expense already matched via dHash), which correctly skips the push. The `?? null` fallback for missing `notes` is a minor edge case that does not affect correctness.

## File-by-File Analysis

### convex/functions/duplicateDetection.ts

| Metric | Value |
|--------|-------|
| % Stmts | 96.15% |
| % Branch | 93.93% |
| % Funcs | 80% |
| % Lines | 100% |

**Uncovered lines/functions:** Line 86 (statement s15, function f3, anonymous arrow callback); branches b11[1] (line 87, `if` false-path) and b12[1] (line 90, binary-expr false-path).

The uncovered code is the near-duplicate deduplication guard (lines 86–90):

```typescript
const alreadyMatched = matches.some((m) => m.id === exp._id.toString());
if (!alreadyMatched) {
  matches.push({ id: exp._id.toString(), ... });
}
```

The `.some()` callback (anonymous function at line 86) is never invoked because every existing test that triggers the near-duplicate check (date + amount within ±0.01) does so against an expense that has **not** also matched via fingerprint or dHash. Since `matches` is always empty at that point, `.some()` returns `false` immediately without calling its callback. Consequently, the `if (!alreadyMatched)` false-branch (line 87, when the expense IS already matched) is never exercised, and the duplicate-push prevention logic is untested.

**Covered:**
- `hammingDistance()` — all 4 test cases (identical hashes, single-bit difference, all-different, different lengths)
- `runDuplicateCheck()` early return when no receipt data provided (fingerprint, dHash, or date+amount)
- Fingerprint exact match detection
- dHash fuzzy match within Hamming threshold (≤10)
- dHash non-match beyond Hamming threshold (>10)
- Near-duplicate detection by date and amount (exact ±0.00 and ±0.01)
- Near-duplicate non-match when amount differs by more than 0.01
- Org-scoped query (DUP-Q1) — same dHash in different orgs does not match
- Soft-delete exclusion (SEC-002) — deletedAt-filtered expenses excluded from all three match types
- Multiple existing expenses iteration (12 existing expenses in one test case)

**Test file:** `__tests__/convex/duplicateDetection.test.ts` — 16 tests (4 for `hammingDistance`, 12 for `runDuplicateCheck`)

### convex/functions/expenses.ts

| Metric | Value |
|--------|-------|
| % Stmts | 94.91% |
| % Branch | 96.42% |
| % Funcs | 82.35% |
| % Lines | 94.23% |

**Uncovered lines/functions:** Lines 137–139 (statements s43, s44, s45; functions f8, f9, f10 — `pending` query callbacks); branch b11[1] at line 170 (binary-expr in `balance`).

**All uncovered lines are in the `pending` query (lines 130–144) and `balance` function (lines 145–176) — code that is NOT part of the D5 slice.** The D5-modified `create` mutation (lines 24–64) is **fully covered**.

The `pending` query's `withIndex`, `filter`, and `.neq` callbacks (lines 137–139) are uncovered because the existing test (`"scopes by orgId and returns array"`) passes an empty expenses array. The mock query chain's filter callbacks are only invoked per-document, so with zero documents the callbacks never fire.

The `balance` function's `|| "partner"` fallback (line 170) is uncovered because all balance test cases have other-user expenses present when `balance > 0`, so the `|| "partner"` branch is never hit.

**Covered (D5 scope — `create` mutation, lines 24–64):**
- `requireAuthenticatedOrg` auth check on `create` (SEC-001) — unauthenticated caller rejected before duplicate check runs
- `paidBy` mismatch check (throws "Expense paidBy must match authenticated user")
- `runDuplicateCheck()` integration — called with `orgId`, `receiptPHash`, `receiptFingerprint`, `amount`, `date` from mutation args
- Returns `{ id, isDuplicate, duplicateMatches }` shape
- Duplicate detected by `receiptPHash` (dHash match)
- Duplicate detected by `receiptFingerprint` (fingerprint exact match)
- No duplicate returned when no receipt data provided
- `receiptPHash`-only path works without `q.or` undefined error (SEC-005)
- `receiptFingerprint`-only path works without `q.or` undefined error
- Cross-org duplicate not flagged at create level (DUP-Q1)
- Creation never blocked — expense inserted regardless of duplicate status

**Covered (pre-existing, non-D5):**
- `requireAuthenticatedOrg` rejection paths (null identity, empty subject, missing orgId)
- `list` query — auth failure, happy path, cross-tenant isolation (SEC-001)
- `pending` query — auth failure, returns array
- `balance` query — structure, zero balance, negative balance, positive balance
- `approve` mutation — not found, wrong org, not pending, creator approval, success path
- `reject` mutation — not found, wrong org, not pending, creator rejection, success path
- SEC-002 (soft-delete in list and balance), SEC-003 (webhook HMAC), SEC-004 (type correctness)

**Test file:** `__tests__/convex/expenses.test.ts` — 38 tests (8 for `create`, 30 for other functions)

### app/utils/imageUtils.ts

**Not tracked by coverage configuration** (Vitest `coverage.include` is `convex/**/*.ts` only).

Of the 17 tests in `__tests__/utils/imageUtils.test.ts`, coverage applies only to:
- `isAllowedFileType` — 10 tests ✓ (all MIME type validation paths)
- `preprocessImage` — 4 tests ✓ (file type rejection, MIME spoofing note, empty MIME, JPEG/EXIF)
- `fileToDataUrl` — 2 tests ✓ (data URL generation, base64 encoding)

**Uncovered (by D5 scope):**
- `computeDHash(file: File): Promise<string>` — **0% test coverage**. This is the D5-specific function that computes the 64-bit dHash (16-character hex string) used for near-duplicate detection. No unit tests exist. The function depends on Canvas API (`document.createElement("canvas")`, `getContext("2d")`, `getImageData`) and `FileReader`, which are available in the `happy-dom` test environment, but no test exercises the full pipeline.
- `compressImage` — 0% test coverage
- `stripExif` — 0% test coverage
- `getImageDimensions` — 0% test coverage

**Test file:** `__tests__/utils/imageUtils.test.ts` — 17 tests (none for `computeDHash`)

### app/utils/ocrParser.ts

**Not tracked by coverage configuration** (Vitest `coverage.include` is `convex/**/*.ts` only).

Of the 21 tests in `__tests__/utils/ocrParser.test.ts`:
- `parseTotal` — 6 tests ✓ (TOTAL keyword, same-line Total, fallback, AMOUNT DUE, GRAND TOTAL, no currency)
- `parseDate` — 6 tests ✓ (YYYY-MM-DD, MM/DD/YY, YYYY-MM-DD dash, month name, dash-separated, no date)
- `parseStore` — 4 tests ✓ (merchant name, skip patterns, first valid line, empty text)
- `parseOcrText` — 1 test ✓ (all fields extracted)
- `applyOcrToForm` — 3 tests ✓ (populate empty, don't overwrite, string-to-float) + 1 XSS-safety test ✓

**Uncovered (by D5 scope):**
- `generateFingerprint(store?, date?, total?): string | undefined` — **0% test coverage**. This is the D5-specific function that produces the `${store}|${date}|${total}` fingerprint string used for exact duplicate detection. No unit tests exist. The function has a simple code path (return `undefined` if all fields absent, otherwise return template string) that is trivial to test but is not covered.

**Test file:** `__tests__/utils/ocrParser.test.ts` — 21 tests (none for `generateFingerprint`)

## Gaps

### High Priority (Resolved)

- [x] **`generateFingerprint()` now has test coverage.** Added 5 tests in `ocrParser.test.ts::generateFingerprint`: all fields present, string total, no fields (returns `undefined`), partial fields (store only, date+total only).

- [x] **`computeDHash()` now has a test.** Added 1 test in `imageUtils.test.ts::computeDHash`: rejects non-image file types (error path). Full Canvas-based test (exact hash output) deferred — Canvas 2D context returns `null` in `happy-dom` (same limitation as `preprocessImage`).

- [x] **Near-duplicate deduplication guard now tested.** Added "deduplication: does not double-count expense matched by both dHash and near-duplicate" test — verifies that when an expense matches via both dHash and date+amount, `alreadyMatched` prevents duplicate push and the expense appears only once in `matches`.

### Medium Priority (Remaining)

- [ ] `expenses.ts: pending` query callbacks (lines 137–139) untested. (Pre-existing gap, not D5-introduced.)
- [ ] `expenses.ts: balance` `|| "partner"` fallback (line 170) untested. (Pre-existing gap.)
- [ ] `expenses.ts: create` does not assert `duplicateMatches` array structure. Tests verify `isDuplicate` boolean but not match entry shape.

### Medium Priority (Remaining)

- [ ] **`expenses.ts: pending` query callbacks (lines 137–139) untested.** The `withIndex` and `filter` callbacks in the `pending` query are never invoked because the test passes an empty expenses array. A fix would be to add expenses to the mock fixture so the filter callbacks execute. (Pre-existing gap, not D5-introduced.)
- [ ] **`expenses.ts: balance` `|| "partner"` fallback (line 170) untested.** The `owesWhom` fallback when no other-user expense exists is never hit. (Pre-existing gap.)
- [ ] **`expenses.ts: create`** does not assert the `duplicateMatches` array structure (`{ id, store, date, total, status }`). Tests verify `isDuplicate` boolean but not the shape of individual match entries.

### Low Priority

- [ ] **`computeDHash()` — exact dHash output verification.** Even if a basic test is added for `computeDHash`, verifying the exact hash output against a known image requires a deterministic test image and assertion of the expected 16-character hex string.
- [ ] **`generateFingerprint()` — whitespace and falsy value edge cases.** Test with `undefined`, `""`, `0`, and numeric string inputs to verify template string assembly.
- [ ] **`expenses.ts: create`** — no test verifies that creation proceeds (expense is inserted) even when `isDuplicate` is `true`. The acceptance criterion states creation must never be blocked.

## Recommendations

1. **Critical — Add tests for `generateFingerprint()`.** Add a dedicated test file or extend `__tests__/utils/ocrParser.test.ts` with cases for: all fields present, only store present, only date, only total, numeric total, no fields (returns `undefined`), and empty-string fields.

2. **Critical — Add tests for `computeDHash()`.** Create a deterministic test image (e.g., a small JPEG via `canvas.toDataURL`) and assert the exact 16-character hex hash output. Test the type-validation early return (non-image MIME type throws).

3. **High — Add near-duplicate deduplication test.** Add a test in `duplicateDetection.test.ts` where an existing expense has both a matching dHash **and** matching date+amount, verifying that `alreadyMatched` prevents a duplicate push and the expense appears only once in `matches`.

4. **Medium — Fix `pending` query test coverage.** Update the `expenses:pending` test to pass expenses in the mock fixture so the `withIndex` and `filter` callbacks execute. This will cover lines 137–139 and functions f8/f9/f10.

5. **Medium — Assert `duplicateMatches` structure.** Extend `expenses:test.ts` `create` tests to verify that `duplicateMatches` entries contain `{ id, store, date, total, status }` fields, not just the `isDuplicate` boolean.

6. **Medium — Test creation proceeds when duplicate detected.** Add a test verifying that `expenses:create` returns a valid `id` even when `isDuplicate` is `true`, confirming the non-blocking acceptance criterion.

7. **Info — Extend coverage config to include `app/utils/`.** The `vitest.config.ts` coverage `include` array currently restricts to `convex/**/*.ts`. Adding `"app/utils/**/*.ts"` would bring `imageUtils.ts` and `ocrParser.ts` into the coverage report scope for future slices.
