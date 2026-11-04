# Happy House Bills — Development Index

**Project:** Happy House Bills
**Status:** Active — Phase 1: MVP
**Last updated:** 24-October-2026

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
| P0 | Email notifications (Resend) | `tech-specs/backend/email-notifications.md` | 03-ready-for-review | Ready for review |
| P0 | CI/CD (GitHub Actions) | `tech-specs/architecture/ci-cd.md` | 01-draft | Not started |
| P0 | Mobile browser compatibility | `tech-specs/frontend/mobile-compat.md` | 01-draft | Not started |
| P0 | < 10 min deploy time | `tech-specs/architecture/deployment.md` | 01-draft | Not started |
| P0 | Advanced features & enhancements | `tech-specs/advanced-features.md` | 01-draft | Not started |

## Review Queue

Active reviews are tracked in [`supporting-docs/reviews/README.md`](supporting-docs/reviews/README.md).

## Slices in Review

| Slice | Phase | Lifecycle folder | Owner | Status |
|-------|-------|-----------------|-------|--------|
| D7 — Email Notifications | Phase 2 | 04-implemented | backend-engineer | Implemented |

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
