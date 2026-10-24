---
status: Draft
package: convex
priority: high
created: 23-October-2026
updated: 23-October-2026
tags: [backend, api, convex, expenses, settlements]
---

# Tech Spec: API Contract

**Date:** 23-October-2026
**Status:** Draft
**Audience:** Backend engineers, frontend engineers

## 1. Purpose

Define the full Convex function API surface for Happy House Bills: mutations, queries, and
actions. Each function enforces `orgId` scoping from the authenticated Clerk session and
validates inputs with Convex `v.` validators.

## 2. Scope

### In scope

- All Convex mutations: `expenses:create`, `expenses:approve`, `expenses:reject`,
  `settlements:create`
- All Convex queries: `expenses:list`, `expenses:balance`, `expenses:pending`,
  `settlements:list`
- All Convex actions: `expenses:uploadReceipt`
- Input validation schemas for every function
- Auth enforcement at every function entry point

### Out of scope

- Convex schema definition (covered by `tech-specs/backend/data-model.md`)
- R2 storage mechanics (covered by `tech-specs/backend/file-storage.md`)
- Email notification triggering (covered by `tech-specs/backend/email-notifications.md`)
- Duplicate detection implementation (covered by `tech-specs/backend/duplicate-detection.md`)

## 3. Key Decisions

| ID | Decision | Rationale | Source |
|----|----------|-----------|--------|
| D1 | Use Convex `v.` validators (not Zod) for all function inputs | Convex's native validator system auto-generates types and is the idiomatic approach | `project_brief.md` §93-95 |
| D2 | `orgId` derived from `auth.getUserId()` context, never from client | Prevents cross-tenant data access; auth context is server-trusted | `project_brief.md` §29 |
| D3 | `uploadReceipt` is an action (not a mutation) | Actions can make external API calls (R2); mutations cannot | `project_brief.md` §113-115 |
| D4 | Email notifications dispatched via Convex scheduler | Decouples notification delivery from the user-facing mutation path | `project_brief.md` §172 |

## 4. Open Questions

| ID | Question | Status | Notes |
|----|----------|--------|-------|
| BB-Q1 | Should `expenses:list` return a cap or pagination? | Open | v1 has ≤2 users, list is small; revisit if scale grows |
| BB-Q2 | Should `expenses:balance` return a numeric value or a structured object? | Open | Structured object is more self-documenting; numeric is simpler for v1 |

## 5. Cross-References

- `tech-specs/backend/data-model.md` — table and index definitions
- `tech-specs/backend/file-storage.md` — R2 upload action
- `tech-specs/backend/email-notifications.md` — notification triggers
- `domains/01-auth/onboarding-auth.md` — auth context wiring
- `spec-gaps.md` — gap tracking

## 6. Implementation Dependencies

- **Depends on:** `data-model.md`
- **Blocks:** Domain specs for expenses, settlements, balance
- **Consumer integration:** All frontend composables call these functions via `@convex-dev/react` hooks

## 7. API Surface

### Mutations

| Function | Input | Description |
|----------|-------|-------------|
| `expenses:create` | `{ amount, date, category, paidBy, notes?, receiptImageId?, receiptPHash?, receiptFingerprint? }` | Creates a pending expense; runs duplicate detection |
| `expenses:approve` | `{ expenseId }` | Sets status to `approved`, sets `approvedBy` |
| `expenses:reject` | `{ expenseId, rejectReason }` | Sets status to `rejected`, sets `approvedBy` and `rejectReason` |
| `settlements:create` | `{ amount, fromUser, toUser, date }` | Records a settlement between two members |
| `orgs:create` | `{ name, userEmail }` | Creates a Clerk organisation during onboarding |

### Queries

| Function | Output | Description |
|----------|--------|-------------|
| `expenses:list` | `Expense[]` | Returns all expenses for the org, ordered by date desc |
| `expenses:balance` | `{ balance: number, owesWhom: string }` | Returns the computed balance |
| `expenses:pending` | `Expense[]` | Returns only pending expenses for the partner's confirmation UI |
| `settlements:list` | `Settlement[]` | Returns all settlements for the org |

### Actions

| Function | Input | Description |
|----------|-------|-------------|
| `expenses:uploadReceipt` | `{ image: string (base64) }` | Uploads to R2 via `@convex-dev/r2`, returns storage ID |

## 8. Auth Enforcement

Every function begins:

```typescript
const identity = getAuthUser(ctx);
if (!identity) throw new Error("Unauthenticated");
const orgId = identity.org_id;
```

Queries filter all data by `.withIndex("by_org", (q) => q.eq("orgId", orgId))`.
