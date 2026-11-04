---
status: Draft
package: app
priority: high
created: 25-October-2026
updated: 25-October-2026
tags: [settlements, payments, convex, backend]
---

# Domain Spec: Settlement Management

**Date:** 25-October-2026
**Status:** Draft
**Audience:** Backend engineers, frontend engineers

## 1. Purpose

Define the settlement management domain: how partners record manual settlements to reconcile their balance. A settlement is a payment one partner makes to another, recorded as `{ amount, fromUser, toUser, date }` — it does not trigger any external payment system.

## 2. Scope

### In scope

- Settlement creation: `settlements:create` mutation with input validation
- Settlement listing: `settlements:list` query, scoped by orgId
- Field validation: amount (positive number), fromUser/toUser (Clerk user IDs in same household)
- No external payment integration (Cash App, Venmo, bank transfer — out of scope for v1)
- Settlement records are immutable after creation (no edits or deletions in v1)

### Out of scope

- Convex schema definition (covered by `tech-specs/backend/data-model.md`)
- API contract / function signatures (covered by `tech-specs/backend/api-contract.md`)
- Balance calculation (covered by `domains/04-balance/balance-calculation.md`)
- Auth / org scoping logic (covered by `domains/01-auth/onboarding-auth.md`)

## 3. Key Decisions

| ID | Decision | Rationale | Source |
|----|----------|-----------|--------|
| D1 | Settlements are recorded manually (no payment integration) | v1 has no monetisation or payment integration; settlements are a ledger entry only | `project_brief.md` (## Non-Goals) |
| D2 | `fromUser` and `toUser` are Clerk user IDs, not display names | User IDs are stable; display names may change | `lexicon.md` — Settlement |
| D3 | Both `fromUser` and `toUser` must belong to the same org | Prevents cross-household settlements; enforced via orgId check | `data-model.md` D2 (orgId on every table) |
| D4 | Settlement records are immutable | Prevents dispute; settlement is an agreement both partners made | `project_brief.md` (## Non-Goals — no dispute workflow) |
| D5 | Amount must be positive (no negative settlements) | Negative settlements are expressed by swapping fromUser/toUser | `lexicon.md` — Balance |

## 4. Open Questions

| ID | Question | Status | Notes |
|----|----------|--------|-------|
| SET-Q1 | Should we add a "settlement requested" status for async confirmation (like expense approval)? | Open | v1 treats settlements as immediately final; revisit if disputes arise. |

## 5. Cross-References

- `convex/schema.ts` — `settlements` table definition
- `tech-specs/backend/data-model.md` — settlement schema, `by_org` index
- `tech-specs/backend/api-contract.md` — `settlements:create`, `settlements:list`
- `tech-specs/backend/duplicate-detection.md` — settlements are not subject to duplicate detection (no receipt)
- `tech-specs/frontend/ui-spec.md` — settlement list in entry list UI
- `domains/01-auth/onboarding-auth.md` — auth / org scoping
- `domains/02-expenses/expense-management.md` — balance is a function of expenses + settlements
- `domains/04-balance/balance-calculation.md` — settlements offset the balance
- `domains/09-ui/ui-spec.md` — settlement row in entry list
- `spec-gaps.md` — gap tracking

## 6. Implementation Dependencies

- **Depends on:** `data-model.md`, `api-contract.md`, `onboarding-auth.md`
- **Blocks:** `domains/04-balance/balance-calculation.md`
- **Consumer integration:** Frontend `SettleUpModal` calls `settlements:create`; entry list shows settlements chronologically mixed with expenses

## 7. Balance Adjustment via Settlements

```
balance = (sum of approved expenses paid by A) + (sum of settlements A→B)
        - (sum of approved expenses paid by B) - (sum of settlements B→A)
```

A settlement from A→B of amount $50 reduces A's debt by $50 (or makes B owe A $50 if A was ahead). Settlements are always positive amounts; direction is expressed by `fromUser`/`toUser`.

## 8. Settlement Creation

```typescript
import { mutation } from "convex/server";
import { v } from "convex/values";

export const create = mutation({
  args: {
    amount: v.number(),
    fromUser: v.string(),
    toUser: v.string(),
    date: v.string(),
  },
  handler: async (ctx, args) => {
    const { userId, orgId } = await requireAuthenticatedOrg(ctx);

    // fromUser must be the current user (you can't record someone else paying you)
    if (args.fromUser !== userId) {
      throw new Error("Can only record settlement from yourself");
    }

    const id = await ctx.db.insert("settlements", {
      orgId,
      amount: args.amount,
      fromUser: args.fromUser,
      toUser: args.toUser,
      date: args.date,
      createdAt: new Date().toISOString(),
    });

    return { id };
  },
});
```
