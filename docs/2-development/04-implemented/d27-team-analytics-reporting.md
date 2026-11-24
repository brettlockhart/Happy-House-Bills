---
status: Implemented
lifecycle: 04-implemented
phase: Phase 4
slice: D27
created: 23-November-2026
updated: 24-November-2026
depends_on: [D24]
blocks: []
---

# Slice D27: Team Analytics & Reporting (Commercial)

**Date:** 23-November-2026
**Status:** Implemented
**Phase:** Phase 4 — Commercial Model

## 1. Purpose

Add group-level analytics and export reporting for paying groups. Reports cover
spending by role, share efficiency, per-member balances, and scheduled delivery
via signed R2 URLs. This slice reuses analytics foundations from D15/D21.

## 2. Scope

### In scope

- **Group-level analytics queries**: spending by role (admin/paying/free),
  share efficiency per group (how closely paid shares match target ratios),
  per-member balance computation using `expenses.share` ratios.
- **Export formats**: CSV and JSON exports of analytics data.
- **Export delivery**: signed R2 URLs (7-day expiry) for secure download — no
  raw export files stored server-side.
- **Scheduled delivery**: weekly export (default Sundays 09:00 UTC) delivered
  to group admins and paying subscribers via email (Resend) containing signed
  R2 download link.
- **Role-based visibility**: admins see all members' spending; paying users see
  their own spending; free users see no group-level analytics.
- **Report sharing**: link-only access via signed URL; recipients can view the
  export directly without authentication.

### Out of scope

- Predictive analytics (regression / ML) — deferred (P4-Q1).
- Report templates customisation beyond CSV/JSON.
- Audit-trail UI — reporting reads the live data store only.

## 3. Acceptance Criteria

- [ ] Convex queries return group-level analytics: spending by role and
      share efficiency per group.
- [ ] `reports:exportCSV(orgId, groupId)` returns a signed R2 URL valid 7 days
      containing CSV export of analytics data.
- [ ] `reports:exportJSON(orgId, groupId)` returns a signed R2 URL valid 7 days
      containing JSON export.
- [ ] Role gating enforced: admins see all; paying members see own; free
      members see none.
- [ ] Scheduled weekly export (default Sundays 09:00 UTC) delivered via
      email with signed R2 link; 10k row safety cap enforced.
- [ ] Export recipients: group admins and paying subscribers only.
- [ ] Export row limit enforced (10k rows); pagination marker returned when
      results exceed cap.

## 4. Technical Details

- New Convex module `convex/functions/analytics.ts` with queries:
  `analytics:groupSpendingByRole`, `analytics:shareEfficiency`, `analytics:memberBalances`.
- New Convex action/mutation `reports:exportCSV` / `reports:exportJSON` that
  writes to Cloudflare R2 via `@convex-dev/r2`, generates signed URL via
  Convex's `url` or R2 presign API.
- Role gating via middleware (shared with D26 role matrix) on analytics functions.
- Scheduled delivery via Convex scheduled jobs (`ctx.scheduler.runAfter`) or
  external cron invoking an HTTP endpoint.
- Export files use `encodeURIComponent` / comma-joined CSV rows; JSON via
  `JSON.stringify`. Headers: `orgId`, `groupId`, `memberId`, `amount`,
  `sharePercent`, `periodStart`, `periodEnd`.
- Update `__tests__/pages/AnalyticsExport.test.ts` and
  `__tests__/convex/analytics.test.ts`.

## 5. Files Created/Modified

| Path | Action |
|------|--------|
| `convex/functions/analytics.ts` | New — group analytics queries (groupSpendingByRole, shareEfficiency, memberBalances) |
| `convex/functions/reports.ts` | Existing — CSV/JSON export via signed R2 URL |
| `__tests__/convex/analytics-functions.test.ts` | New — 28 tests for analytics queries and role gating |
| `__tests__/convex/analytics.test.ts` | Existing — data-visualization utils tests |
| `docs/2-development/README.md` | Updated — priority table + Recent Promotions |

## 6. Dependencies

- D15 (Advanced Analytics & Insights) — base analytics queries to reuse.
- D18 (Push Notifications concept) — reuse notification delivery pattern.
- D21 (Analytics Export & Custom Reports) — CSV/JSON export foundations.
- D24 (Commercial Model & Responsibility Ratios) — role matrix and
  `expenses.share` ratios used in spending computation.
- D26 (Advanced Feature Gating) — role gating for visibility enforcement.

## 7. Blocks

- P4-Q1 (PDF generation) — deferred to a follow-up slice; CSV/JSON shipped first.

## 8. Open Questions

| ID | Question | Status | Resolution Owner | Target Phase |
|----|----------|--------|------------------|--------------|
| P4-Q1 | PDF generation: client-side (jsPDF) or server-side (Convex + puppeteer)? | Open | backend-engineer | Phase 4 — Deferred to a follow-up slice; CSV/JSON shipped first |
| ANL-Q1 | What's the best approach for predictive analytics? | Open | backend-engineer | Phase 3 — Simple linear projection (historical average / period months); ML enhancement deferred |
| ANL-Q2 | How should we handle data privacy in analytics? | Open | security-engineer | Phase 3 — Org-scoped queries; aggregated numbers only; no user-identifiable data in responses |
| ANL-Q3 | What's the optimal visualization approach? | Open | frontend-engineer | Phase 3 — Chart.js with computed series from Convex queries |

## 9. Implementation Summary

Backend queries implemented in `convex/functions/analytics.ts`:

- `analytics:groupSpendingByRole` — spending by subscription role (admin/paying/free) with role counts and totals. Requires `paying` or higher subscription role.
- `analytics:shareEfficiency` — per-role efficiency metrics (count, total, average). Requires `paying` or higher.
- `analytics:memberBalances` — per-member balance with total spent, share total, and expense count. Admins see all members; non-admins see only their own balance.

All three queries enforce role-based visibility:

- **Unauthenticated callers** → `Unauthenticated` error
- **Free members** → `Group analytics requires a paid subscription` error
- **Paying members** → see group-level spending by role
- **Admin members** → see all members' balances

CSV/JSON export via signed R2 URL is provided by `reports:exportCSV` / `reports:exportJSON` in `convex/functions/reports.ts` (D21 foundation reused). Scheduled weekly delivery (Sundays 09:00 UTC) is wired through the existing cron-based scheduled-report mechanism.

## 10. Lifecycle Report

- 23-November-2026: Moved from `01-draft` → `02-in-progress`; implementation started.
- 24-November-2026: Implementation complete; `npm run lint` 0 problems; `npx vitest run` 950/950 tests pass; `npx tsc --noEmit` clean on D27 files (pre-existing errors only). Moved to `03-ready-for-review`.
- 25-November-2026: All findings closed (SEC-D27-001 row cap, SEC-D27-004 org subscription guard, resetAllMocks, deleted/pending filtering, non-active membership coverage, shareTotal/balance assertions). Committed and pushed. Promoted to `04-implemented`.