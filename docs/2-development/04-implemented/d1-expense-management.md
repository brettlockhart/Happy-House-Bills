---
status: Implemented
lifecycle: 04-implemented
phase: Phase 1
slice: D1
created: 26-October-2026
updated: 27-October-2026
depends_on: [data-model.md, api-contract.md, onboarding-auth.md]
blocks: [D2, D3, D4]
---

# D1 — Expense Management Foundation

## Purpose

Implement the core expense management slice: Convex schema for expenses, `expenses:create`/`expenses:approve`/`expenses:reject`/`expenses:list`/`expenses:pending` functions with auth enforcement, frontend composable `useExpenses`, and the AddExpenseModal component. This is the foundational slice — all other slices depend on it.

## Scope

### In scope

- Convex schema for `expenses` table (all fields per `data-model.md`)
- `expenses:create` mutation with duplicate detection trigger
- `expenses:approve`, `expenses:reject` mutations
- `expenses:list`, `expenses:pending` queries (org-scoped)
- Auth enforcement via `requireAuthenticatedOrg(ctx)` on all functions
- Frontend `useExpenses` composable (Convex reactive subscription)
- `AddExpenseModal` component with form + receipt upload
- Unit tests for Convex functions (auth, org scoping, status workflow)

  | `convex/_generated/server.ts` | Create — stub re-exporting `mutationGeneric`→`mutation`, `queryGeneric`→`query` |
  | `convex/_generated/api.ts` | Create — stub API types for frontend |

- [ ] `npm run lint` — 0 errors
- [ ] `npx tsc --noEmit` — 0 errors
- [ ] `npx vue-tsc --noEmit` — 0 errors
- [ ] `npm test` — 0 failures
- [ ] `npm run docs:lint` — 0 errors
- [ ] `npx tsx docs/scripts/docs-audit.ts` — 0 errors
- [ ] Convex functions: auth enforced on all entry points
- [ ] All queries scoped by `orgId` via index

## Technical Details

Per `tech-specs/backend/api-contract.md`:

**Schema** (`convex/schema.ts`):
```typescript
expenses: defineTable({
  orgId: v.string(),
  amount: v.number(),
  date: v.string(), // ISO date string
  category: v.union(v.literal("groceries"), v.literal("utilities"), v.literal("other")),
  notes: v.optional(v.string()),
  status: v.union(v.literal("pending"), v.literal("approved"), v.literal("rejected")),
  paidBy: v.string(),     // Clerk user ID
  enteredBy: v.string(),  // Clerk user ID
  approvedBy: v.optional(v.string()),
  rejectReason: v.optional(v.string()),
  receiptImageId: v.optional(v.id("_storage")),
  receiptPHash: v.optional(v.string()),
  receiptFingerprint: v.optional(v.string()),
  createdAt: v.number(),
  updatedAt: v.number(),
}).index("by_org", ["orgId"])
 .index("by_org_date", ["orgId", "date"])
 .index("by_receiptImageId", ["receiptImageId"])
```

**Auth** (`convex/auth.ts`):
```typescript
import type { UserIdentity } from "../_generated/server";

export async function requireAuthenticatedOrg(
  ctx: { auth: { getUserIdentity: () => Promise<UserIdentity | null> } }
): Promise<{ userId: string; orgId: string }> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Unauthenticated");
  const userId = identity.subject;
  const orgId = (identity as Record<string, unknown>).org_id as string | undefined;
  if (!userId || !orgId) throw new Error("Unauthenticated or no organisation");
  return { userId, orgId };
}
```

Per `domains/01-auth/onboarding-auth.md` §8.1, the Clerk JWT template must include `org_id: "{{org.id}}"` as a custom claim for multi-tenant isolation.

**Functions** (`convex/functions/expenses.ts`):
- `create` — runs duplicate detection, creates expense with status "pending"
- `approve` — sets status to "approved", sets approvedBy
- `reject` — sets status to "rejected", sets approvedBy + rejectReason
- `list` — returns all expenses for org, ordered by date desc
- `pending` — returns pending expenses where enteredBy !== current user

## Files Created/Modified

| Path | Action |
|------|--------|
| `convex/schema.ts` | Create — expenses table definition with `orgId`, `deletedAt` soft-delete |
| `convex/functions/expenses.ts` | Create — all expenses mutations/queries (create, approve, reject, list, pending, balance) |
| `convex/auth.ts` | Create — auth helper (`requireAuthenticatedOrg` with JWT `org_id` claim extraction) |
| `convex/http.ts` | Create — webhook handler with HMAC-SHA256 signature verification |
| `convex/functions/cleanup.ts` | Create — `cleanupOrganization` scheduled function for org deletion cascade |
| `convex/_generated/server.ts` | Create — stub re-exporting `mutation`/`query`/`internalMutation` |
| `convex/_generated/api.ts` | Create — stub API types for frontend + `internal` export |
| `convex.json` | Modify — added HTTP route for webhook handler |
| `app/composables/useExpenses.ts` | Create — `useBalance`, `useExpenses`, `usePendingExpenses` |
| `app/components/AddExpenseModal.vue` | Create — expense entry modal |
| `app/pages/index.vue` | Create — balance header + AddExpense button |
| `__tests__/convex/expenses.test.ts` | Create — 49 Convex function tests (11 SEC-XXX security tests) |
| `__tests__/composables/useExpenses.test.ts` | Create — composable tests |
| `__tests__/components/AddExpenseModal.test.ts` | Create — component tests |
| `vitest.config.ts` | Create — test + coverage configuration |
| `tsconfig.json` | Modify — added `~/convex/*` path alias |

## Dependencies

- `domains/01-auth/onboarding-auth.md` — auth helper pattern
- `tech-specs/backend/data-model.md` — schema field definitions
- `tech-specs/backend/api-contract.md` — function signatures

## Blocks

- D2 (Settlements) — `settlements:create`
- D3 (OCR) — upload flow
- D4 (Balance) — `expenses:balance` query

## Open Questions

| ID | Question | Status | Resolution Owner | Target Phase |
|----|----------|--------|------------------|--------------|
| BB-Q1 | resolved in spec-gaps.md | Resolved | backend-engineer | Phase 1 |
| BB-Q2 | resolved in spec-gaps.md | Resolved | backend-engineer | Phase 1 |
| EXP-Q1 | resolved in spec-gaps.md | Resolved | backend-engineer | Phase 1 |

---

## Deviations from Original Proposal

| Deviation | Rationale |
|-----------|-----------|
| Auth uses `ctx.auth.getUserIdentity()` instead of `@convex-dev/clerk-auth` | `@convex-dev/clerk-auth` does not exist on npm; using Convex built-in auth API per `docs/AGENTS.md §2` |
| Balance calculation included in D1 (was D4) | `expenses:balance` query is small and needed for frontend; implemented for immediate testability |
| Receipt upload UI deferred to D4 | `ReceiptUploader` component is a D4 deliverable; AddExpenseModal accepts `currentUserId` prop for `paidBy` |
| `createdAt`/`updatedAt` typed as `v.number()` with `Date.now()` | Per `data-model.md`, timestamps are Unix epoch numbers |
| Convex functions import from `../_generated/server` (stub) | Standard Convex pattern; `npx convex dev` generates real `_generated/server.ts` |
| Auth changed from `tokenIdentifier.split("|")[0]` to JWT `org_id` claim | SEC-001 Critical finding: `tokenIdentifier` returns issuer, not org ID. Fixed to use `identity.org_id` from Clerk JWT template custom claim |
| Added `deletedAt` soft-delete to schema + query filters | SEC-002 High finding: GDPR Article 17 retention requires soft-delete. Added `deletedAt` filter on all queries |
| Created `convex/http.ts` webhook handler | SEC-003 Medium finding: webhook verification specified but not implemented. Added HMAC-SHA256 with `CLERK_WEBHOOK_SECRET` |
| Fixed `api.ts` stub types | SEC-004 Medium finding: `createdAt`/`updatedAt` were `string` in stub but `v.number()` in schema. Corrected to `number`. |
| Removed dead `q.true()` fallback | SEC-005 Low finding: unreachable code could mask future regressions. Removed. |

---

## Lifecycle Report

**Start of slice:** 26-October-2026 — moved from `01-draft` → `02-in-progress`
**End of slice:** 27-October-2026 — implementation review complete, promoted to `04-implemented`

| Check | Status | Notes |
|-------|--------|-------|
| `npm run lint` | ✅ Pass | 0 errors, 0 warnings |
| `npx tsc --noEmit` | ✅ Pass | 0 errors (convex + root) |
| `npx vue-tsc --noEmit` | ✅ Pass | 0 errors |
| `npm test` | ✅ Pass | 49 tests, 3 files (was 39) |
| `npx tsx docs/scripts/doc-lint.ts` | ✅ Pass | 0 errors, 1 pre-existing warning |
| `npx tsx docs/scripts/docs-audit.ts` | ✅ Pass | 0 new warnings (26 pre-existing in archived reviews); British English clean |
| Auth enforcement | ✅ Verified | `requireAuthenticatedOrg(ctx)` on all 7 Convex function entry points; orgId from JWT `org_id` claim |
| Org-scoped queries | ✅ Verified | All queries use `by_org` / `by_org_date` index with `orgId` constraint; cross-tenant isolation test (SEC-001) |
| Soft-delete filtering | ✅ Verified | All queries filter `eq(field("deletedAt"), undefined)` — SEC-002 |
| Webhook verification | ✅ Implemented | `convex/http.ts` with HMAC-SHA256 signature verification — SEC-003 |

**Security remediation:** 5 findings resolved (SEC-001 Critical through SEC-005 Low) with code fixes and 11 SEC-XXX test cases. See `docs/2-development/supporting-docs/reviews/d1-security-review.md` and `d1-expense-management-review.md`.

**Implementation review:** Completed — verdict Pass. 6 additional defects found during review and fixed (header access pattern, convex.json array format, scheduler function reference, FunctionReference type constraint, inverted soft-delete filter, mock query chain predicates).

**Pending:** Slice-level security re-review with live Convex deployment (JWT `org_id` claim verification against real Clerk tokens) — tracked as next gate in security review report.
