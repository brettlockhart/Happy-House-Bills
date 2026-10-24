---
status: Draft
package: convex
priority: high
created: 23-October-2026
updated: 23-October-2026
tags: [backend, schema, data-model, convex]
---

# Tech Spec: Data Model

**Date:** 23-October-2026
**Status:** Draft
**Audience:** Backend engineers

## 1. Purpose

Define the Convex schema for Happy House Bills: the `expenses` and `settlements` tables,
their indexes, and the multi-tenancy `orgId` scoping pattern. Every table row is scoped to
exactly one Clerk organisation (household), ensuring partners can only see their own
expenses and settlements.

## 2. Scope

### In scope

- Convex `defineSchema` with `expenses` and `settlements` tables
- `orgId` field on every table (Clerk organisation ID)
- Indexes: `by_org`, `by_org_date`
- Field types and validators using Convex `v.` validators
- Receipt fields: `receiptImageId`, `receiptPHash`, `receiptFingerprint`
- Status workflow: `pending` → `approved` / `rejected`

### Out of scope

- Convex function implementations (covered by `tech-specs/backend/api-contract.md`)
- R2 component configuration (covered by `tech-specs/backend/file-storage.md`)
- Clerk auth middleware wiring (covered by `domains/01-auth/onboarding-auth.md`)

## 3. Key Decisions

| ID | Decision | Rationale | Source |
|----|----------|-----------|--------|
| D1 | Use Convex built-in document store (no raw SQL) | Tech brief §3 specifies Convex; document store eliminates SQL injection surface | `project_brief.md` |
| D2 | Every table has `orgId: string` at the top level (no nested objects) | Enables index-based scoping at every query boundary | `project_brief.md` |
| D3 | Receipt hashes stored as fields on the expense, not a separate table | Keeps duplicate detection within a single query; avoids cross-table joins which Convex does not support efficiently | `project_brief.md` §125 |
| D4 | Derived balance is computed at query time, not stored | Guarantees consistency; eliminates stale-balance race conditions | `project_brief.md` §86-91 |

## 4. Open Questions

| ID | Question | Status | Notes |
|----|----------|--------|-------|
| (none) | — | — | — |

## 5. Cross-References

- `tech-specs/backend/api-contract.md` — Convex function implementations
- `tech-specs/backend/duplicate-detection.md` — dHash and fingerprint usage
- `domains/01-auth/onboarding-auth.md` — org scoping enforcement
- `spec-gaps.md` — gap tracking
- `user-flows.md` — how queries are consumed in flows

## 6. Implementation Dependencies

- **Depends on:** None (foundational schema)
- **Blocks:** `api-contract.md`, `duplicate-detection.md`
- **Consumer integration:** All Convex queries/mutations reference the schema types

## 7. Schema

```typescript
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  expenses: defineTable({
    orgId: v.string(),
    amount: v.number(),
    date: v.string(),
    category: v.union(
      v.literal("groceries"),
      v.literal("utilities"),
      v.literal("other")
    ),
    paidBy: v.string(),
    notes: v.optional(v.string()),
    receiptImageId: v.optional(v.id("_storage")),
    receiptPHash: v.optional(v.string()),
    receiptFingerprint: v.optional(v.string()),
    status: v.union(
      v.literal("pending"),
      v.literal("approved"),
      v.literal("rejected")
    ),
    enteredBy: v.string(),
    approvedBy: v.optional(v.string()),
    rejectReason: v.optional(v.string()),
    createdAt: v.string(),
  })
  .index("by_org", ["orgId"])
  .index("by_org_date", ["orgId", "date"]),

  settlements: defineTable({
    orgId: v.string(),
    amount: v.number(),
    fromUser: v.string(),
    toUser: v.string(),
    date: v.string(),
    createdAt: v.string(),
  })
  .index("by_org", ["orgId"]),
});
```

## 8. Balance Derivation

```
balance = (sum of approved expenses paid by A) + (sum of settlements A→B)
        - (sum of approved expenses paid by B) - (sum of settlements B→A)
```

Positive = A owes B. Negative = B owes A. This is never stored — computed at query time.
