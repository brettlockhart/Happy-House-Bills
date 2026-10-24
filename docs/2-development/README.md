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
| P0 | Convex schema & auth | `tech-specs/backend/data-model.md` | 01-draft | Not started |
| P0 | Expense CRUD (create, list, approve, reject) | `tech-specs/backend/api-contract.md` | 01-draft | Not started |
| P0 | Balance calculation | `tech-specs/backend/data-model.md` | 01-draft | Not started |
| P0 | Settlement recording | `tech-specs/backend/api-contract.md` | 01-draft | Not started |
| P0 | Clerk org-based auth & onboarding | `domains/02-auth/onboarding-auth.md` | 01-draft | Not started |
| P0 | Receipt upload to R2 | `tech-specs/backend/file-storage.md` | 01-draft | Not started |
| P0 | OCR pipeline (Tesseract.js) | `tech-specs/frontend/ocr-pipeline.md` | 01-draft | Not started |
| P0 | Duplicate detection | `tech-specs/backend/duplicate-detection.md` | 01-draft | Not started |
| P0 | Main UI (balance header, action buttons, entry list) | `tech-specs/frontend/ui-spec.md` | 01-draft | Not started |
| P0 | Email notifications (Resend) | `tech-specs/backend/email-notifications.md` | 01-draft | Not started |
| P0 | CI/CD (GitHub Actions) | `tech-specs/architecture/ci-cd.md` | 01-draft | Not started |
| P0 | Mobile browser compatibility | `tech-specs/frontend/mobile-compat.md` | 01-draft | Not started |
| P0 | < 10 min deploy time | `tech-specs/architecture/deployment.md` | 01-draft | Not started |

## Review Queue

Active reviews are tracked in [`supporting-docs/reviews/README.md`](supporting-docs/reviews/README.md).

## Slices in Progress

| Slice | Phase | Lifecycle folder | Owner | Status |
|-------|-------|-----------------|-------|--------|
| (none yet) | — | — | — | — |

## Recent Promotions

| Slice | Promoted | Reviewer | Verdict |
|-------|----------|----------|---------|
| (none yet) | — | — | — |
