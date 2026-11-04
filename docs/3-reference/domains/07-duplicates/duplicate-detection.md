---
status: Draft
package: app
priority: high
created: 25-October-2026
updated: 25-October-2026
tags: [duplicates, dhash, fingerprint, detection, expenses]
---

# Domain Spec: Duplicate Detection

**Date:** 25-October-2026
**Status:** Draft
**Audience:** Backend engineers, frontend engineers

## 1. Purpose

Define the duplicate detection domain: how the system identifies when a user is about to record an expense for a receipt that has already been submitted. Two strategies are used — a dHash (perceptual hash) for near-duplicate images, and a fingerprint string (`${store}|${date}|${total}`) for exact matches.

## 2. Scope

### In scope

- dHash computation from receipt image (64-bit hex string)
- Fingerprint generation from OCR-extracted fields (store, date, total)
- Duplicate query: scans the current org's expenses for matching dHash (Hamming distance ≤ 10) or fingerprint (exact match)
- Warning UI: shows "You already have a receipt from this store on this date for this amount"
- Duplicate detection does NOT block expense creation — user can confirm and proceed
- Runs during `expenses:create` mutation (after OCR pre-fill)

### Out of scope

- dHash algorithm implementation (covered by `tech-specs/backend/duplicate-detection.md` (## 9. Duplicate Response Shape))
- Fingerprint query logic (covered by `tech-specs/backend/duplicate-detection.md` (## 7. Algorithm))
- OCR field extraction (covered by `domains/06-ocr/ocr-pipeline.md`)
- R2 receipt storage (covered by `domains/05-receipts/receipt-upload.md`)

## 3. Key Decisions

| ID | Decision | Rationale | Source |
|----|----------|-----------|--------|
| D1 | dHash Hamming distance threshold of 10 | Balances false-positive rate (≤ 1%) against false-negative rate for receipt retakes | `lexicon.md` — dHash |
| D2 | Fingerprint exact match only (no fuzzy store matching) | Fuzzy string matching risks false positives for common store names | `lexicon.md` — Fingerprint |
| D3 | Duplicate detection runs during `expenses:create`, not before upload | Must have OCR fields available; runs after OCR pre-fill | `tech-specs/backend/api-contract.md` |
| D4 | Warning, not block — user can proceed with a "Confirm duplicate" button | Some users intentionally re-scan receipts (e.g. split bills); blocking would cause friction | `user-flows.md` (## 2. Receipt Upload & OCR) |
| D5 | Both dHash and fingerprint are stored on the expense record | Prevents recomputing dHash on every comparison scan | `convex/schema.ts` — `receiptPHash`, `receiptFingerprint` fields |

## 4. Open Questions

| ID | Question | Status | Notes |
|----|----------|--------|-------|
| DUP-Q1 | Should duplicate detection span across all stores or only the current org? | Resolved | Current org only — privacy-preserving; cross-org requires extra trust controls |

## 5. Cross-References

- `convex/schema.ts` — `receiptPHash`, `receiptFingerprint` fields on `expenses` table
- `tech-specs/backend/data-model.md` — ## 3. Receipt Fields, D3 (hash stored on expense)
- `tech-specs/backend/api-contract.md` — `expenses:create` runs duplicate detection
- `tech-specs/backend/duplicate-detection.md` — algorithm, Hamming distance, query logic
- `domains/02-expenses/expense-management.md` — expense creation triggers detection
- `domains/06-ocr/ocr-pipeline.md` — fingerprint comes from OCR-extracted fields
- `spec-gaps.md` — gap tracking

## 6. Implementation Dependencies

- **Depends on:** `duplicate-detection.md` (tech-spec), `expense-management.md`, `ocr-pipeline.md`
- **Blocks:** None (consumed by `expense-management.md` during creation)
- **Consumer integration:** `expenses:create` mutation calls `runDuplicateCheck()`; frontend `useExpenses` receives `isDuplicate` + `duplicateMatches` in the response

## 7. Warning Response

When a duplicate is detected, the `expenses:create` mutation returns:

```typescript
{
  id: Id<"expenses">,
  isDuplicate: boolean,
  duplicateMatches: Array<{
    id: string,
    store: string | null,
    date: string | null,
    total: number | null,
    status: "pending" | "approved" | "rejected",
  }>,
}
```

## 8. User Experience

```ui
Duplicate detected ⚠️

You already have a receipt from Starbucks on Oct 22 for $12.45.

[ View original expense ]  [ Create anyway (confirm) ]  [ Cancel ]
```

When the user clicks "View original expense", the app navigates to the original expense's detail view (or highlights it in the list). When they click "Create anyway", the expense is created normally.
