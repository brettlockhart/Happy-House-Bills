# Security Review Report: D21 Analytics Export & Custom Reports

**Status:** Complete
**Scope:** D21 Analytics Export & Custom Reports
**Date:** 2026-11-16
**Reviewer:** Security Engineer
**Verdict:** Needs revision

---

## Scope and Sensitivity

| Field | Value |
|-------|-------|
| Affected files | `convex/functions/reports.ts`, `convex/schema.ts`, `convex/crons.ts`, `app/composables/useReports.ts`, `app/composables/useReportBuilder.ts`, `app/components/ReportBuilderModal.vue`, `app/components/ReportHistoryList.vue`, `app/components/InsightsPanel.vue`, `app/components/AnalyticsDashboard.vue` |
| Authentication or authorisation | Yes |
| Billing or entitlements | No |
| File upload or export | Yes |
| Iframe, CSP, or preview | No |
| User data or PII | Yes |

## Threat Model

| Asset | Trust boundary | Data flow | Threat | Mitigation | Residual risk |
|-------|----------------|-----------|--------|------------|---------------|
| Report contents (expense, settlement, budget data) | Org boundary (multi-tenant) | DB → `fetchExpenses`/`fetchSettlements`/`fetchBudgets` → CSV/JSON → storage | Cross-org data leakage via missing `orgId` scoping | All queries use `withIndex("by_org", ...)` with `orgId` from authenticated identity (`reports.ts:81,114,135`) | Low — scoping enforced consistently |
| Report ownership | User boundary within org | `ctx.db.get(reportId)` → org/user check → mutation | IDOR: any org member could delete/read another user's report | `generateReport`, `deleteReport`, `unscheduleReport`, `getDownloadUrl` all verify `report.orgId === orgId && report.userId === userId` (`reports.ts:284,391,451,466`) | Low — ownership verified on every operation |
| Report download URL | Storage boundary | `ctx.storage.getUrl(storageId)` → client | URL leakage / indefinite access beyond 90-day retention | Convex native `getUrl()` issues time-limited URLs; `expiresAt` (90d) stored; **not enforced on access** | Medium — no server-side expiry check |
| Stored report blobs | Storage boundary | `ctx.storage.store()` → report record | Orphaned blobs after `deleteReport` (retention not enforced) | `deleteReport` calls `getUrl` (no-op for deletion) instead of `delete()` (`reports.ts:395-401`) | Medium — storage never reclaimed |
| Scheduled reports | Cron boundary (internal) | `generateScheduled` → `internalGenerateReport` → `runReportGeneration` | Unauthorised report generation via unvalidated `scheduleCron` | `generateScheduled` is an internal action (not client-callable); cron expressions validated by `cronMatch` length check | Low — internal-only entrypoint |
| Report config | Client → server | `config: v.any()` → field filters in queries | Config injection into query builder | Config values only feed `q.eq`/`q.gte`/`q.lte` field comparisons (no arbitrary code paths); no dynamic index/table selection | Low — values cannot alter query structure |
| Cron matching | Server (internal) | `scheduleCron` string → `cronMatch` | Incorrect firing (e.g. `*/n` steps ignored) causing unexpected report generation | `cronMatch` treats `*/` prefix as wildcard match (`reports.ts:544-548`); uses UTC getters | Medium — step expressions mis-evaluated |

## Security Checklist

| Control | Status | Evidence |
|---------|--------|----------|
| Authentication enforced at server boundary | Pass | All public mutations/queries call `requireAuthenticatedOrg(ctx)` (`reports.ts:267,281,327,388,423,448,463`); internal functions are not client-callable |
| Authorisation checked per operation | Pass | Ownership verified (`report.orgId !== orgId || report.userId !== userId`) in `generateReport`, `deleteReport`, `unscheduleReport`, `getDownloadUrl` |
| Inputs validated and size-limited | Partial | `v.union`/`v.literal`/`v.string` validators present; `config: v.any()` unbounded; no explicit `scheduleCron` validation beyond `cronMatch` length check; `MAX_REPORT_ROWS` caps query results |
| Output encoded for HTML, CSS, and JavaScript contexts | N/A | Exports are CSV/JSON only (no HTML); `escapeCsv` quotes commas/quotes/newlines (`reports.ts:50-55`); JSON via `JSON.stringify` |
| CSP configured for preview and exports | N/A | No HTML export or preview surface in scope |
| Iframe sandbox and postMessage origin validated | N/A | No iframe usage |
| Secrets absent from client code, logs, and errors | Pass | No secrets in `reports.ts`; storage IDs/URLs are not secrets; no credential logging |
| Rate limits and replay protections configured | Partial | `MAX_REPORT_ROWS` bounds report size; no rate limiting on `createReport` (repeated generation possible) |
| Webhook signatures verified | N/A | No webhooks in scope |
| Dependency findings triaged | Pass | No new dependencies added (native `ctx.storage`, no `@convex-dev/r2`) |

## Findings

| # | File or area | Finding | Severity | Required action |
|---|--------------|---------|----------|-----------------|
| SEC-001 | `convex/functions/reports.ts:395-401` | `deleteReport` does not delete the stored blob — it calls `ctx.storage.getUrl()` (a read) instead of `ctx.storage.delete()`. Report data remains retrievable via the previously generated URL, and orphaned blobs accumulate. The 90-day retention policy is unenforced. | High | Replace `getUrl` with `ctx.storage.delete(storageId as Id<"_storage">)` in a best-effort try/catch. Add a cron-driven purge for reports past `expiresAt`. |
| SEC-002 | `convex/functions/reports.ts:460-478` | `getDownloadUrl` regenerates a signed URL and persists it, but never checks `report.expiresAt`. Expired reports (past 90 days) can still be downloaded indefinitely. | Medium | Check `report.expiresAt > Date.now()` before returning the URL; return an error or delete the report when expired. |
| SEC-003 | `convex/functions/reports.ts:534-551` | `cronMatch` treats any `*/n` step expression as a wildcard match (e.g. `*/15` matches every invocation, not every 15th unit), and does not support ranges/lists (`1-5`, `1,2,3`). Schedules therefore fire on every cron tick (daily 6am) regardless of the intended step. | Medium | Implement proper step/range/list parsing, or document and restrict supported cron syntax; validate `scheduleCron` on `scheduleReport`/`createReport`. |
| SEC-004 | `convex/functions/reports.ts:322,418` | `config: v.any()` accepts arbitrarily large/complex objects, stored verbatim in the report record. Values flow into query field filters; while they cannot change query structure, an oversized config can bloat records and the generated report. | Low | Replace `v.any()` with a typed `v.object({...})` validator for the known `ReportConfig` fields, or cap config size. |
| SEC-005 | `convex/functions/reports.ts:312-362` | `createReport` performs generation synchronously inside the mutation with no rate limit; a user can create many reports in quick succession, each triggering full data scans (up to `MAX_REPORT_ROWS` per table) and storage writes. | Low | Add a simple per-user/per-org rate limit or defer generation to a scheduled action. |
| SEC-006 | `convex/functions/reports.ts:71-77` | `generateSignedUrl` assumes `ctx.storage.getUrl()` returns a time-limited URL. If the Convex deployment serves permanent URLs, the 7-day expiry claim in the spec is unenforced. | Low | Confirm `getUrl()` behaviour for the deployment; if permanent, implement signed URLs with explicit expiry or front the download with an auth-checked redirect. |

## Residual Risk

- **Cross-org isolation** is correctly enforced via `by_org` index + authenticated `orgId` on every read/write path. No cross-tenant leakage path identified.
- **SEC-001/SEC-002 (storage lifecycle)** are the highest-impact gaps: report data can outlive its 90-day retention and survive user-initiated deletion. These should be remediated before the slice is considered complete.
- **SEC-003 (cron semantics)** is a correctness/security hybrid: mis-scheduled reports may generate or email more often than intended, but cannot cross org boundaries.
- Remaining findings are low severity (config validation, rate limiting) and can be addressed post-promotion.

## Approval

| Decision | Approver | Date | Notes |
|----------|----------|------|-------|
| Needs revision | Security Engineer | 2026-11-16 | Address SEC-001 and SEC-002 (storage deletion + expiry enforcement); schedule SEC-003 remediation |

## Next Gate

Implementation: remediate SEC-001 (storage deletion), SEC-002 (expiry enforcement), SEC-003 (cron validation), then re-review.