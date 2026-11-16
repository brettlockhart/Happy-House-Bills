# D21 Analytics Export & Custom Reports — Test Coverage Review

**Date:** 16-November-2026
**Reviewer:** test-engineer (Kilo)
**Slice:** D21 — Analytics Export & Custom Reports
**Files reviewed:** `convex/functions/reports.ts`, `app/composables/useReports.ts`, `app/composables/useReportBuilder.ts`, `app/components/ReportBuilderModal.vue`, `app/components/ReportHistoryList.vue`, `app/components/InsightsPanel.vue`
**Test files reviewed:** `__tests__/convex/d11-advanced-features.test.ts`, `__tests__/components/ReportBuilderModal.test.ts`, `__tests__/components/ReportHistoryList.test.ts`

## Test suite result

`npm test` passes: **723/723 tests**, 48 test files.

The D21-specific test count is:
- `__tests__/convex/d11-advanced-features.test.ts` — 49 tests total; the `reports:D21-export` block contributes 15 report tests.
- `__tests__/components/ReportBuilderModal.test.ts` — 5 tests.
- `__tests__/components/ReportHistoryList.test.ts` — 5 tests.

## Backend coverage audit — `convex/functions/reports.ts`

Coverage status of every exported handler/helper:

| Handler (reports.ts:line) | Type | Covered? | Tests |
|---|---|---|---|
| `listReports` (line 262) | query | **No** | none |
| `generateReport` (line 274) | mutation | **Yes** | unauthenticated (l:468), monthly_summary csv (l:617), budget_variance csv (l:632), settlement_history csv (l:646), category_breakdown json (l:657), report not found (l:668), org mismatch (l:674), user mismatch (l:680) |
| `createReport` (line 310) | mutation | **No** | none. This is the mutation invoked by `useReports.generate` (useReports.ts:25) |
| `deleteReport` (line 383) | mutation | **Partial** | removes report (l:722), wrong org (l:730). Missing: unauthenticated, report not found, wrong user |
| `scheduleReport` (line 406) | mutation | **Partial** | schedules report (l:686). Missing: unauthenticated, wrong user/org |
| `unscheduleReport` (line 443) | mutation | **Partial** | unschedules (l:695), wrong user (l:703). Missing: unauthenticated, wrong org, report not found |
| `getDownloadUrl` (line 458) | mutation | **Partial** | not ready (l:709), returns signed URL when ready (l:715). Missing: unauthenticated, report not found, org/user mismatch |
| `getScheduledReports` (line 478) | internalQuery | **No** | none |
| `internalGenerateReport` (line 485) | internalMutation | **No** | none |
| `generateScheduled` (line 510) | internalAction | **No** | none |
| `cronMatch` (line 532) | helper | **No** | none |

Helper functions partially exercised through `generateReport` tests: `fetchExpenses`, `fetchSettlements`, `fetchBudgets`, `runReportGeneration`, `uploadToStorage`, `generateSignedUrl`, `formatJson`, `formatCsv`, `escapeCsv`. `getCutoffDate` is never directly tested (week/month/quarter/year branches untested).

## Edge-case coverage

Edge cases tested:
- Unauthenticated → `generateReport` only (`requireAuthenticatedOrg` throws "Unauthenticated"). Not tested for `listReports`, `createReport`, `deleteReport`, `scheduleReport`, `unscheduleReport`, `getDownloadUrl`.
- Report not found → `generateReport` only. Not tested for `deleteReport`, `unscheduleReport`, `getDownloadUrl`.
- Org mismatch → `generateReport` and `deleteReport`. Not tested for `unscheduleReport`, `getDownloadUrl`.
- User mismatch → `generateReport` and `unscheduleReport`. Not tested for `deleteReport`, `getDownloadUrl`.
- Report not ready → `getDownloadUrl` (status "generating"). Covered.
- Generation failure → `generateReport` catch sets status "failed" (**not tested**; no test forces `runReportGeneration`/`uploadToStorage`/`generateSignedUrl` to throw).
- PDF format → `buildReportContent` throws "PDF not supported" for every type; `createReport` accepts `pdf`. (**Not tested**.)
- Custom report type → custom branch of `buildReportContent` (**not tested**; only monthly_summary/budget_variance/settlement_history/category_breakdown are exercised).
- Date filtering (`dateRange`/`dateFrom`/`dateTo` in `fetchExpenses`) → **not tested**; all report tests pass `config: {}`.
- Signed URL storage failure → `generateSignedUrl` throw (**not tested**).
- Storage cleanup on `deleteReport` → `ctx.storage.getUrl` best-effort path is invoked but not asserted.

## Frontend coverage audit

| File | Tests | Coverage |
|---|---|---|
| `app/composables/useReports.ts` | none | **0%** — thin wrapper over `client.mutation`/`useConvexQuery`; `generate`, `delete`, `schedule`, `unschedule`, `getDownloadUrl` untested directly |
| `app/composables/useReportBuilder.ts` | none | **0%** |
| `app/components/ReportBuilderModal.vue` | 5 | Renders template step, close on overlay, close on close button, select template → advance, export button on schedule step. **Not tested:** `submitReport`/generate call, `created` emit, back navigation, custom report name path, schedule toggle, `isSubmitting` state/disabled button, `nameError` error state, format-step UI, config custom date-range step |
| `app/components/ReportHistoryList.vue` | 5 | Empty state, table render, download button for ready reports, delete button, opening state while downloading. **Not tested:** loading state, failed/generating status badges, delete emit, multiple reports, download error path (`getDownloadUrl` rejection), `window.open` guard when no URL |
| `app/components/InsightsPanel.vue` | none | **0%** — no test file exists; it embeds `ReportBuilderModal` and uses `useAnalytics` |

## Scheduled cron logic

**Not tested at all.**

- `generateScheduled` (`reports.ts:510`) — the internal action that drives scheduled report generation. The test mock context (`createStorageCtx`) provides no `runQuery`/`runMutation`, and `ctx.runQuery(internal.functions.reports.getScheduledReports, {})` is never exercised.
- `internalGenerateReport` (`reports.ts:485`) — the shared generation routine invoked by the cron path. Not tested.
- `cronMatch` (`reports.ts:532`) — the cron matcher (`*/` step handling, day-of-month, month off-by-one `+ 1`, day-of-week, invalid 4-part cron returning false). Never invoked by any test.
- No test covers a scheduled report whose cron matches `now` being generated, nor a scheduled report whose cron does not match being skipped.

## Gaps remaining

**Critical (uncovered production code paths):**
1. `createReport` — the mutation behind `useReports.generate` — has zero test coverage.
2. `listReports`, `getScheduledReports`, `internalGenerateReport`, `generateScheduled`, `cronMatch` — zero test coverage.
3. `cronMatch` / scheduled-cron execution — explicitly requested by the review scope; untested.

**Authz / not-found edge cases missing across handlers:** unauthenticated for `listReports`/`createReport`/`deleteReport`/`scheduleReport`/`unscheduleReport`/`getDownloadUrl`; report-not-found/org-mismatch/user-mismatch for `deleteReport`/`unscheduleReport`/`getDownloadUrl`.

**Failure paths:** generation failure → status "failed" not tested; PDF format and custom report type not tested; date-range filtering not tested; storage/signed-URL failure not tested.

**Frontend:** `useReports`, `useReportBuilder`, `InsightsPanel` have no tests; `ReportBuilderModal` and `ReportHistoryList` tests cover rendering and basic navigation but not submission, emits, error states, or multiple-report/delete/error paths.

## Verdict

**Test coverage is NOT adequate for D21.** The happy-path report generation (`generateReport`) and a few authz/not-found cases are well covered, but core entry points (`createReport`, `listReports`), the entire scheduled-cron path (`generateScheduled`, `internalGenerateReport`, `cronMatch`), several authz/not-found edge cases, failure paths, PDF/custom-report formats, date filtering, and all three frontend units (`useReports`, `useReportBuilder`, `InsightsPanel`) lack test coverage. The 723/723 pass count reflects existing suite health, not D21 coverage adequacy.
