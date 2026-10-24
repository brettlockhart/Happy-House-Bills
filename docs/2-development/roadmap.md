# Implementation Roadmap

**Project:** Happy House Bills
**Status:** Active
**Last updated:** 24-October-2026

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
  - `@j-boardman/convex-nuxt` for Convex + Nuxt bridging
  - `convex/react-clerk` for Clerk ↔ Convex auth bridge
  - `@convex-dev/r2` for R2 file storage

- [ ] **Backend schema & auth**
  - `convex/schema.ts` with expenses, settlements tables (`orgId` scoped)
  - Clerk auth middleware for Convex functions
  - Indexes: `by_org`, `by_org_date`

- [ ] **Expense API** (`expenses:create`, `expenses:list`, `expenses:approve`, `expenses:reject`, `expenses:balance`, `expenses:pending`)
  - Pending/approved/rejected status workflow
  - Pending expenses trigger email to the other partner
  - Approval/rejection triggers email to the expense creator

- [ ] **Settlement API** (`settlements:create`, `settlements:list`)
  - Records money transferred between partners
  - Triggers email notification to recipient

- [ ] **Onboarding & organisation**
  - User A signs up → creates organisation → generates invite link
  - User B accepts via email (Resend)
  - Both become members; exactly two members per organisation

- [ ] **Receipt upload & OCR**
  - `expenses:uploadReceipt` action → uploads to R2 via `@convex-dev/r2`
  - Tesseract.js client-side OCR extracts store, date, total
  - Pre-fills the Add Expense form

- [ ] **Duplicate detection**
  - dHash of receipt image compared against existing expenses in the same org
  - Fingerprint check: `${store}|${date}|${total}`
  - Near-duplicate check for manual entries (same date, amount within ±$0.01)

- [ ] **Frontend UI**
  - Single page, mobile-first
  - Balance header (real-time via Convex subscription)
  - Action buttons: "Add Expense" modal, "Settle Up" modal
  - Entry list: chronological expenses + settlements, pending confirm/reject buttons

- [ ] **Email notifications** (Resend)
  - Expense created, approved, rejected
  - Settlement recorded
  - Invite to household

- [ ] **CI/CD** (GitHub Actions)
  - Two steps on push to `main`: deploy Convex, then deploy Workers
  - Environment variables configured

- [ ] **Mobile browser compatibility**
  - Works on iOS Safari and Android Chrome

- [ ] **Deployment < 10 minutes**
  - From clean repo to production

**Milestone:** A couple can sign up, add expenses (with or without receipts), approve each
other's expenses, settle up, and see their real-time balance on mobile browsers. Duplicate
receipt detection warns on duplicates. Deploy from clean repo to production in under 10 minutes.

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
| (no slices yet) | — | — | — | — | — |

**Target:** < 5 days per slice (draft → implemented) for Phase 1.

**Measurement:** Update this table on each `/slice-promote` with actual dates.
