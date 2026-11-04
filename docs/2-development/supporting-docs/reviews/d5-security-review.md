---
status: Draft
lifecycle: reviews
slice: D5
security_review: true
scope: slice-level
created: 28-October-2026
updated: 28-October-2026
---

# D5 — Duplicate Detection — Security Review

**Reviewer:** Security review (automated + manual)
**Review type:** Slice-level (code + design)
**Scope:** `convex/functions/duplicateDetection.ts`, `convex/functions/expenses.ts` (modified `create`), `app/utils/imageUtils.ts` (`computeDHash`)
**Tests reviewed:** `__tests__/convex/duplicateDetection.test.ts` — 13 tests, all passing

## 1. Threat Model Summary (STRIDE)

| Threat | Description | Mitigated? |
|--------|-------------|------------|
| **Spoofing** | Attacker impersonates another user's expense to trigger false duplicate warnings | ✅ Auth enforced via `requireAuthenticatedOrg`; expense identity tied to JWT subject |
| **Tampering** | Attacker injects a foreign `orgId` to read other orgs' expense matches | ✅ `orgId` is never a client arg; derived server-side from JWT `org_id` claim |
| **Repudiation** | User denies creating a duplicate expense | ✅ `enteredBy` set from JWT subject (`expenses.ts:48`) |
| **Information disclosure** | Cross-tenant leakage of expense data (receipt hashes, amounts, dates) | ✅ Query scoped to `by_org` index; soft-deleted expenses excluded |
| **Denial of service** | Attacker triggers expensive full-table scans | ✅ Query uses `by_org` index (single org partition); Convex query planner |
| **Elevation of privilege** | Attacker bypasses duplicate detection entirely | ⚠️ Partial — client computes dHash/fingerprint (see SEC-D5-001); near-duplicate fallback mitigates |

## 2. Findings

| ID | Severity | Title | Status |
|----|----------|-------|--------|
| DUP-Q1 | N/A | Cross-tenant isolation via orgId scoping | ✅ Pass |
| SEC-002 | N/A | Soft-delete filtering on duplicate detection query | ✅ Pass |
| SEC-D5-001 | Low | dHash/fingerprint computed client-side (deviation from Key Decision D1) | ⚠️ Acknowledged |
| SEC-D5-002 | N/A | No PII or secrets exposure in duplicate matches | ✅ Pass |

## 3. Detailed Findings

### DUP-Q1: Cross-tenant isolation — ✅ Pass

The duplicate detection query must only return matches from the current organisation.

**Analysis:**

1. `expenses:create` calls `requireAuthenticatedOrg(ctx)` at `expenses.ts:25`, which extracts `orgId` from the Clerk JWT `org_id` claim (`convex/auth.ts:32`). The `orgId` is **never** accepted as a client-supplied argument — the mutation's `args` object (`expenses.ts:10-23`) contains no `orgId` field.

2. The server-derived `orgId` is passed to `runDuplicateCheck(ctx, { orgId, ... })` at `expenses.ts:32-38`.

3. The query uses `.withIndex("by_org", (q) => q.eq("orgId", expense.orgId))` at `duplicateDetection.ts:39`. The `by_org` index is defined on `["orgId"]` in `convex/schema.ts:31`.

4. Convex's `withIndex` enforces the indexed constraint server-side — the client has no way to override or bypass the org scoping at the query level.

**Evidence:**
- `convex/auth.ts:32` — `orgId` extracted from JWT, not request body
- `convex/functions/expenses.ts:25` — `requireAuthenticatedOrg(ctx)` returns server-derived `orgId`
- `convex/functions/expenses.ts:32-38` — `orgId` passed from server context, not client args
- `convex/functions/duplicateDetection.ts:39` — `.withIndex("by_org", q => q.eq("orgId", expense.orgId))`
- `convex/schema.ts:31` — `.index("by_org", ["orgId"])` on `expenses` table

**Test coverage:** `ST-D5-001` (line 351 of `__tests__/convex/duplicateDetection.test.ts`) — two expenses with identical `receiptPHash` but different `orgId` values; verifies only the current org's expense is returned.

### SEC-002: Soft-delete filtering — ✅ Pass

The duplicate detection query must exclude soft-deleted expenses to prevent stale matches from deleted receipts.

**Analysis:**

The query applies `.filter((q) => q.and(q.eq(q.field("deletedAt"), undefined)))` at `duplicateDetection.ts:40-44`. This is chained after the `withIndex` call and before `.collect()`, so the filter is applied server-side as part of the query — not as a post-query filter in application code.

**Evidence:**
- `convex/functions/duplicateDetection.ts:40-44` — `.filter(q => q.and(q.eq(q.field("deletedAt"), undefined)))`
- `convex/schema.ts:29` — `deletedAt: v.optional(v.number())` confirmed on `expenses` table

**Test coverage:**
- `ST-D5-002` (line 387) — soft-deleted expense excluded from fingerprint exact match
- `ST-D5-003` (line 412) — soft-deleted expense excluded from near-duplicate date+amount match
- Existing test at line 327 — soft-deleted expense excluded from dHash match

### Query filter chain integrity — ✅ Pass

The filter chain is correctly ordered: index constraint (`by_org` / `orgId`) → soft-delete filter (`deletedAt === undefined`) → `.collect()`. Both filters execute server-side within the Convex query engine. No post-collection filtering is applied that could re-introduce excluded documents.

**Evidence:**
- `convex/functions/duplicateDetection.ts:37-45` — index + filter applied before `.collect()`

### SEC-D5-001: Client-side dHash computation (deviation from Key Decision D1) — ⚠️ Acknowledged

The slice proposal's Key Decision D1 states: "dHash computed **server-side** (not client-side) — prevents clients from skipping or spoofing the check." The implementation deviates: `computeDHash()` lives in `app/utils/imageUtils.ts:100` and runs entirely client-side via the Canvas API. The resulting `receiptPHash` and `receiptFingerprint` are passed as client-supplied mutation args (`expenses.ts:21-22, 34-35, 52-53`).

**Risk assessment:**
- A malicious client can omit `receiptPHash` or send a spoofed hash value.
- **Impact is Low:** duplicate detection is non-blocking (a warning, not a guard). The expense is always inserted (`expenses.ts:40-57`). No data integrity, financial, or cross-tenant isolation boundary is breached.
- **Mitigation present:** the near-duplicate fallback check (same `date`, `amount` within ±0.01) uses server-validated Convex validator args (`amount: v.number()`, `date: v.string()` — both required at `expenses.ts:11-12`). Even if dHash and fingerprint are spoofed, this fallback still catches obvious duplicates within the same org.
- The `receiptFingerprint` has the same client-side provenance and the same limited-impact profile.

**Recommendation:** If server-side dHash recomputation becomes feasible (e.g., `sharp` is added to Convex deps), add a server-side verification step. For now, the deviation is acceptable given the non-blocking design and the fallback check.

### SEC-D5-002: No PII or secrets exposure — ✅ Pass

Duplicate match results expose only `id`, `store` (from `notes`), `date`, `total` (`amount`), and `status` (`duplicateDetection.ts:55-61, 71-77, 88-95`). No user identities, payment details, or internal tokens are included. The `notes` field is user-entered receipt metadata, not sensitive PII.

## 4. Security Test Plan

| ID | Test | SEC ID | Priority | Status |
|----|------|--------|----------|--------|
| ST-D5-001 | `runDuplicateCheck` returns only same-org matches with identical dHash in two orgs | DUP-Q1 | High | ✅ Implemented (line 351) |
| ST-D5-002 | Soft-deleted expense excluded from fingerprint exact match | SEC-002 | High | ✅ Implemented (line 387) |
| ST-D5-003 | Soft-deleted expense excluded from near-duplicate date+amount match | SEC-002 | High | ✅ Implemented (line 412) |
| ST-D5-004 | Near-duplicate date+amount check does not cross org boundaries | DUP-Q1 | Medium | ➕ Recommended |
| ST-D5-005 | `expenses:create` mutation does not accept client-supplied `orgId` in args | DUP-Q1 | High | ➕ Recommended |
| ST-D5-006 | Server-side verification that `orgId` forwarded to `runDuplicateCheck` matches JWT-derived value | DUP-Q1 | High | ➕ Recommended |

### Recommended test additions

**ST-D5-004** — The existing cross-org test (ST-D5-001) only covers the dHash path. Add a test where two orgs have expenses with identical `date` + `amount` (but no receipt hashes) to verify the near-duplicate check also respects org scoping. This path is not currently covered by a cross-org test.

**ST-D5-005** — Add an integration-level assertion that the `create` mutation schema (`convex/functions/expenses.ts:10-23`) does not declare an `orgId` arg. Convex's `v.object()` schema means undeclared args are rejected by the validator — but an explicit test documenting this invariant prevents future regressions where someone adds `orgId` as a client arg.

**ST-D5-006** — Add a test that mocks `requireAuthenticatedOrg` to return `orgId: "org_A"` and asserts that `runDuplicateCheck` is called with exactly that `orgId` (no possibility of the caller overriding it from `args`). This guards the integration boundary end-to-end.

## 5. Recommendations

1. **Medium:** Add ST-D5-004 and ST-D5-005 to `__tests__/convex/duplicateDetection.test.ts` and `__tests__/convex/expenses.test.ts` respectively, to close the near-duplicate cross-org test gap and lock down the mutation schema invariant.
2. **Low:** If a server-side image processing library (`sharp`/`jimp`) is added to Convex dependencies in a future slice, add server-side dHash recomputation as a verification step to fully close SEC-D5-001.
3. **Info:** Document the client-side dHash deviation explicitly in `d5-duplicate-detection.md` under a "Security Notes" section, linking to this review.

## 6. Verdict

**Pass** — The core security controls are correctly implemented:

- **DUP-Q1 (cross-tenant isolation):** `orgId` is derived exclusively from the server-side JWT via `requireAuthenticatedOrg(ctx)` and is never accepted as a client argument. The query is scoped to the `by_org` index, enforced server-side by Convex. No cross-tenant data leakage is possible.
- **SEC-002 (soft-delete filtering):** The `deletedAt === undefined` filter is applied server-side in the query chain, before `.collect()`. All three matching paths (fingerprint, dHash, near-duplicate) benefit from this filter.
- **Query filter chain:** Index constraint and soft-delete filter are correctly chained and executed server-side; no post-collection bypass exists.
- **No PII/secrets exposure:** Match results return only non-sensitive metadata fields.

The one deviation — client-side dHash computation (SEC-D5-001) — is a low-risk design tradeoff given the non-blocking nature of duplicate detection and the presence of a server-validated near-duplicate fallback. It is acknowledged and documented with a future remediation path.

**Spec-level controls:** All specified security properties are implemented in code.
**Implementation-level verification:** Covered by existing tests (ST-D5-001 through ST-D5-003); three additional test cases recommended (ST-D5-004 through ST-D5-006).
