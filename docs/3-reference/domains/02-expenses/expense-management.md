---
status: Draft
package: app
priority: high
created: 25-October-2026
updated: 25-October-2026
tags: [expenses, management, approval-workflow, convex, backend]
---

# Domain Spec: Expense Management

**Date:** 25-October-2026
**Status:** Draft
**Audience:** Backend engineers, frontend engineers

## 1. Purpose

Define the expense management domain: how expenses are created (manual entry and OCR pre-fill), listed, approved, and rejected. Each expense is scoped to a Clerk organisation (household) and follows a pending → approved/rejected workflow.

## 2. Scope

### In scope

- Expense creation: `expenses:create` mutation with full input validation
- Expense listing: `expenses:list` query, ordered by date desc, filtered by orgId
- Pending expenses: `expenses:pending` query (for partner confirmation UI)
- Approval: `expenses:approve` mutation (sets status to approved, sets approvedBy)
- Rejection: `expenses:reject` mutation (sets status to rejected, sets approvedBy and rejectReason)
- Field validation: amount (positive number), date (ISO string), category (groceries/utilities/other)
- Duplicate detection trigger during creation
- Receipt image attachment (optional storage ID)

### Out of scope

- Convex schema definition (covered by `tech-specs/backend/data-model.md`)
- API contract / function signatures (covered by `tech-specs/backend/api-contract.md`)
- Receipt upload and storage mechanics (covered by `tech-specs/backend/file-storage.md`)
- OCR field extraction (covered by `tech-specs/frontend/ocr-pipeline.md`)
- Duplicate detection algorithm (covered by `tech-specs/backend/duplicate-detection.md`)
- Auth / org scoping logic (covered by `domains/01-auth/onboarding-auth.md`)

## 3. Key Decisions

| ID | Decision | Rationale | Source |
|----|----------|-----------|--------|
| D1 | Status workflow: pending → approved / rejected (no edit after approval) | Once a partner approves, the expense is locked to prevent disputes; rejection allows re-entry with a reason | `project_brief.md` (## Acceptance Criteria) |
| D2 | Only approved expenses count toward balance | Prevents one-sided expense recording from skewing the balance; pending expenses require confirmation | `project_brief.md` (## Acceptance Criteria) |
| D3 | Expense creation triggers duplicate detection automatically | User may not notice a duplicate; the warning surfaces at submission time | `user-flows.md` (## 2. Receipt Upload & OCR) |
| D4 | `paidBy` is a Clerk user ID (not a display name) | User IDs are stable; display names may change | `lexicon.md` — Paid by |
| D5 | Category is a union of three literals (no free text) | Simplifies analytics; matches the "No categories beyond groceries / utilities / other" Non-Goal | `convex/schema.ts` |
| D6 | `rejectReason` is optional but recommended | Some rejections don't need explanation (e.g. accidental entry); but a reason helps prevent repeat mistakes | `project_brief.md` (## Non-Goals) |

## 4. Open Questions

| ID | Question | Status | Notes |
|----|----------|--------|-------|
| BB-Q1 | Should `expenses:list` return a cap or pagination? | Open | v1 has ≤2 users per household; list is small. Revisit if scale grows. |
| EXP-Q1 | Should users be able to re-open a rejected expense, or must they create a new one? | Resolved | v1: create new. Rejected history stays intact; no re-open workflow needed. |

## 5. Cross-References

- `convex/schema.ts` — `expenses` table, status field, `paidBy`/`enteredBy`/`approvedBy` fields
- `tech-specs/backend/data-model.md` — field types, status workflow, receipt hash fields
- `tech-specs/backend/api-contract.md` — `expenses:create`, `expenses:approve`, `expenses:reject`, `expenses:list`, `expenses:pending` function signatures
- `tech-specs/backend/duplicate-detection.md` — duplicate detection called during `expenses:create`
- `tech-specs/frontend/ui-spec.md` — expense list UI, approval buttons
- `domains/01-auth/onboarding-auth.md` — auth / org scoping
- `domains/04-balance/balance-calculation.md` — approved expenses feed into balance
- `domains/05-receipts/receipt-upload.md` — receipt attachment during creation
- `domains/08-notifications/email-notifications.md` — email notification on expense creation
- `domains/09-ui/ui-spec.md` — expense list row, approval/reject inline buttons
- `spec-gaps.md` — gap tracking

## 6. Implementation Dependencies

- **Depends on:** `data-model.md`, `api-contract.md`, `onboarding-auth.md`, `duplicate-detection.md`
- **Blocks:** `domains/03-settlements/settlement-management.md`, `domains/04-balance/balance-calculation.md`
- **Consumer integration:** Frontend `useExpenses` composable calls `expenses:create` / `expenses:list`; `AddExpenseModal` calls `expenses:create`; `ExpenseRow` triggers `expenses:approve` / `expenses:reject`

## 7. Expense Lifecycle

```
  ┌─────────┐    ┌─────────┐     ┌────────────┐
  │ Pending │ →  │ Approved │   │ Rejected   │
  └─────────┘    └─────────┘   │ └────────────┘
       ↑           (locked)     │  ↑
       └── created by either    │  │ rejectReason required
           member of household  │  └── enteredBy can re-create
                                │
                                └─ Counts toward balance
                                   Only approved expenses
                                   included in balance
```

## 8. Field Validation

```typescript
// Defined in Convex validator (see `tech-specs/backend/api-contract.md` (## 7. API Surface))
export const createExpenseValidator = {
  amount: v.number(),           // positive, max 99999.99
  date: v.string(),             // ISO 8601 date string
  category: v.union(v.literal("groceries"), v.literal("utilities"), v.literal("other")),
  paidBy: v.string(),           // Clerk user ID of payer
  enteredBy: v.string(),        // Clerk user ID of entrant
  orgId: v.string(),            // Derived, not client-supplied
  notes: v.optional(v.string()),
  receiptImageId: v.optional(v.id("_storage")),
  receiptPHash: v.optional(v.string()),
  receiptFingerprint: v.optional(v.string()),
};
```

## 9. Approval / Rejection

```typescript
import { mutation } from "convex/server";
import { v } from "convex/values";

// expenses:approve — partner confirms the expense
export const approve = mutation({
  args: { expenseId: v.id("expenses") },
  handler: async (ctx, args) => {
    const { userId, orgId } = await requireAuthenticatedOrg(ctx);
    const expense = await ctx.db.get(args.expenseId);
    if (!expense || expense.orgId !== orgId) throw new Error("Not found");
    if (expense.enteredBy === userId) throw new Error("Cannot self-approve");
    await ctx.db.patch(args.expenseId, {
      status: "approved",
      approvedBy: userId,
    });
  },
});

// expenses:reject — partner rejects with a reason
export const reject = mutation({
  args: { expenseId: v.id("expenses"), rejectReason: v.string() },
  handler: async (ctx, args) => {
    const { userId, orgId } = await requireAuthenticatedOrg(ctx);
    const expense = await ctx.db.get(args.expenseId);
    if (!expense || expense.orgId !== orgId) throw new Error("Not found");
    if (expense.enteredBy === userId) throw new Error("Cannot self-reject");
    await ctx.db.patch(args.expenseId, {
      status: "rejected",
      approvedBy: userId,
      rejectReason: args.rejectReason,
    });
  },
});
```
