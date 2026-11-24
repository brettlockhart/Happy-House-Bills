---
title: D27 Team Analytics & Reporting Review
status: Complete
reviewer: implementation-reviewer
date: 25-November-2026
slice: D27
---

# D27 Team Analytics & Reporting — Review Report

## Summary
**Status:** Pass
**Slice:** D27 — Team Analytics & Reporting (Commercial)
**Reviewed:** 24-November-2026
**Re-reviewed:** 25-November-2026
**Reviewer:** implementation-reviewer (inline)

## Scope
This slice implements group-level analytics and export reporting for paying groups:
- Group-level analytics queries: spending by role (admin/paying/free)
- Share efficiency per group (how closely paid shares match target ratios)
- Per-member balance computation using `expenses.share` ratios
- Role-based visibility: admins see all members; paying members see own spending; free users see no group-level analytics
- Export formats: CSV and JSON exports of analytics data via signed R2 URLs (7-day expiry)

## Verification

### Implementation Verification
- `convex/functions/analytics.ts` — added `groupSpendingByRole`, `shareEfficiency`, `memberBalances` queries
- Role gating enforced via `subscriptionRole` middleware on all three queries
- `__tests__/convex/analytics-functions.test.ts` — 43 tests (5 new for D27)

### Security Findings — All CLOSED
- **SEC-D27-001:** Free members see no group-level analytics — enforced by `subscriptionRole` check + org subscription status entitlement; error thrown with upgrade prompt; row cap `MAX_ANALYTICS_ROWS = 10_000` enforced on all analytics queries including `summary`
- **SEC-D27-002:** Admin visibility is explicit — only `subscriptionRole === "admin"` sees all members; non-admins see own data only; status/deletedAt filtering enforced on memberships/expenses
- **SEC-D27-003:** memberBalances attribution uses `enteredBy` (equivalent to `paidBy` enforcement in expense creation); latent ambiguity noted but no misattribution
- **SEC-D27-004:** paid gate trusts `membership.subscriptionRole` with org `subscriptions.status` entitlement check (denies `canceled`/`past_due`/`inactive`); membership sync handles `upgrade` from D25/D26

### Test Results
- `npx vitest run __tests__/convex/analytics-functions.test.ts` → 43/43 passed
- `npx vitest run` → 965/965 passed
- `npm run lint` → 0 errors
- `npx tsc --noEmit` (convex only) → clean

### Outstanding
- PDF generation (P4-Q1) — deferred to a follow-up slice; CSV/JSON shipped first
- Open Questions: P4-Q1 (PDF generation approach), ANL-Q1 (predictive analytics), ANL-Q2 (data privacy), ANL-Q3 (visualization)

### Verdict
Pass. Backend implementation complete and verified. Group-level analytics queries are production-ready with role-based access control.

## Lifecycle

- Moved from `01-draft` → `02-in-progress` → `03-ready-for-review` → `04-implemented` on 25-November-2026
- Doc updated with Implementation Summary (§9) and Lifecycle Report (§10)
- Priority table and Recent Promotions table updated in `docs/2-development/README.md`