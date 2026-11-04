# Test Strategy: D2 Settlement API

**Status:** Approved
**Scope:** D2 Settlement API (`convex/functions/settlements.ts`, `app/composables/useSettlements.ts`)
**Date:** 2026-10-26
**Owner:** test-engineer
**Source Spec or Plan:** `docs/3-reference/domains/03-settlements/settlement-management.md`

---

## Test Objectives

- Validate that settlement creation enforces auth, org scoping, and input validation before writing to the database.
- Validate that settlement listing is scoped to the authenticated org and respects soft-delete filtering.
- Validate that the `useSettlements` composable correctly projects query data, mutation state, and the `createSettlement` mutation through the `convex-vue` layer.

## Test Matrix

| Level | Behaviour | Fixture or setup | Assertion | Command |
|-------|-----------|------------------|-----------|---------|
| Backend unit | `create` rejects unauthenticated requests | Mock ctx with `getUserIdentity → null` | Rejects with `"Unauthenticated"` | `npm test` |
| Backend unit | `create` rejects `fromUser` not matching authenticated user | Mock ctx with valid identity, `fromUser = "user_2"` | Rejects with `"Can only record settlement from yourself"` | `npm test` |
| Backend unit | `create` rejects non-positive amount | Mock ctx, `amount = 0` and `amount = -50` | Rejects with `"Settlement amount must be positive"` | `npm test` |
| Backend unit | `create` rejects `fromUser === toUser` | Mock ctx, `fromUser === toUser === "user_1"` | Rejects with `"Cannot record settlement to yourself"` | `npm test` |
| Backend unit | `create` succeeds and inserts with orgId, timestamps | Mock ctx with valid identity, valid args | Returns `{ id }`; insert call contains `orgId`, `createdAt`, `updatedAt` | `npm test` |
| Backend unit | `list` rejects unauthenticated requests | Mock ctx with `getUserIdentity → null` | Rejects with `"Unauthenticated"` | `npm test` |
| Backend unit | `list` returns settlements for authenticated org | Mock ctx with valid identity, settlement data | Returns array of settlements | `npm test` |
| Security | Cross-tenant isolation — list returns only current org's settlements | Mock ctx, settlements with `orgId` matching and not matching | Only matching org's records returned | `npm test` |
| Security | Soft-delete filtering — `deletedAt` records excluded from list | Mock ctx, settlements with and without `deletedAt` | Only non-deleted records returned | `npm test` |
| Composable unit | `useSettlements` returns settlements list from query | Mock `useConvexQuery` with data array | `data.value` matches query result | `npm test` |
| Composable unit | `useSettlements` returns `createSettlement` function | Mock `useConvexMutation` | `createSettlement` is a function | `npm test` |
| Composable unit | `useSettlements` reflects `isLoading` from query + mutation | Mock `isPending` values | `isLoading.value` reflects pending state | `npm test` |
| Composable unit | `useSettlements` falls back to `[]` when query data is nullish | Mock `useConvexQuery` with `data.value = undefined` and `null` | `data.value` equals `[]` | `npm test` |

## Coverage Targets

| Area | Target | Rationale |
|------|--------|-----------|
| `convex/functions/settlements.ts` statements | 100% | All code paths exercised by handler tests |
| `convex/functions/settlements.ts` branches | 100% | Every `if` has true and false test cases |
| `app/composables/useSettlements.ts` statements | 100% | All computed refs exercised |
| `app/composables/useSettlements.ts` branches | 100% | Nullish coalescing and `isLoading` OR tested both sides |

## Fixtures and Test Data

- `createMockCtx(user, options?)` — builds a mock Convex ctx with auth and db mocks
- `validIdentity()` — returns a `UserIdentity` with `subject: "user_1"`, `org_id: "org_1"`
- Deterministic user IDs (`user_1`, `user_2`, `org_1`) — no `Math.random()` used

## Failure Handling

- Tests fail on incorrect public behaviour, not implementation details.
- Deterministic fixtures; no `Math.random()`.
- No secrets, tokens, or PII in fixtures or mocks.

## Execution Evidence

| Command | Result | Output path |
|---------|--------|-------------|
| `npx vitest run --coverage` | Exit code 0, 73 passed (0 failed) | `coverage/coverage-final.json` |

## Gaps and Follow-up

None. Both source files achieve 100% statement and branch coverage. The `useSettlements` composable is pure glue (no business logic, no auth, no validation) — its only branch is the `?? []` nullish fallback, which is now tested.

## Approval

| Decision | Approver | Date | Notes |
|----------|----------|------|-------|
| Coverage approved | Pending | — | Awaiting user approval |
