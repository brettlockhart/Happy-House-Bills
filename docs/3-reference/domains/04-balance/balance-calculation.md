---
status: Draft
package: app
priority: high
created: 25-October-2026
updated: 25-October-2026
tags: [balance, calculation, real-time, convex, subscriptions]
---

# Domain Spec: Balance Calculation

**Date:** 25-October-2026
**Status:** Draft
**Audience:** Backend engineers, frontend engineers

## 1. Purpose

Define the balance calculation domain: how the net amount one partner owes another is computed from approved expenses and settlements. The balance is **derived at query time** (never stored), ensuring it is always consistent.

## 2. Scope

### In scope

- Balance derivation formula from approved expenses and settlements
- Real-time subscription via Convex reactive queries
- `expenses:balance` query returns `{ balance: number, owesWhom: string }`
- Balance direction: positive = A owes B, negative = B owes A (where A is "you" and B is the "partner")
- Balance updates in real-time when expenses are approved/rejected or settlements are recorded

### Out of scope

- Convex schema definition (covered by `tech-specs/backend/data-model.md`)
- Expense/settlement CRUD (covered by `domains/02-expenses/expense-management.md`, `domains/03-settlements/settlement-management.md`)
- API contract / query signatures (covered by `tech-specs/backend/api-contract.md`)
- UI rendering of balance (covered by `tech-specs/frontend/ui-spec.md`)

## 3. Key Decisions

| ID | Decision | Rationale | Source |
|----|----------|-----------|--------|
| D1 | Balance is computed at query time, not stored | Guarantees consistency; eliminates stale-balance race conditions | `tech-specs/backend/data-model.md` D4 |
| D2 | Only approved expenses count toward balance | Pending/rejected expenses require partner confirmation before affecting the balance | `domains/02-expenses/expense-management.md` D1, D2 |
| D3 | Settlements offset the balance directly | A settlement from A→B reduces what A owes B by the settlement amount | `lexicon.md` — Balance |
| D4 | Real-time updates via Convex reactive queries | Convex automatically pushes updates to subscribed clients; no polling needed | `project_brief.md` (## Acceptance Criteria — real-time balance) |
| D5 | `owesWhom` is a user label, not a raw user ID | Frontend displays "You owe Sam $20" — needs a human-readable label | `tech-specs/frontend/ui-spec.md` (## 12. Responsive Behaviour) |

## 4. Open Questions

| ID | Question | Status | Notes |
|----|----------|--------|-------|
| BB-Q2 | Should `expenses:balance` return a numeric value or a structured object? | Open | Structured object (`{ balance, owesWhom }`) is more self-documenting; numeric is simpler. BB-Q2 registered in `spec-gaps.md`. |

## 5. Cross-References

- `convex/schema.ts` — amounts on `expenses` and `settlements` tables
- `tech-specs/backend/data-model.md` — ## 8. Balance Derivation formula
- `tech-specs/backend/api-contract.md` — `expenses:balance` query
- `tech-specs/frontend/ui-spec.md` — ## 12. Responsive Behaviour (responsive layout)
- `domains/02-expenses/expense-management.md` — approved expenses contribute to balance
- `domains/03-settlements/settlement-management.md` — settlements offset balance
- `spec-gaps.md` — gap tracking, Open Questions Register

## 6. Implementation Dependencies

- **Depends on:** `data-model.md`, `api-contract.md`, `expense-management.md`, `settlement-management.md`
- **Blocks:** `ui-spec.md` D4 (balance display), `domains/09-ui/ui-spec.md`
- **Consumer integration:** Frontend `useBalance` composable subscribes to `expenses:balance`; UI renders balance in header

## 7. Balance Formula

```
household_balance(userA, userB) =
  Σ(approved expenses paid by A) + Σ(settlements A→B)
  - Σ(approved expenses paid by B) - Σ(settlements B→A)
```

- **Positive result** = userA owes userB
- **Negative result** = userB owes userA

Where:
- "userA" = the currently authenticated user ("you")
- "userB" = the other household member ("partner")

## 8. Balance Query Implementation

```typescript
import { query } from "convex/server";

export const balance = query({
  args: {},
  handler: async (ctx) => {
    const { userId, orgId } = await requireAuthenticatedOrg(ctx);

    // Fetch all approved expenses for this org
    const expenses = await ctx.db
      .query("expenses")
      .withIndex("by_org_date", (q) => q.eq("orgId", orgId))
      .filter((q) => q.eq(q.field("status"), "approved"))
      .collect();

    // Fetch all settlements for this org
    const settlements = await ctx.db
      .query("settlements")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect();

    // Determine the partner's user ID
    // (In v1, each org has exactly 2 members; we identify the other one)
    const expensePaidByA = expenses
      .filter((e) => e.paidBy === userId)
      .reduce((sum, e) => sum + e.amount, 0);
    const expensePaidByB = expenses
      .filter((e) => e.paidBy !== userId)
      .reduce((sum, e) => sum + e.amount, 0);
    const settlementsAtoB = settlements
      .filter((s) => s.fromUser === userId)
      .reduce((sum, s) => sum + s.amount, 0);
    const settlementsBtoA = settlements
      .filter((s) => s.toUser === userId)
      .reduce((sum, s) => sum + s.amount, 0);

    const balance =
      expensePaidByA + settlementsAtoB - expensePaidByB - settlementsBtoA;

    // Balance is relative to "you" — positive means you owe partner
    return {
      balance,
      owesWhom: balance > 0 ? "partner" : balance < 0 ? "you" : "none",
    };
  },
});
```
