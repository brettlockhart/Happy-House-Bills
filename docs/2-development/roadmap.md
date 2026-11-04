# Implementation Roadmap

**Project:** Happy House Bills
**Status:** Active
**Last updated:** 30-October-2026

Phases are sequential and build on one another. Each phase ends with a concrete milestone
before the next begins. All work follows the doc lifecycle (`01-draft` → `02-in-progress` →
`03-ready-for-review` → `04-implemented`).

---

## Phase 1: MVP — Household Expense Tracker

**Goal:** Ship a working household expense tracker for couples. Users can sign up, create a
household (Clerk organisation), invite their partner, add expenses (manual or via receipt OCR),
approve/reject expenses, record settlements, and see a real-time balance.

**Dependencies:** None — this is the foundation.

- [ ] **Project scaffolding**
  - Nuxt 4 app at repo root with `nitro.preset: 'cloudflare-module'`
  - Convex project wiring (dev local, prod cloud)
   - `@clerk/nuxt` integration
   - `convex-vue` for Vue composables (Convex client reactivity in Nuxt)
   - `convex` package for Convex backend functions
   - `@convex-dev/r2` for R2 file storage

- [x] **Backend schema & auth**
  - `convex/schema.ts` with expenses, settlements tables (`orgId` scoped)
  - Clerk auth middleware for Convex functions (`requireAuthenticatedOrg` with JWT `org_id` claim)
  - Indexes: `by_org`, `by_org_date`, `by_receiptImageId`
  - Soft-delete: `deletedAt` on both tables with GDPR Article 17 retention

- [x] **Expense API** (`expenses:create`, `expenses:list`, `expenses:approve`, `expenses:reject`, `expenses:balance`, `expenses:pending`)
  - Pending/approved/rejected status workflow
  - Duplicate detection via dHash + fingerprint
  - Cross-tenant org scoping via JWT `org_id` claim (SEC-001)
  - Soft-delete filtering on all queries (SEC-002)

- [x] **Settlement API** (`settlements:create`, `settlements:list`)
   - Records money transferred between partners
   - Triggers email notification to recipient
   - Draft: `docs/2-development/01-draft/d2-settlement-api.md`

- [x] **Onboarding & organisation**
   - User A signs up → creates organisation → generates invite link
   - User B accepts via email (Resend)
   - Both become members; exactly two members per organisation
   - Draft: `docs/2-development/01-draft/d3-onboarding-flow.md`

 - [x] **Receipt upload & OCR**
   - `expenses:uploadReceipt` action → uploads to R2 via `@convex-dev/r2`
   - Tesseract.js client-side OCR extracts store, date, total
   - Pre-fills the Add Expense form
   - Implemented: `docs/2-development/04-implemented/d4-receipt-upload-ocr.md`

 - [x] **Duplicate detection**
   - dHash of receipt image compared against existing expenses in the same org
   - Fingerprint check: `${store}|${date}|${total}`
   - Near-duplicate check for manual entries (same date, amount within ±$0.01)
   - Implemented: `docs/2-development/04-implemented/d5-duplicate-detection.md`

- [x] **Frontend UI**
   - Single page, mobile-first
   - Balance header (real-time via Convex subscription)
   - Action buttons: "Add Expense" modal, "Settle Up" modal
   - Entry list: chronological expenses + settlements, pending confirm/reject buttons
    - Draft: `docs/2-development/04-implemented/d6-frontend-ui-shell.md`

- [x] **Email notifications** (Resend)
  - Expense created, approved, rejected
  - Settlement recorded
  - Invite to household

- [x] **CI/CD** (GitHub Actions)
  - Two steps on push to `master`: deploy Convex, then deploy Workers
  - Environment variables configured

- [x] **Mobile browser compatibility**
  - Works on iOS Safari and Android Chrome
- [x] **Deployment < 10 minutes**
  - From clean repo to production

**Milestone:** A couple can sign up, add expenses (with or without receipts), approve each
other's expenses, settle up, and see their real-time balance on mobile browsers. Duplicate
receipt detection warns on duplicates. Deploy from clean repo to production in under 10 minutes.

**Completed slices:** D1 — Expense Management Foundation (`2-development/04-implemented/d1-expense-management.md`), D2 — Settlement API (`2-development/04-implemented/d2-settlement-api.md`), D3 — Onboarding Flow (`2-development/04-implemented/d3-onboarding-flow.md`), D4 — Receipt Upload & OCR (`2-development/04-implemented/d4-receipt-upload-ocr.md`), D5 — Duplicate Detection (`2-development/04-implemented/d5-duplicate-detection.md`), D6 — Frontend UI Shell (`2-development/04-implemented/d6-frontend-ui-shell.md`), D7 — Email Notifications (`2-development/04-implemented/d7-email-notifications.md`), D8 — CI/CD Pipeline (`2-development/04-implemented/d8-ci-cd-pipeline.md`), D9 — Mobile Browser Compatibility (`2-development/04-implemented/d9-mobile-browser-compat.md`), D10 — 10-Minute Deployment (`2-development/04-implemented/d10-10-minute-deployment.md`)

| D1 — Expense Management Foundation | 26-Oct | 26-Oct | 27-Oct | 2 days | Implemented |
| D2 — Settlement API | 27-Oct | 27-Oct | 27-Oct | 1 day | Implemented |
| D3 — Onboarding Flow | 26-Oct | 27-Oct | 28-Oct | 3 days | Implemented |
| D4 — Receipt Upload & OCR | 28-Oct | 28-Oct | 28-Oct | 1 day | Implemented |
| D5 — Duplicate Detection | 28-Oct | 28-Oct | 28-Oct | 1 day | Implemented |
| D6 — Frontend UI Shell | 28-Oct | 28-Oct | 29-Oct | 2 days | Implemented |
| D7 — Email Notifications | 28-Oct | 29-Oct | 30-Oct | 2 days | Implemented |
| D8 — CI/CD Pipeline | 28-Oct | 30-Oct | 30-Oct | 2 days | Implemented |
| D9 — Mobile Browser Compatibility | 29-Oct | 30-Oct | 30-Oct | 1 day | Implemented |
| D10 — 10-Minute Deployment | 29-Oct | 31-Oct | 31-Oct | 2 days | Implemented |

---

## Phase 2: Enhancement (Post-MVP)

**Goal:** Quality-of-life improvements and OCR accuracy.

**Dependencies:** Phase 1 complete.

- [ ] **Google Document AI OCR** (replace Tesseract.js for higher accuracy)
  - Same interface: image in → `{store, date, total}` out
- [ ] **Push notifications**
  - Real-time WebSocket notifications via Convex (upgrade from email-only)

**Non-goals for v1** (explicitly excluded):
- No line-item extraction from receipts
- No categories beyond groceries / utilities / other
- No reports, charts, or analytics
- No CSV/bank statement import
- No multi-currency
- No dispute workflow (reject + note is sufficient)
- No audit trail UI
- No "switch household" or multiple orgs per user
- No native mobile app
- No settings screen
- No browser-native flatbed scanning

---

## Slice Cycle Time Tracking

Track time from `01-draft` → `04-implemented` per slice to optimise process.

| Slice | Draft → In-Progress | In-Progress → Review | Review → Implemented | Total Days | Status |
|-------|---------------------|----------------------|---------------------|------------|--------|
| D1 — Expense Management Foundation | 26-Oct | 26-Oct | 27-Oct | 2 days | Implemented |
| D3 — Onboarding Flow | 26-Oct | 27-Oct | 28-Oct | 3 days | Implemented |
| D4 — Receipt Upload & OCR | 28-Oct | 28-Oct | 28-Oct | 1 day | Implemented |
| D5 — Duplicate Detection | 28-Oct | 28-Oct | 28-Oct | 1 day | Implemented |
| D6 — Frontend UI Shell | 28-Oct | 28-Oct | 29-Oct | 2 days | Implemented |

**Target:** < 5 days per slice (draft → implemented) for Phase 1.

**Measurement:** Update this table on each `/slice-promote` with actual dates.
