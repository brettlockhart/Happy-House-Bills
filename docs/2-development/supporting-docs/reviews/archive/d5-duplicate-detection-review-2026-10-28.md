---
status: Complete
lifecycle: review
slice: D5
reviewer: implementation-reviewer
verdict: Pass
security_review: in-progress
created: 28-October-2026
updated: 28-October-2026
---

# Implementation Review: D5 — Duplicate Detection

**Verdict:** **Pass** — with follow-up findings tracked

**Slice:** D5 — Duplicate Detection  
**Date:** 28-October-2026  
**Reviewer:** implementation-reviewer  
**Lifecycle:** `03-ready-for-review`  

---

## Slice Summary

| Field | Value |
|-------|-------|
| **Slice** | D5 — Duplicate Detection |
| **Phase** | Phase 1 |
| **Dependencies** | D1 (schema receipt hash fields, `expenses:create` integration), D4 (OCR provides store/date/total for fingerprint) |
| **Blocks** | D6 — Frontend UI Shell (duplicate warnings in AddExpenseModal) |
| **Lifecycle** | `03-ready-for-review` (code complete, tests pass) |
| **Files created** | `convex/functions/duplicateDetection.ts`, `__tests__/convex/duplicateDetection.test.ts` (13 tests) |
| **Files modified** | `convex/functions/expenses.ts` (`create` mutation), `app/utils/imageUtils.ts` (`computeDHash`), `app/utils/ocrParser.ts` (`generateFingerprint`) |

---

## Verification Checks

| Check | Status | Details |
|-------|--------|---------|
| Lint | Pass | `npm run lint` — 0 errors, 0 warnings |
| Typecheck | Pass | `npx nuxt typecheck` — 0 errors |
| Tests | Pass | `npm test` — 158 tests, 10 files, all passing |
| Doc lint | Pass | `npm run docs:lint` — 0 errors |

**Note:** The proposal doc lists `npx tsc --noEmit -p convex` as an acceptance criterion (line 44), but no `convex/tsconfig.json` exists in this project. The reviewer verified via `npx nuxt typecheck` (which covers the Convex function files via tsconfig path resolution) — 0 errors. The acceptance criterion in the proposal doc should be updated to reflect the actual project's type-checking approach.

---

## Specialised Agent Reports

### Security Engineer
Security review is **in progress** per the review queue (`d5-security-review.md` not yet produced). The implementation-reviewer has completed its security-focused findings (see Security Checklist below), but the dedicated security-engineer review should validate the dHash client-side computation deviation (D1) before promotion to `04-implemented`.

### Test Engineer
No test-engineer report filed for D5 (unlike D4 which had a dedicated coverage report). The existing 13 tests in `duplicateDetection.test.ts` and 49 tests in `expenses.test.ts` cover the core logic. Coverage gaps are documented in the Test Coverage section below.

---

## Review: By Criterion

### 1. Auth enforcement on all Convex function entry points — Pass

`runDuplicateCheck` is **not** an exported Convex function (no `mutation`/`query`/`action` wrapper). It is a plain utility function called internally by `expenses:create`. The `create` mutation (the actual Convex entry point) calls `requireAuthenticatedOrg(ctx)` at `expenses.ts:25` as its first statement, extracting `userId` and `orgId` from the JWT. The `requireAuthenticatedOrg` function (`convex/auth.ts:19-38`) is fail-safe: missing identity or missing `org_id` claim throws immediately.

No other Convex function was modified in this slice. The `approve`, `reject`, `list`, `pending`, and `balance` mutations/queries all retain their existing `requireAuthenticatedOrg(ctx)` guards.

### 2. Org-scoping / cross-tenant isolation (DUP-Q1) — Pass

The `orgId` is never read from client input (args). It flows from `requireAuthenticatedOrg(ctx)` → `expenses:create` handler → `runDuplicateCheck(ctx, { orgId, ... })`. The duplicate query at `duplicateDetection.ts:37-45` uses:

```typescript
ctx.db
  .query("expenses")
  .withIndex("by_org", (q) => q.eq("orgId", expense.orgId))
  .filter((q) => q.and(q.eq(q.field("deletedAt"), undefined)))
  .collect()
```

This scopes to the current org only. Cross-org isolation is verified by:
- `duplicateDetection.test.ts:307` — "scopes duplicate check by orgId only" (passing `orgId: "org_other"` returns no matches)
- `expenses.test.ts:550` — SEC-005 "REQUIRES cross-org duplicate detection — same receipt hash in different org not flagged"

DUP-Q1 is resolved in the Open Questions Register (`spec-gaps.md:200`, struck through).

### 3. Soft-delete filtering (SEC-002) — Pass

`runDuplicateCheck` filters out soft-deleted expenses at `duplicateDetection.ts:42`:

```typescript
.filter((q) => q.and(q.eq(q.field("deletedAt"), undefined)))
```

This matches the established pattern used in `expenses.ts` `list`, `pending`, and `balance` functions. Verified by `duplicateDetection.test.ts:327` — "excludes soft-deleted expenses from duplicate check (SEC-002)."

### 4. Test coverage completeness — Pass (with gaps noted)

**Test inventory:** 13 tests in `duplicateDetection.test.ts`:

| Suite | Tests | Coverage |
|-------|-------|----------|
| `hammingDistance` | 4 | Identical hashes (0), single-bit diff (1), all diff (4), different lengths |
| `runDuplicateCheck` | 9 | No data → no matches, empty expenses, fingerprint exact match, dHash within threshold (distance 1), dHash beyond threshold (distance 16), near-duplicate date+amount, amount differs >0.01, org-scoping, soft-delete exclusion |

`expenses.test.ts` adds 6 tests under `expenses:create` (including SEC-005 cross-org and no-false-positive tests), bringing the total passing to 158 across 10 files.

**Coverage gaps (not blocking):**

| Gap | Detail |
|-----|--------|
| dHash boundary test | No test for Hamming distance exactly 10 (should match) or 11 (should not). Tests use distance 1 and 16. |
| `generateFingerprint` untested | `app/utils/ocrParser.ts:185-195` has no unit tests. The function is trivial but untested. |
| `computeDHash` untested | `app/utils/imageUtils.ts:100-146` requires browser Canvas API. No test file exists. |
| Near-duplicate boundary | No test for amount difference of exactly 0.01 (should match). Tests use 0.0 and 4.01 difference. |
| Multiple matches | No test for a scenario where 3+ existing expenses match the same new expense. |

### 5. Code quality — Pass

| Check | Status | Details |
|-------|--------|---------|
| No comments | Pass | No `//` comments in any implementation file (verified via grep) |
| No `@ts-ignore` | Pass | No `@ts-ignore` or `@ts-expect-error` in any implementation file |
| camelCase | Pass | All variables/functions use camelCase; `DHASH_HAMMING_THRESHOLD` uses standard ALL_CAPS constant convention |
| No `Math.random()` | Pass | Not used for IDs (not applicable to this slice) |
| No MD5/SHA-1 | Pass | Not used (dHash is a custom perceptual hash, not a cryptographic hash) |
| `as` casts | Pass | One type assertion at `duplicateDetection.ts:49` (`existing as (Doc<"expenses"> & { _id: Id<"expenses"> })[]`) — acceptable for Convex query return type narrowing |

**Minor style issue:** `duplicateDetection.ts:42` wraps a single predicate in `q.and()` with a trailing comma: `q.and(q.eq(q.field("deletedAt"), undefined),)`. Functionally correct but redundant — the `q.and()` wrapper and trailing comma suggest incomplete refactoring. Lint passes.

### 6. dHash algorithm correctness — Pass (algorithm correct; D1 deviation flagged)

**Algorithm correctness — Pass:**

`computeDHash` (`imageUtils.ts:100-146`):
- ✅ Resizes image to 9×8 via Canvas `ctx.drawImage(img, 0, 0, 9, 8)`
- ✅ Converts to grayscale using luminance formula: `0.299r + 0.587g + 0.114b`
- ✅ Compares adjacent pixels horizontally: for each of 8 rows × 9 columns, compares `pixel[col]` to `pixel[col+1]` → 64 bits
- ✅ Produces 16-character hex string (64 bits / 4 bits per hex char)
- ✅ Follows the dHash v2 algorithm (Wikipedia: difference hash)

`hammingDistance` (`duplicateDetection.ts:102-108`):
- ✅ Uses `Math.max(hashA.length, hashB.length)` to correctly handle different-length hashes
- ✅ Character-level comparison — correct for hex string representation
- ✅ Threshold of `DHASH_HAMMING_THRESHOLD = 10` matches tech spec D3

**Important deviation from Tech Spec D1 — Flagged:**

Tech spec `duplicate-detection.md` D1 states: *"dHash computed server-side (not client-side) — Prevents clients from skipping or spoofing the check; Convex actions have CPU budget for hashing."*

The implementation computes dHash **client-side** via Canvas API and accepts `receiptPHash` as a client-provided mutation argument without server-side verification. This is documented as a deviation in the proposal doc (line 253) with rationale: *"No image processing library installed (sharp/jimp not in deps); client-side Canvas is practical."*

**Security impact assessment:**
- ✅ No cross-tenant data leak — `orgId` is server-derived from JWT
- ✅ No data integrity issue — duplicate detection is a **warning-only** system (D6: "does not block expense creation")
- ⚠️ A client can skip duplicate detection by not sending `receiptPHash`/`receiptFingerprint`
- ⚠️ A client can inject a spoofed hash to trigger false-positive warnings

The security impact is limited to UX (false duplicate warnings), not data exposure. However, the deviation undermines D1's stated security rationale. The security engineer should validate whether client-side computation is acceptable for v1 or whether server-side re-computation is required.

### 7. Near-duplicate fuzzy matching logic — Pass

`runDuplicateCheck` (`duplicateDetection.ts:80-96`) implements:

```typescript
if (
  expense.amount !== undefined &&
  expense.date &&
  exp.date === expense.date &&
  Math.abs(exp.amount - expense.amount) <= 0.01
) {
  const alreadyMatched = matches.some((m) => m.id === exp._id.toString());
  if (!alreadyMatched) {
    matches.push(...)
  }
}
```

- ✅ Same date: `exp.date === expense.date`
- ✅ Amount within ±0.01: `Math.abs(exp.amount - expense.amount) <= 0.01`
- ✅ Deduplication guard: `alreadyMatched` prevents double-counting when an expense matches via fingerprint or dHash first
- ✅ Works for expenses without receipt hashes (manual entries) — the near-duplicate check is independent of `receiptPHash`/`receiptFingerprint`

Test coverage:
- `duplicateDetection.test.ts:264` — exact amount match (45.99 == 45.99) → duplicate ✅
- `duplicateDetection.test.ts:286` — amount differs by 4.01 (>0.01) → not duplicate ✅

---

## Security Checklist

| Control | Status | Evidence |
|---------|--------|----------|
| SEC-001 — Auth on entry points | Pass | `requireAuthenticatedOrg(ctx)` at `expenses.ts:25`; fail-safe rejection when identity or org_id missing |
| DUP-Q1 — Org-scoping/cross-tenant | Pass | `orgId` from JWT (server-trusted); `withIndex("by_org", q.eq("orgId", ...))` at `duplicateDetection.ts:39`; verified by SEC-005 cross-org test |
| SEC-002 — Soft-delete filtering | Pass | `.filter(q => q.and(q.eq(q.field("deletedAt"), undefined)))` at `duplicateDetection.ts:42`; verified by test at `duplicateDetection.test.ts:327` |
| SEC-005 — No false positives | Pass | `expenses.test.ts:537` — single receipt field does not trigger false duplicate; `expenses.ts:89` early-return when no receipt data |
| SEC-005 — Cross-org isolation | Pass | `expenses.test.ts:550` — same receipt hash in different org not flagged |
| No secrets in client code | Pass | No `console.log` of sensitive data; no env var access in duplicate detection functions |
| No MD5/SHA-1 | Pass | dHash is a custom perceptual hash, not a cryptographic hash; no MD5/SHA-1 usage |

---

## Findings

| # | File | Issue | Severity | Resolution |
|---|------|-------|----------|------------|
| 1 | `tech-specs/backend/duplicate-detection.md` D1 | dHash computed client-side instead of server-side, contradicting D1's security rationale ("Prevents clients from skipping or spoofing the check") | Medium | Document in security review; determine if client-side is acceptable for v1 or if server-side re-computation is required |
| 2 | `duplicateDetection.ts:42` | `q.and()` wraps a single predicate with trailing comma — redundant | Low | Simplify to direct `.filter((q) => q.eq(q.field("deletedAt"), undefined))` or remove trailing comma |
| 3 | `duplicateDetection.ts:113, 123, 133` | `store` field in DuplicateMatch populated from `exp.notes` (no `store` field on Expense schema) | Low | Schema lacks a dedicated `store` field; notes is the available substitute. Frontend should not rely on this field showing the actual store name |
| 4 | `duplicateDetection.ts:11` | `status` field included in DuplicateMatch return but not in tech spec return shape §9 (`tech-specs/backend/duplicate-detection.md:165`) | Info | Proposal doc (line 201) includes `status` — aligned with proposal. Tech spec §9 should be updated to match. |
| 5 | `docs/2-development/03-ready-for-review/d5-duplicate-detection.md` | Line 44 lists `npx tsc --noEmit -p convex` as acceptance criterion — no `convex/tsconfig.json` exists | Info | Update to reference `npx nuxt typecheck` (the actual project typecheck) |
| 6 | `duplicateDetection.ts:103` | `hammingDistance` handles different-length hashes (uses `Math.max`) — deviating from tech spec §7 which iterates only `hashA.length` | Positive | Fixes a bug in the spec algorithm where shorter hashes would miss trailing differences |

---

## Test Coverage

| File | Tests | Coverage focus |
|------|-------|----------------|
| `__tests__/convex/duplicateDetection.test.ts` | 13 | hammingDistance (4), runDuplicateCheck (9): fingerprint match, dHash threshold, near-duplicate, org-scoping, soft-delete |
| `__tests__/convex/expenses.test.ts` | 49 | expenses:create integration (6 tests), SEC-002 soft-delete (2), SEC-003 webhook (1), SEC-004 types (1), SEC-005 duplicate detection (2) |
| **Total (all files)** | **158** | 10 files, all passing |

**Test coverage gaps (not blocking):**

| Target | Missing coverage | Recommendation |
|--------|-----------------|----------------|
| `duplicateDetection.ts:102` | dHash boundary (distance 10 = match, 11 = no match) | Add 2 tests for threshold boundary |
| `ocrParser.ts:185` `generateFingerprint` | No unit tests | Add test file `__tests__/utils/ocrParser.fingerprint.test.ts` |
| `imageUtils.ts:100` `computeDHash` | No tests (requires Canvas API) | Add browser-environment test with happy-dom Canvas mock |
| Near-duplicate amount | No boundary test (exactly 0.01 difference) | Add test with amount diff of exactly 0.01 |

---

## Summary

The D5 — Duplicate Detection implementation is complete and all verification gates pass (lint 0 errors, typecheck 0 errors, 158 tests passing, doc-lint 0 errors). The core duplicate detection logic is correct:

- `runDuplicateCheck` queries expenses scoped by the server-derived `orgId` via JWT, excludes soft-deleted records via `deletedAt` filter, and runs three checks: fingerprint exact match, dHash fuzzy match (Hamming ≤ 10), and near-duplicate date+amount match (±0.01).
- The dHash algorithm follows the correct perceptual hashing approach (9×8 grayscale, adjacent pixel comparison, 64-bit hex output) and the `hammingDistance` function correctly handles different-length hashes (fixing a bug in the spec's algorithm).
- The `expenses:create` mutation integrates `runDuplicateCheck`, returns `{ id, isDuplicate, duplicateMatches }`, and never blocks creation.

**Key findings for follow-up:**
1. The `store` field in match results maps to `exp.notes` (no dedicated `store` field exists on the Expense schema — this is a D1 schema concern).
2. Test coverage has boundary gaps (dHash threshold at 10, near-duplicate amount at exactly 0.01, no utility function tests for `computeDHash`/`generateFingerprint`).
3. The dHash client-side computation deviates from tech spec D1's security rationale — the security engineer should evaluate whether this is acceptable for v1.

The dHash client-side deviation is the most significant item, but it is a documented design decision with limited security impact (warning-only system, server-enforced org-scoping). It does not block promotion.

---

## Handoff Options

| Option | Trigger | Next Action |
|--------|---------|-------------|
| Promote to implemented | Verdict = Pass | Run `/slice-promote D5` |
| Security evaluation | Before merge | Security engineer to complete `d5-security-review.md` — validate D1 client-side dHash deviation |
| Test coverage | Follow-up | Add boundary tests for dHash threshold (10/11), near-duplicate amount (exactly 0.01), and utility tests for `computeDHash`/`generateFingerprint` |
| Tech spec alignment | Follow-up | Update `duplicate-detection.md` §9 return shape to include `status` field; update acceptance criteria in proposal doc to use `npx nuxt typecheck` |
| Dead code cleanup | Follow-up | Remove redundant `q.and()` wrapper + trailing comma at `duplicateDetection.ts:42` |
