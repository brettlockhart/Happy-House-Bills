# Happy House Bills — Development Index

**Project:** Happy House Bills
**Status:** Active — Phase 1 MVP complete; Phases 3–5 expansion complete
**Last updated:** 22-November-2026

## Overview

Happy House Bills is a web app for couples to track shared household spending, split costs, and settle up. The core value proposition: photo a receipt at the register → expense is logged before you're in the car.

**Stack:** Nuxt 4 (Vue 3, TypeScript) + Convex (backend) + Clerk (auth) + Cloudflare Workers (hosting) + Tesseract.js (OCR) + Resend (email) + R2 (storage)

## Priority Table

| Priority | Feature | Spec | Lifecycle | Status |
|----------|---------|------|-----------|--------|
| P0 | Project scaffolding | `tech-specs/architecture/project-scaffolding.md` | 01-draft | Not started |
| P0 | Convex schema & auth | `tech-specs/backend/data-model.md` | 04-implemented | ✅ D1 complete |
| P0 | Expense CRUD (create, list, approve, reject) | `tech-specs/backend/api-contract.md` | 04-implemented | ✅ D1 complete |
| P0 | Balance calculation | `tech-specs/backend/data-model.md` | 04-implemented | ✅ D1 complete (in expenses.ts) |
| P0 | Clerk org-based auth & onboarding | `domains/01-auth/onboarding-auth.md` | 04-implemented | ✅ D1 + D3 complete |
| P0 | Receipt upload to R2 | `tech-specs/backend/file-storage.md` | 04-implemented | ✅ D4 complete |
| P0 | OCR pipeline (Tesseract.js) | `tech-specs/frontend/ocr-pipeline.md` | 04-implemented | ✅ D4 complete |
| P0 | Duplicate detection | `tech-specs/backend/duplicate-detection.md` | 04-implemented | ✅ D1 complete |
| P0 | Main UI (balance header, action buttons, entry list) | `tech-specs/frontend/ui-spec.md` | 04-implemented | ✅ D6 complete |
| P0 | Email notifications (Resend) | `tech-specs/backend/email-notifications.md` | 04-implemented | ✅ D7 complete |
| P0 | CI/CD (GitHub Actions) | `tech-specs/architecture/ci-cd.md` | 04-implemented | ✅ D8 complete |
| P0 | Mobile browser compatibility | `tech-specs/frontend/mobile-compat.md` | 04-implemented | ✅ D9 complete |
| P0 | < 10 min deploy time | `tech-specs/architecture/deployment.md` | 04-implemented | ✅ D10 complete |
| P0 | Advanced features & enhancements | `tech-specs/advanced-features.md` | 04-implemented | ✅ D11 complete |
| P0 | Expense Categories Enhancement | `docs/2-development/04-implemented/d20-expense-categories-enhancement.md` | 04-implemented | ✅ D20 complete |
| P0 | Mobile-first UI/UX shell | `tech-specs/frontend/mobile-compat.md` | 04-implemented | ✅ D12 complete |
| P0 | Team Workspaces & Collaboration | `tech-specs/teams/team-workspaces.md` | 04-implemented | ✅ D13 complete |
| P0 | Advanced Integrations | `docs/2-development/04-implemented/d14-advanced-integrations.md` | 04-implemented | ✅ D14 complete |
| P0 | Advanced Analytics & Insights | `docs/2-development/04-implemented/d15-advanced-analytics-insights.md` | 04-implemented | ✅ D15 complete |
| P0 | Analytics Export & Custom Reports | `docs/2-development/04-implemented/d21-analytics-export-reports.md` | 04-implemented | ✅ D21 complete |
| P0 | Notification Preferences & Rich Actions | `docs/2-development/04-implemented/d22-notification-preferences-rich-actions.md` | 04-implemented | ✅ D22 complete |
| P0 | Goal Tracking & Budget Variance | `docs/2-development/04-implemented/d23-goal-tracking-budget-variance.md` | 04-implemented | ✅ D23 complete |
| P0 | Commercial Model & Responsibility Ratios | `docs/2-development/04-implemented/d24-commercial-model.md` | 04-implemented | ✅ D24 complete |
| P0 | Stripe Production Integration (D25) | `docs/2-development/04-implemented/d25-stripe-production-integration.md` | 04-implemented | ✅ D25 complete |
| P0 | Advanced Feature Gating (D26) | `docs/2-development/04-implemented/d26-advanced-feature-gating.md` | 04-implemented | ✅ D26 complete |
| P0 | Team Analytics & Reporting (D27) | `docs/2-development/04-implemented/d27-team-analytics-reporting.md` | 04-implemented | ✅ D27 complete |
| P0 | Performance & Reliability | `docs/2-development/04-implemented/d16-performance-reliability.md` | 04-implemented | ✅ D16 complete |

## Review Queue

Active reviews are tracked in [`supporting-docs/reviews/README.md`](supporting-docs/reviews/README.md).

## Slices in Review

| Slice | Phase | Lifecycle folder | Owner | Status |
|-------|-------|-----------------|-------|--------|

## Recent Promotions

| Slice | Promoted | Reviewer | Verdict |
|-------|----------|----------|---------|
| D1 — Expense Management Foundation | 27-October-2026 | implementation-reviewer | Pass |
| D2 — Settlement API | 27-October-2026 | self | Pass |
| D3 — Onboarding Flow | 28-October-2026 | implementation-reviewer | Pass |
| D4 — Receipt Upload & OCR | 28-October-2026 | implementation-reviewer | Pass |
| D5 — Duplicate Detection | 28-October-2026 | implementation-reviewer | Pass |
| D6 — Frontend UI Shell | 29-October-2026 | implementation-reviewer | Pass |
| D7 — Email Notifications | 30-October-2026 | implementation-reviewer | Pass |
| D8 — CI/CD Pipeline | 30-October-2026 | implementation-reviewer | Pass |
| D9 — Mobile Browser Compatibility | 30-October-2026 | implementation-reviewer | Pass |
| D10 — 10-Minute Deployment | 31-October-2026 | implementation-reviewer | Pass |
| D11 — Advanced Features | 03-November-2026 | implementation-reviewer | Pass |
| D12 — Mobile-First UI/UX Shell | 04-November-2026 | implementation-reviewer | Pass |
| D13 — Team Workspaces & Collaboration | 05-November-2026 | implementation-reviewer | Pass |
| D14 — Advanced Integrations | 07-November-2026 | implementation-reviewer | Pass |
| D15 — Advanced Analytics & Insights | 07-November-2026 | implementation-reviewer | Pass |
| D16 — Performance & Reliability | 07-November-2026 | implementation-reviewer | Pass |
| D17 — OpenRouter LLM OCR | 07-November-2026 | implementation-reviewer | Pass |
| D18 — Push Notifications | 08-November-2026 | implementation-reviewer | Pass |
| D19 — Line Item Extraction | 08-November-2026 | implementation-reviewer | Pass |
| D20 — Expense Categories Enhancement | 07-November-2026 | implementation-reviewer | Pass |
| D21 — Analytics Export & Custom Reports | 15-November-2026 | manual promotion (agent) | Complete |
| D23 — Goal Tracking & Budget Variance | 20-November-2026 | implementation-reviewer | Pass |
| D22 — Notification Preferences & Rich Actions | 20-November-2026 | self (agent) | Pass |
| D24 — Commercial Model & Responsibility Ratios | 22-November-2026 | implementation-reviewer | Pass |
| D25 — Stripe Production Integration (D25) | 23-November-2026 | implementation-reviewer | Pass |
| D26 — Advanced Feature Gating | 23-November-2026 | implementation-reviewer | Pass |
| D27 — Team Analytics & Reporting | 24-November-2026 | implementation-reviewer | Pass |
