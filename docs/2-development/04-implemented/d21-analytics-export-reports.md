---
status: In Progress
package: app
priority: high
created: 11-November-2026
updated: 15-November-2026
tags: [analytics, export, reports, phase4]
lifecycle: 04-implemented
---

# Slice D21: Analytics Export & Custom Reports

**Date:** 11-November-2026
**Status:** Implemented
**Phase:** Phase 4 (Post-MVP Expansion)

## 1. Purpose

Implement export capabilities and a custom report builder for analytics data, completing the D15 acceptance criteria items marked "planned for Phase 4" and enabling users to download, share, and schedule financial reports.

## 2. Scope

### In scope

- Export analytics data to CSV and JSON formats
- Custom report builder: select metrics, date range, filters (category, status, member), grouping
- Scheduled reports: daily/weekly/monthly email delivery via Resend
- Report templates: Monthly Summary, Category Breakdown, Settlement History, Budget Variance
- Export from AnalyticsDashboard and InsightsPanel components
- Report history: list of generated reports with download links (stored in R2, 90-day retention)
- API endpoints for programmatic access (Convex HTTP actions)

### Out of scope

- Real-time dashboard updates (websocket push — separate slice)
- Advanced statistical modelling (regression, forecasting beyond linear)
- Embedded BI / external tool connectors (Tableau, PowerBI)
- Multi-currency reports (v1 USD only)
- PDF generation (deferred — P4-Q1 unresolved)

## 3. Key Decisions

| ID | Decision | Rationale | Source |
|----|----------|-----------|--------|
| D1 | CSV/JSON as core formats (PDF deferred) | CSV for spreadsheets, JSON for APIs; PDF needs server-side infra | D15 spec |
| D2 | Reports stored in R2 with signed URLs | Consistent with receipt storage; secure, expiring links | D4 file storage |
| D3 | Scheduled reports via Convex cron + Resend | Server-side generation; no client needed at send time | D7 email, D16 monitoring |
| D4 | Report builder as modal in AnalyticsDashboard | Progressive disclosure; power users only | UX principle |
| D5 | 90-day retention for generated reports | Balance storage cost vs audit needs | GDPR Article 5 |

## 4. Open Questions

| ID | Question | Status | Notes |
|----|----------|--------|-------|
| P4-Q1 | PDF generation: client-side (jsPDF) or server-side (Convex + puppeteer)? | **Deferred** | Out of scope for v1; will address in follow-up slice |
| P4-Q2 | Support custom date ranges beyond presets? | **Resolved** | Implemented: custom dateFrom/dateTo fields in config |
| P4-Q3 | Report sharing: link-only or email attachment? | **Resolved** | Links only (signed R2 URLs, 7-day expiry) |
| P4-Q4 | Maximum report size / row limit for CSV? | **Resolved** | 10k row safety cap implemented in backend |

## 5. Cross-References

- `docs/2-development/04-implemented/d15-advanced-analytics-insights.md` — Base analytics implementation
- `docs/2-development/04-implemented/d7-email-notifications.md` — Email delivery via Resend
- `docs/3-reference/tech-specs/backend/file-storage.md` — R2 storage patterns
- `docs/3-reference/tech-specs/backend/api-contract.md` — HTTP action patterns
- `spec-gaps.md` — gap tracking (ANL-Q3 resolved)

## 6. Implementation Dependencies

- **Depends on:** D15 (analytics engine), D7 (email), D4 (R2 storage), D16 (cron for scheduled reports)
- **Blocks:** None (additive feature)
- **Consumer integration:** `AnalyticsDashboard`, `InsightsPanel`, `useAnalytics` composable

## 7. Technical Approach

### Convex Schema Addition: `convex/schema.ts`

```typescript
reports: defineTable({
  orgId: v.string(),
  userId: v.string(),           // creator
  name: v.string(),             // user-defined or template name
  type: v.union(
    v.literal("monthly_summary"),
    v.literal("category_breakdown"),
    v.literal("settlement_history"),
    v.literal("budget_variance"),
    v.literal("custom"),
  ),
  config: v.any(),              // { metrics[], dateRange, filters, grouping, format }
  format: v.union(v.literal("csv"), v.literal("json"), v.literal("pdf")),
  status: v.union(v.literal("generating"), v.literal("ready"), v.literal("failed")),
  storageId: v.optional(v.id("_storage")),  // R2 file
  downloadUrl: v.optional(v.string()),      // signed URL
  expiresAt: v.number(),        // 90 days from creation
  scheduled: v.optional(v.boolean()),
  scheduleCron: v.optional(v.string()),     // cron expression if scheduled
  lastGeneratedAt: v.optional(v.number()),
  createdAt: v.number(),
})
  .index("by_org_user", ["orgId", "userId"])
  .index("by_org_scheduled", ["orgId", "scheduled"])
```

### Convex Functions: `convex/functions/reports.ts`

```typescript
// generateReport: action — builds report data, writes to R2, returns signed URL
// listReports: query — org-scoped, ordered by createdAt desc
// deleteReport: mutation — delete record + R2 file
// scheduleReport: mutation — upsert report with scheduled=true + cron
// unscheduleReport: mutation — set scheduled=false
// getDownloadUrl: query — return signed URL (regenerate if expired)
```

### Report Generation Logic

```typescript
// 1. Build Convex query from config.filters (dateRange, category, status, member)
// 2. Fetch expense/settlement data via existing analytics queries
// 3. Apply config.grouping (by category, by month, by member, by status)
// 4. Compute config.metrics (sum, count, avg, min, max, budget variance)
// 5. Format output:
//    - CSV: headers + rows, UTF-8 with BOM
//    - JSON: { metadata, data: [...] }
//    - PDF: deferred
// 6. Upload to Convex native storage (ctx.storage.store()), store storageId
// 7. Generate signed URL (7-day expiry), update report record
```
```

### Frontend Integration

- `app/components/ReportBuilderModal.vue` — stepper: Template → Configure → Format → Schedule
- `app/components/ReportHistoryList.vue` — table with name, type, format, status, created, actions
- `AnalyticsDashboard.vue` — "Export" button opens ReportBuilderModal with current view as defaults
- `InsightsPanel.vue` — "Export Insights" quick action (CSV/JSON summary)
- `app/composables/useReports.ts` — reactive report list, generate/schedule/delete actions
- `app/composables/useReportBuilder.ts` — builder state (config, format, scheduleCron, reportName, isScheduled, templates)

### Scheduled Reports (Convex Cron)

```typescript
// convex/crons.ts
crons: [
  { function: "internal.functions.reports.generateScheduled", schedule: "0 6 * * *" },  // daily 6am
]
```

- `generateScheduled` internal action: finds all `scheduled=true` reports due, generates each, emails via Resend
- Email template: report attached or download link, summary stats in body

## 8. Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `REPORT_STORAGE_BUCKET` | R2 bucket for reports (can reuse receipts bucket) | No (reuse) |
| `REPORT_RETENTION_DAYS` | Days before auto-delete (default 90) | No |

## 9. Testing

- Unit: report config validation, CSV/JSON formatting, query building
- Integration: generate monthly summary → verify CSV rows match expenses
- Scheduled: mock cron → verify report generated + email sent
- Permissions: org-scoped, user can only see own reports (or all org reports?)
- Large dataset: 10k expenses → export completes <30s, memory <100MB

## 10. Rollout Plan

1. Add `reports` table + Convex functions → deploy to dev
2. Build ReportBuilderModal + ReportHistoryList components
3. Integrate into AnalyticsDashboard + InsightsPanel
4. Add scheduled reports cron + email delivery
5. Test with real data in dev
6. Deploy to production

## Lifecycle

- `01-draft` → `02-in-progress`: 11-November-2026 (implementation started)
- `02-in-progress` → `03-ready-for-review`: 15-November-2026 (implementation complete, tests passing)
- `03-ready-for-review` → `04-implemented`: 15-November-2026 (promoted; manual promotion by user request — `/slice-review` command unavailable in environment)

### Lifecycle Report — 15-November-2026

**Backend (complete):**
- `convex/schema.ts` — added `reports` table with indexes
- `convex/functions/reports.ts` — implemented: `listReports`, `generateReport`, `deleteReport`, `scheduleReport`, `unscheduleReport`, `getDownloadUrl`, `generateScheduled` (internal action for cron)
- R2 storage via Convex native `ctx.storage.store()` / `getUrl()` (not @convex-dev/r2 — consistent with `uploadReceipt.ts`)
- Signed URLs with 7-day expiry, 90-day retention
- 15 backend tests in `d11-advanced-features.test.ts` — all passing

**Frontend (complete):**
- `app/components/ReportBuilderModal.vue` — 4-step modal (Template → Configure → Format → Schedule)
- `app/components/ReportHistoryList.vue` — report table with Download/Delete actions
- `app/components/AnalyticsDashboard.vue` — Export button wired to ReportBuilderModal
- `app/components/InsightsPanel.vue` — Export Insights button wired to ReportBuilderModal
- `app/composables/useReports.ts` — reactive queries/mutations for reports
- `app/composables/useReportBuilder.ts` — builder state (config, format, schedule, templates)

**Tests (all passing — 723 total):**
- 5 tests: ReportBuilderModal (renders, close, step navigation, export button)
- 5 tests: ReportHistoryList (empty state, table, download/delete, opening state)
- AnalyticsDashboard tests updated with ReportBuilderModal mock
- All existing tests unaffected

**Open Questions Resolved:**
- P4-Q1: PDF deferred to follow-up slice
- P4-Q2: Custom date ranges implemented (dateFrom/dateTo)
- P4-Q3: Link-only sharing via signed R2 URLs (7-day expiry)
- P4-Q4: 10k row safety cap implemented

**Documentation Updated:**
- `docs/3-reference/spec-gaps.md` — ANL-Q3 struck through (resolved)
- `docs/2-development/README.md` — D21 row updated to `03-ready-for-review`