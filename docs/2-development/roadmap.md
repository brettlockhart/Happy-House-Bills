# Implementation Roadmap

**Project:** Happy House Bills
**Status:** Active — Phase 1 complete; Phases 3–5 expansion complete; D28/D29 implemented
**Last updated:** 24-November-2026

Phases are sequential and build on one another. Each phase ends with a concrete milestone
before the next begins. All work follows the doc lifecycle (`01-draft` → `02-in-progress` →
`03-ready-for-review` → `04-implemented`).

---

## Phase 1: MVP — Household Expense Tracker

**Goal:** Ship a working household expense tracker for couples. Users can sign up, create a
household (Clerk organisation), invite their partner, add expenses (manual or via receipt OCR),
approve/reject expenses, record settlements, and see a real-time balance.

**Dependencies:** None — this is the foundation.

- [x] **Project scaffolding**
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

- [x] **Onboarding & organisation**
  - User A signs up → creates organisation → generates invite link
  - User B accepts via email (Resend)
  - Both become members; exactly two members per organisation

- [x] **Receipt upload & OCR**
  - `expenses:uploadReceipt` action → uploads to R2 via `@convex-dev/r2`
  - Tesseract.js client-side OCR extracts store, date, total
  - Pre-fills the Add Expense form

- [x] **Duplicate detection**
  - dHash of receipt image compared against existing expenses in the same org
  - Fingerprint check: `${store}|${date}|${total}`
  - Near-duplicate check for manual entries (same date, amount within ±$0.01)

- [x] **Frontend UI**
  - Single page, mobile-first
  - Balance header (real-time via Convex subscription)
  - Action buttons: "Add Expense" modal, "Settle Up" modal
  - Entry list: chronological expenses + settlements, pending confirm/reject buttons

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

**Completed slices:** D1 — Expense Management Foundation (`04-implemented/d1-expense-management.md`), D2 — Settlement API (`04-implemented/d2-settlement-api.md`), D3 — Onboarding Flow (`04-implemented/d3-onboarding-flow.md`), D4 — Receipt Upload & OCR (`04-implemented/d4-receipt-upload-ocr.md`), D5 — Duplicate Detection (`04-implemented/d5-duplicate-detection.md`), D6 — Frontend UI Shell (`04-implemented/d6-frontend-ui-shell.md`), D7 — Email Notifications (`04-implemented/d7-email-notifications.md`), D8 — CI/CD Pipeline (`04-implemented/d8-ci-cd-pipeline.md`), D9 — Mobile Browser Compatibility (`04-implemented/d9-mobile-browser-compat.md`), D10 — 10-Minute Deployment (`04-implemented/d10-10-minute-deployment.md`)

| Slice | Draft → In-Progress | In-Progress → Review | Review → Implemented | Total Days | Status |
|-------|---------------------|----------------------|---------------------|------------|--------|
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

- [x] **OpenRouter LLM OCR** (replace Tesseract.js for higher accuracy)
  - Same interface: image in → `{store, date, total}` out
  - Vision LLM via OpenRouter (`google/gemini-2.5-flash` default) with multi-frame and line-item support
- [x] **Push notifications**
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

## Phase 3–5: Expansion (Post-MVP)

**Goal:** Extend the product with advanced features, teams, integrations, analytics, and performance hardening.

**Dependencies:** Phase 1 complete.

**Completed slices:** D11 — Advanced Features (`04-implemented/d11-advanced-features.md`), D12 — Mobile-First UI/UX Shell (`04-implemented/d12-mobile-responsive-ui-shell.md`), D13 — Team Workspaces & Collaboration (`04-implemented/d13-team-workspaces-collaboration.md`), D14 — Advanced Integrations (`04-implemented/d14-advanced-integrations.md`), D15 — Advanced Analytics & Insights (`04-implemented/d15-advanced-analytics-insights.md`), D16 — Performance & Reliability (`04-implemented/d16-performance-reliability.md`), D17 — OpenRouter LLM OCR (`04-implemented/d17-openrouter-ocr.md`), D18 — Push Notifications (`04-implemented/d18-push-notifications.md`), D19 — Line-Item Extraction (`04-implemented/d19-line-item-extraction.md`), D20 — Expense Categories Enhancement (`04-implemented/d20-expense-categories-enhancement.md`), D21 — Analytics Export & Custom Reports (`04-implemented/d21-analytics-export-reports.md`), D22 — Notification Preferences & Rich Actions (`04-implemented/d22-notification-preferences-rich-actions.md`), D23 — Goal Tracking & Budget Variance (`04-implemented/d23-goal-tracking-budget-variance.md`), D24 — Commercial Model & Responsibility Ratios (`04-implemented/d24-commercial-model.md`)

| Slice | Review → Implemented | Status |
|-------|----------------------|--------|
| D11 — Advanced Features | 03-November-2026 | Implemented |
| D12 — Mobile-First UI/UX Shell | 04-November-2026 | Implemented |
| D13 — Team Workspaces & Collaboration | 05-November-2026 | Implemented |
| D14 — Advanced Integrations | 07-November-2026 | Implemented |
| D15 — Advanced Analytics & Insights | 07-November-2026 | Implemented |
| D16 — Performance & Reliability | 07-November-2026 | Implemented |
| D17 — OpenRouter LLM OCR | 07-November-2026 | Implemented |
| D18 — Push Notifications | 08-November-2026 | Implemented |
| D19 — Line-Item Extraction | 08-November-2026 | Implemented |
| D20 — Expense Categories Enhancement | 07-November-2026 | Implemented |
| D21 — Analytics Export & Custom Reports | 15-November-2026 | Implemented |
| D22 — Notification Preferences & Rich Actions | 20-November-2026 | Implemented |
| D23 — Goal Tracking & Budget Variance | 20-November-2026 | Implemented |

> Note: Detailed draft→in-progress→review dates for D11–D16 were not consistently tracked in this table; promotion dates are recorded in `docs/2-development/README.md` and slice lifecycle reports.

---

## Phase 4: Commercial Model (Post-Launch)

**Goal:** Enable a commercial subscription model where paying subscribers can create multiple groups, invite free and paying users, track responsibility ratios per expense, and manage Stripe subscriptions (with local dev workaround).

**Dependencies:** Phase 1 complete; Phase 2/3 features optional but recommended (D17, D19, D22).

- [x] **D24: Commercial Model & Responsibility Ratios**
  - `expenses.share` field (0–100%) for ratio-based balance computation — **implemented (D24-A)**
  - `subscriptions` table: Stripe status per group; local dev workaround (`local_test`) — **implemented (D24-B)**
  - Multi-org membership relaxed: paying users can own multiple groups — **implemented (D24-C)**
  - Group switcher UI; differentiated invite flow (free vs paying) — **implemented (D24-D/E)**
  - Account deletion / ownership transfer, per-role feature gating — **implemented (D28)**

- [x] **D25: Stripe Production Integration** — `docs/2-development/04-implemented/d25-stripe-production-integration.md`
  - Live Stripe keys; production webhook endpoints
  - Trial management; renewal reminders; dunning flow
  - Stripe Customer Portal integration

- [x] **D26: Advanced Feature Gating** — `docs/2-development/04-implemented/d26-advanced-feature-gating.md`
  - Per-role feature matrix (free vs paying vs admin)
  - Usage limits for free members (expenses/month, OCR calls, etc.)
  - Upgrade prompts & in-app purchase flow

- [x] **D27: Team Analytics & Reporting (Commercial)** — `docs/2-development/04-implemented/d27-team-analytics-reporting.md`
  - Group-level analytics (spending by role, share efficiency)
  - Export reports for accountants / shared with members
  - Scheduled report delivery

- [x] **D28: Account Deletion & Ownership Transfer** — `docs/2-development/04-implemented/d28-account-deletion-ownership-transfer.md`
  - Paying subscriber-initiated ownership transfer
  - GDPR-compliant account deletion with 90-day retention
  - Post-transfer per-role feature gating re-evaluation

- [x] **D29: Multi-user Responsibility Ratios** — `docs/2-development/04-implemented/d29-multi-user-responsibility-ratios.md`
  - Generalize 2-party `expenses.share` to N-user groups
  - Per-user share tracking (summing to 100%)
  - Ratio-weighted balance computation

**Milestone:** A paying subscriber can create multiple groups, invite free/paying users, track who pays what %, and manage subscriptions — with full backward compatibility for existing free households.

| Slice | Review → Implemented | Status |
|-------|----------------------|--------|
| D24 — Commercial Model & Responsibility Ratios | 22-November-2026 | Implemented |
| D25 — Stripe Production Integration | 23-November-2026 | Implemented |
| D26 — Advanced Feature Gating | 23-November-2026 | Implemented |
| D27 — Team Analytics & Reporting | 24-November-2026 | Implemented |
| D28 — Account Deletion & Ownership Transfer | 24-November-2026 | Implemented |
| D29 — Multi-user Responsibility Ratios | 24-November-2026 | Implemented |

---

## Slice Cycle Time Tracking

Track time from `01-draft` → `04-implemented` per slice to optimise process.

**Target:** < 5 days per slice (draft → implemented) for Phase 1.

**Measurement:** Update this table on each `/slice-promote` with actual dates. (Phase 1 details above; Phase 3–5 promotions recorded in slice docs.)
