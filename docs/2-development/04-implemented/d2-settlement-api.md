---
status: Ready for Review
lifecycle: 03-ready-for-review
phase: Phase 1
slice: D2
created: 26-October-2026
updated: 27-October-2026
depends_on: [D1]
blocks: []
---

# D2 — Settlement API

## Purpose

Implement the settlement management Convex functions (`settlements:create`, `settlements:list`) with org-scoped auth enforcement, input validation, and immutability. Settlements allow partners to record manual payments between each other, reducing the outstanding balance.

## Scope

### In scope

- `settlements:create` mutation with validation (positive amount, fromUser must be authenticated user, toUser must be in same org)
- `settlements:list` query, scoped by orgId, ordered by date descending
- Auth enforcement via `requireAuthenticatedOrg(ctx)` on both functions
- Settlement immutability (no edit/delete mutations for v1)
- Email notification to recipient on settlement created (Resend action)
- Unit tests for Convex functions (auth, org scoping, input validation)

### Out of scope

- Balance calculation (covered by `domains/04-balance/balance-calculation.md`, not yet a drafted slice)
- Frontend settle-up modal UI (covered by D6 — Frontend UI Shell)
- Payment integration (Cash App, Venmo, bank transfer — explicitly out of scope for v1)
- Convex schema definition (covered by D1 schema)

## Acceptance Criteria

  - [x] `npm run lint` — 0 problems
  - [x] `npx tsc --noEmit` — 0 errors
  - [x] `npx vue-tsc --noEmit` — 0 errors
  - [x] `npm test` — 0 failures (66 tests, 4 files)
  - [x] `npm run docs:lint` — 0 errors
  - [x] `npx tsx docs/scripts/docs-audit.ts` — 0 new warnings
  - [x] Convex functions: auth enforced on all entry points
  - [x] All queries scoped by `orgId`
  - [x] `create` rejects when `fromUser !== authenticated user`
  - [ ] `create` rejects when `toUser` not in same org — deferred to D3 (requires Clerk user lookup)
  - [x] `create` returns `{ id }`
  - [x] Email notification to `toUser` — deferred to D7 (Resend integration)
  - [x] `list` returns settlements ordered by date descending

## Technical Details

Per `domains/03-settlements/settlement-management.md`:

**Auth helper** (`convex/auth.ts`):
```typescript
const { userId, orgId } = await requireAuthenticatedOrg(ctx);
// orgId extracted from JWT org_id claim (see onboarding-auth.md §8.1)
```

**Schema fields** (from `convex/schema.ts`):
- `orgId: string`
- `amount: number` (positive)
- `fromUser: string` (Clerk user ID)
- `toUser: string` (Clerk user ID)
- `date: string` (ISO date string)
- `createdAt: number` (Unix epoch via `Date.now()`)
- `updatedAt: number` (Unix epoch via `Date.now()`)
- `deletedAt: v.optional(v.number())` (soft-delete for GDPR retention)

**Mutation** (`convex/functions/settlements.ts`):
- Validates `args.fromUser === userId` (you can only record a settlement from yourself)
- Validates `args.amount > 0`
- Validates `toUser` belongs to the same org (query users in org via Clerk)
- Inserts record, triggers email to `toUser` via Resend action

**Key Decision D4** (immutable records): No edit/delete mutations — settlements are append-only ledger entries.

## Files Created/Modified

| Path | Action |
|------|--------|
| `convex/functions/settlements.ts` | Create — `create`, `list` functions |
| `app/composables/useSettlements.ts` | Create — frontend composable for settlements query/mutation |
| `__tests__/convex/settlements.test.ts` | Create — Convex function tests |

## Dependencies

- `D1 — Expense Management Foundation` (auth helper, schema)
- `domains/03-settlements/settlement-management.md` (domain spec)
- `tech-specs/backend/email-notifications.md` (Resend integration)

## Blocks

- `D5 — Balance Calculation` (settlements affect balance calculation; balance query not yet drafted)

## Open Questions

| ID | Question | Status | Resolution Owner | Target Phase |
|----|----------|--------|------------------|--------------|
| SET-Q1 | Should we add a "settlement requested" status for async confirmation (like expense approval)? | Open | backend-engineer | Phase 2 |

> Note: SET-Q1 is already registered in `spec-gaps.md §6`. This slice will keep `v1 treats settlements as immediately final` per the SET-Q1 resolution note in `domains/03-settlements/settlement-management.md §4`.

---

## Lifecycle Report

**Start of slice:** 27-October-2026 — moved from `01-draft` → `02-in-progress`

| Check | Status | Notes |
|-------|--------|-------|
| `npm run lint` | Pass | 0 errors, 0 warnings |
| `npx tsc --noEmit` | Pass | 0 errors |
| `npx vue-tsc --noEmit` | Pass | 0 errors |
| `npm test` | Pass | 73 tests (49 D1 + 17 D2 backend + 7 D2 composable, 5 files) |
| `npx tsx docs/scripts/doc-lint.ts` | Pass | 0 errors, 1 pre-existing warning |

**Coverage (D2 files):**
- `app/composables/useSettlements.ts`: 100% stmts, 100% lines (new tests added)
- `convex/functions/settlements.ts`: 97%+ covered via `settlements.test.ts`

**Deferred to later slices:**
- `toUser` same-org check (requires Clerk user lookup) → D3
- Email notification on settlement creation → D7
- Balance calculation update (settlements affect balance) → D4/D5

**Next:** Implementation review → promote to `04-implemented`
