---
status: Draft
package: backend
priority: high
created: 25-October-2026
updated: 25-October-2026
tags: [backend, duplicate-detection, dhash, fingerprint, expenses, convex]
---

# Tech Spec: Duplicate Detection

**Date:** 25-October-2026
**Status:** Draft
**Audience:** Backend engineers, frontend engineers

## 1. Purpose

Define how Happy House Bills detects duplicate receipt submissions within a household. The duplicate detection system uses two complementary strategies: a `dHash` (perceptual hash) of the receipt image to catch near-duplicates (retakes, slight cropping), and a `fingerprint` string (`${store}|${date}|${total}`) to catch exact matches of the same store, date, and amount. Both checks run as part of the expense creation pipeline.

## 2. Scope

### In scope

- `dHash` computation — 64-bit hex string perceptual hash of the receipt image
- `fingerprint` generation — `${store}|${date}|${total}` string from OCR-extracted fields
- Duplicate query in Convex — scans the current org's expenses for matching dHash or fingerprint
- Near-duplicate fuzzy matching — dHash Hamming distance threshold
- Warning response to the frontend — does not block creation, surfaces a confirmation prompt
- Threshold constants and where they are configured

### Out of scope

- OCR field extraction (covered by `tech-specs/frontend/ocr-pipeline.md`)
- R2 image storage mechanics (covered by `tech-specs/backend/file-storage.md`)
- Convex schema field definitions (covered by `tech-specs/backend/data-model.md`)
- Convex mutation API contract (covered by `tech-specs/backend/api-contract.md`)

## 3. Key Decisions

| ID | Decision | Rationale | Source |
|----|----------|-----------|--------|
| D1 | dHash computed server-side (not client-side) | Prevents clients from skipping or spoofing the check; Convex actions have CPU budget for hashing | `project_brief.md` (## 3. Key Features) |
| D2 | Fingerprint generated from OCR-extracted store/date/total | Simple string comparison catches exact duplicates without perceptual hashing overhead | `lexicon.md` — Fingerprint |
| D3 | Hamming distance threshold of 10 for dHash match | Balances false-positive rate (≤ 1%) against false-negative rate for receipt retakes | `lexicon.md` — dHash |
| D4 | Duplicate check runs during `expenses:create`, not before | Must have OCR data available; runs after `uploadReceipt` returns the storage ID | `tech-specs/backend/api-contract.md` (## 7. API Surface) |
| D5 | Warning returns a list of matching expenses with their IDs | Frontend can show the user "you already have this receipt" with the original expense | `user-flows.md` (## 2. Receipt Upload & OCR) |
| D6 | Duplicate detection does not block expense creation | User may intentionally re-scan a receipt for a different expense (e.g. split bill) | `project_brief.md` (## Acceptance Criteria) |

## 4. Open Questions

| ID | Question | Status | Notes |
|----|----------|--------|-------|
| (none) | — | — | — |

## 5. Cross-References

- `convex/schema.ts` — `receiptPHash` and `receiptFingerprint` fields on `expenses` table
- `tech-specs/backend/data-model.md` — schema definition of receipt hash fields
- `tech-specs/backend/api-contract.md` — `expenses:create` mutation (runs duplicate detection)
- `tech-specs/frontend/ocr-pipeline.md` — OCR extraction feeding the fingerprint
- `domains/07-duplicates/duplicate-detection.md` — domain-level workflow
- `spec-gaps.md` — gap tracking

## 6. Implementation Dependencies

- **Depends on:** `data-model.md` (receipt hash fields), `api-contract.md` (expense creation mutation)
- **Blocks:** `domains/07-duplicates/duplicate-detection.md`, `domains/02-expenses/expense-management.md`
- **Consumer integration:** `expenses:create` mutation calls `runDuplicateCheck()`; frontend `useExpenses` composable receives the warning flag

## 7. Algorithm

```typescript
// convex/functions/duplicateDetection.ts

const DHASH_HAMMING_THRESHOLD = 10;
const FINGERPRINT_MATCH = true;

export async function runDuplicateCheck(
  ctx: any,
  expense: {
    orgId: string;
    receiptPHash?: string;
    receiptFingerprint?: string;
  }
): Promise<{ isDuplicate: boolean; matches: Expense[] }> {
  if (!expense.receiptPHash && !expense.receiptFingerprint) {
    return { isDuplicate: false, matches: [] };
  }

  // Query existing expenses in the same org that have receipt hashes
  const existing = await ctx.db
    .query("expenses")
    .withIndex("by_org", (q: any) => q.eq("orgId", expense.orgId))
    .filter((q: any) =>
      q.or(
        q.neq(q.field("receiptPHash"), undefined),
        q.neq(q.field("receiptFingerprint"), undefined)
      )
    )
    .collect();

  const matches: Expense[] = [];

  for (const exp of existing) {
    // Fingerprint exact match
    if (
      FINGERPRINT_MATCH &&
      exp.receiptFingerprint &&
      expense.receiptFingerprint &&
      exp.receiptFingerprint === expense.receiptFingerprint
    ) {
      matches.push(exp);
      continue;
    }

    // dHash fuzzy match (Hamming distance)
    if (
      exp.receiptPHash &&
      expense.receiptPHash &&
      hammingDistance(exp.receiptPHash, expense.receiptPHash) <= DHASH_HAMMING_THRESHOLD
    ) {
      matches.push(exp);
    }
  }

  return { isDuplicate: matches.length > 0, matches };
}

function hammingDistance(hashA: string, hashB: string): number {
  let distance = 0;
  for (let i = 0; i < hashA.length; i++) {
    if (hashA[i] !== hashB[i]) distance++;
  }
  return distance;
}
```

## 8. dHash Computation

The dHash is computed from the receipt image bytes:

```typescript
// Simplified dHash v2 algorithm (64-bit)
// 1. Convert to grayscale
// 2. Resize to 9x8
// 3. Compare adjacent pixels horizontally
// 4. Produce 64-bit hex string

function computeDHash(imageBuffer: Buffer): string {
  // In production, use a native library like sharp
  // This returns a 16-character hex string (64 bits)
  return "a1b2c3d4e5f6a7b8";
}
```

## 9. Duplicate Response Shape

The `expenses:create` mutation returns a duplicate flag alongside the created expense:

```typescript
// Returned by expenses:create
{
  id: Id<"expenses">,
  isDuplicate: boolean,
  duplicateMatches: Array<{
    id: string,
    store: string | null,
    date: string | null,
    total: number | null,
  }>,
}
```
