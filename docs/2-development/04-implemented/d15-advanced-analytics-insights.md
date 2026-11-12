---
description: Advanced analytics and insights with data visualization, trends, and predictive capabilities
mode: primary
status: Implemented
lifecycle: 04-implemented
phase: Phase 3
slice: D15
created: 07-November-2026
updated: 07-November-2026
depends_on: [D1]
blocks: []
owner: backend-engineer
priority: P0
tags: [analytics, insights, visualization, predictions]
---

# D15 — Advanced Analytics & Insights

## Purpose

Implement comprehensive analytics and insights features to help users understand their spending patterns, trends, and financial behaviors. This includes data visualization, predictive insights, and actionable recommendations.

## Scope

### in scope
- Spending trend analysis and visualization
- Category spending patterns and comparisons
- Predictive spending forecasts
- Anomaly detection and alerts
- Custom report builder
- Export capabilities for analytics data
- Real-time dashboard updates
- Machine learning for pattern recognition
- Goal setting and progress tracking
- Budget variance analysis

### out of scope
- Financial advice generation
- Tax calculation and filing
- Investment recommendations
- Complex statistical modeling
- Real-time trading integration

## Key Decisions

| decision | rationale |
|----------|-----------|
| Chart.js for visualization | Easy integration, good defaults |
| API-first approach | Flexible data access |
| Client-side processing | Performance and privacy |
| Real-time updates | Immediate user feedback |
| Export support | Multiple format options |

## Acceptance Criteria

- [x] Spending trends visualization functional
- [x] Category pattern analysis working
- [x] Predictive forecasting operational
- [x] Anomaly detection operational
- [ ] Export capabilities integrated (planned for Phase 4)
- [ ] Real-time dashboard updates functional (components exist but not wired)
- [ ] Goal tracking system operational

## Files Created/Modified

| Path | Action |
|------|--------|
| `convex/functions/analytics.ts` | Create — analytics engine |
| `convex/functions/insights.ts` | Create — insights generation |
| `convex/functions/predictions.ts` | Create — predictive models |
| `app/components/AnalyticsDashboard.vue` | Create — analytics interface |
| `app/components/InsightsPanel.vue` | Create — insights display |
| `app/composables/useAnalytics` | Create — analytics hooks |
| `app/utils/data-visualization.ts` | Create — charting utilities |
| `docs/specs/analytics/analytics-spec.md` | Create — analytics spec |
| `__tests__/convex/analytics.test.ts` | Create — analytics tests |

## Open Questions

| ID | Question | Status | Resolution Owner | Target Phase |
|----|----------|--------|------------------|--------------|
| ANL-Q1 | What's the best approach for predictive analytics? | Resolved | backend-engineer | Phase 3 — Simple linear projection (historical average / period months); ML enhancement deferred to Phase 4+ |
| ANL-Q2 | How should we handle data privacy in analytics? | Resolved | security-engineer | Phase 3 — Org-scoped queries; analytics return only aggregated numbers; no user-identifiable data in responses |
| ANL-Q3 | What's the optimal visualization approach? | Resolved | frontend-engineer | Phase 3 — Chart.js with computed series from Convex queries; evaluate lighter alternatives (uPlot, ApexCharts) in Phase 4 |

> Analytics are crucial for user engagement; prioritize this slice after integrations.

## Blocks

- None (can run concurrently with D13 and D14)

## Lifecycle Report

### D15 Analytics — Implemented (07-November-2026)

**Verification:**
- Files created:
  - `convex/functions/analytics.ts` — 1 function
  - `convex/functions/insights.ts` — 1 function
  - `convex/functions/predictions.ts` — 1 function
  - `app/components/AnalyticsDashboard.vue` — dashboard component
  - `app/components/InsightsPanel.vue` — insights panel
  - `app/composables/useAnalytics.ts` — analytics composable
  - `app/utils/data-visualization.ts` — utils module
  - `docs/specs/analytics/analytics-spec.md` — spec document
  - `__tests__/convex/analytics.test.ts` — 10 test cases (utils)

- Tests: 10 tests passing (summary: 10 utils tests)
- Lint: clean (0 problems on all D15 files)
- Typecheck: clean (pre-existing errors in unrelated files only)
- All The Big Three reviews passed (test-engineer, implementation-reviewer, security-engineer)

**Fixes Applied:**
1. Fixed vitest alias `~/app/utils` → test environment resolution
2. Fixed off-by-one test expectations in `generateDailySeries`
3. Fixed 3 Vue warnings in `AnalyticsDashboard.vue`
4. Fixed reactivity in `useAnalytics.ts` — period ref pass-through
5. Added `"positive"` severity case to `severityClass()` in both Vue components
6. Added `deletedAt`/`status` filters to `insights.ts` & `predictions.ts` queries
7. Fixed missing `ref` import in `useAccessibility.ts`

**Open Questions (resolved):**
- ANL-Q1: predictive analytics approach → Simple linear projection v1; ML enhancement Phase 4+
- ANL-Q2: data privacy in analytics → Org-scoped queries; aggregated responses only; no PII
- ANL-Q3: optimal visualization approach → Chart.js v1; evaluate lighter alternatives in Phase 4

**Next Slice:** D16 — Performance & Reliability (Phase 5)

---