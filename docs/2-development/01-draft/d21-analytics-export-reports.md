---
status: Draft
package: app
priority: high
created: 11-November-2026
updated: 11-November-2026
tags: [analytics, export, reports, phase4]
lifecycle: 01-draft
---

# Slice D21: Analytics Export & Custom Reports

**Date:** 11-November-2026
**Status:** Draft
**Phase:** Phase 4 (Post-MVP Expansion)

## 1. Purpose

Implement export capabilities and a custom report builder for analytics data, completing the D15 acceptance criteria items marked "planned for Phase 4" and enabling users to download, share, and schedule financial reports.

## 2. Scope

### In scope

- Export analytics data to CSV, JSON, and PDF formats
- Custom report builder: select metrics, date range, filters (category, status, member), grouping
- Scheduled reports: daily/weekly/monthly email delivery via Resend
- Report templates: Monthly Summary, Category Breakdown, Settlement History, Budget Variance
- Export from AnalyticsDashboard and InsightsPanel components
- Report history: list of generated reports with download links (stored in R2, 90-day retention)
- API endpoints for programmatic access (Convex HTTP actions)

### Out of scope

- Real-time dashboard updates (websocket push — separate slice)
- Advanced statistical modeling (regression, forecasting beyond linear)
- Embedded BI / external tool connectors (Tableau, PowerBI)
- Multi-currency reports (v1 USD only)

## 3. Key Decisions

| ID | Decision | Rationale | Source |
|----|----------|-----------|--------|
| D1 | CSV/JSON/PDF as core formats | CSV for spreadsheets, JSON for APIs, PDF for sharing | D15 spec |
| D2 | Reports stored in R2 with signed URLs | Consistent with receipt storage; secure, expiring links | D4 file storage |
| D3 | Scheduled reports via Convex cron + Resend | Server-side generation; no client needed at send time | D7 email, D16 monitoring |
| D4 | Report builder as modal in AnalyticsDashboard | Progressive disclosure; power users only | UX principle |
| D5 | 90-day retention for generated reports | Balance storage cost vs audit needs | GDPR Article 5 |

## 4. Open Questions

| ID | Question | Status | Notes |
|----|----------|--------|-------|
| P4-Q1 | PDF generation: client-side (jsPDF) or server-side (Convex + puppeteer)? | Open | Server-side more reliable; client-side no infra |
| P4-Q2 | Support custom date ranges beyond presets? | Open | Presets: MTD, QTD, YTD, Last 30/90/365 days |
| P4-Q3 | Report sharing: link-only or email attachment? | Open | Links more secure; attachments more convenient |
| P4-Q4 | Maximum report size / row limit for CSV? | Open | Prevent runaway exports; suggest 10k rows |

## 5. Cross-References

- `docs/2-development/04-implemented/d15-advanced-analytics-insights.md` — Base analytics implementation
- `docs/2-development/04-implemented/d7-email-notifications.md` — Email delivery via Resend
- `docs/3-reference/tech-specs/backend/file-storage.md` — R2 storage patterns
- `docs/3-reference/tech-specs/backend/api-contract.md` — HTTP action patterns
- `spec-gaps.md` — gap tracking (ANL-Q3 export capabilities)

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
//    - PDF: HTML template → puppeteer → PDF buffer
// 6. Upload to R2 via @convex-dev/r2, store storageId
// 7. Generate signed URL (7-day expiry), update report record
```

### Frontend Integration

- `app/components/ReportBuilderModal.vue` — stepper: Template → Configure → Format → Schedule
- `app/components/ReportHistoryList.vue` — table with name, type, format, status, created, actions
- `AnalyticsDashboard.vue` — "Export" button opens ReportBuilderModal with current view as defaults
- `InsightsPanel.vue` — "Export Insights" quick action (PDF summary)
- `app/composables/useReports.ts` — reactive report list, generate/schedule/delete actions

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

- Unit: report config validation, CSV/JSON/PDF formatting, query building
- Integration: generate monthly summary → verify CSV rows match expenses
- Scheduled: mock cron → verify report generated + email sent
- PDF: visual regression test (snapshot) for each template
- Permissions: org-scoped, user can only see own reports (or all org reports?)
- Large dataset: 10k expenses → export completes <30s, memory <100MB

## 10. Rollout Plan

1. Add `reports` table + Convex functions → deploy to dev
2. Build ReportBuilderModal + ReportHistoryList components
3. Integrate into AnalyticsDashboard + InsightsPanel
4. Implement PDF generation (decide client vs server)
5. Add scheduled reports cron + email delivery
6. Test with real data in dev
7. Deploy to production

## Lifecycle

- `01-draft` → `02-in-progress`: TBD
- `02-in-progress` → `03-ready-for-review`: TBD
- `03-ready-for-review` → `04-implemented`: TBD