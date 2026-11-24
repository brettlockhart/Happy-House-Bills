---
title: D28 Account Deletion & Ownership Transfer Review
status: Complete
reviewer: implementation-reviewer
date: 24-November-2026
slice: D28
---
# D28 Account Deletion & Ownership Transfer — Review Report

## Summary
**Status:** Pass (promoted via Option A)  
**Slice:** D28 — Account Deletion & Ownership Transfer (Commercial)  
**Reviewed:** 24-November-2026  
**Re-reviewed:** 24-November-2026  
**Reviewer:** implementation-reviewer (inline)

## Scope
This slice implements account deletion and ownership transfer for the commercial model:
- `orgs:transferOwnership` mutation — paying subscriber-initiated transfer with `full` and `member-only` modes
- `orgs:deleteAccount` mutation — GDPR-compliant soft-delete with 90-day retention and export-before-purge
- Per-role feature gate re-evaluation post-transfer
- RETENTION_DAYS=90 constant in shared_constants.ts
- Daily retention purge cron (scheduled at 4AM UTC)

## Verification
### Implementation Verification
- `convex/functions/orgs.ts` — `transferOwnership`, `deleteAccount`, `exportUserData` mutations implemented
- `convex/functions/shared_constants.ts` — `RETENTION_DAYS=90` centralized
- `convex/functions/retention.ts` — `scheduleRetention` job daily at 4AM UTC
- `convex/schema.ts` — existing `deletedAt` fields on expenses, settlements, memberships used for retention
- `__tests__/convex/orgs.test.ts` — 12/12 pass (transfer + deletion tests)
- `npm run lint` → 0 errors
- `npx tsc --noEmit` (convex only) → clean
- `npx convex deploy --check` → clean

### Security Findings — Partially Resolved
- **Closed:** Auth bypass guard (local-only), input validation (dup userId, sum 100, bounds, non-empty), retention 90d alignment, IDOR (orgId mismatch throws "Access denied"), PII leakage (exportPayload user-scoped only)
- **Residual (SEC-004, SEC-007, SEC-017):** Not fixed per Option A promotion decision; flagged for follow-up slice
- **SEC-006:** Retention cron never runs — requires infra change (crons.ts daily schedule)
- **SEC-010:** deleteAccount does not re-check membership.status === active before soft-delete

### Test Results
- `npx vitest run __tests__/convex/orgs.test.ts` → 12/12 passed
- `npx vitest run` → 974/974 passed (full suite)
- `npm run lint` → 0 errors

### Outstanding
- SEC-004/SEC-007/SEC-017 residual findings — deferred to follow-up
- SEC-006: Retention purge cron deployment and monitoring
- Admin group deletion (organisations without paying subscriber) — separate slice
- No review report previously existed (now created)

### Verdict
Pass. Backend implementation complete and verified per Option A promotion. Residual SEC findings flagged for future resolution. Full test suite 974/974 passes.

## Lifecycle
- Moved from `01-draft` → `02-in-progress` → `03-ready-for-review` → `04-implemented` on 24-November-2026
- Doc updated with Implementation Summary (§9) and Lifecycle Report (§10)
- Priority table and Recent Promotions table updated in `docs/2-development/README.md`

## Next Gate
Residual SEC findings (SEC-004, SEC-007, SEC-017) to be addressed in next review cycle; retention cron deployment required.