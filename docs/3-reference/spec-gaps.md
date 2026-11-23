# Spec Gaps

Tracks gaps between requirements and technical specifications, the Open Questions Register,
and the next actions for spec writing.

## 1. Missing Referenced Documents

| Document | Status | Layer |
|----------|--------|-------|
| `~~tech-specs/architecture/project-scaffolding.md~~` | ~~Draft~~ | architecture |
| `~~tech-specs/architecture/ci-cd.md~~` | ~~Draft~~ | architecture |
| `~~tech-specs/architecture/deployment.md~~` | ~~Draft~~ | architecture |
| `~~tech-specs/backend/file-storage.md~~` | ~~Draft~~ | backend |
| `~~tech-specs/backend/email-notifications.md~~` | ~~Draft~~ | backend |
| `~~tech-specs/backend/duplicate-detection.md~~` | ~~Draft~~ | backend |
| `~~tech-specs/frontend/ui-spec.md~~` | ~~Draft~~ | frontend |
| `~~tech-specs/frontend/ocr-pipeline.md~~` | ~~Draft~~ | frontend |
| `~~tech-specs/frontend/mobile-compat.md~~` | ~~Draft~~ | frontend |
| `~~domains/02-expenses/expense-management.md~~` | ~~Draft~~ | domain |
| `~~domains/03-settlements/settlement-management.md~~` | ~~Draft~~ | domain |
| `~~domains/04-balance/balance-calculation.md~~` | ~~Draft~~ | domain |
| `~~domains/05-receipts/receipt-upload.md~~` | ~~Draft~~ | domain |
| `~~domains/06-ocr/ocr-pipeline.md~~` | ~~Draft~~ | domain |
| `~~domains/07-duplicates/duplicate-detection.md~~` | ~~Draft~~ | domain |
| `~~domains/08-notifications/email-notifications.md~~` | ~~Draft~~ | domain |
| `~~domains/09-ui/ui-spec.md~~` | ~~Draft~~ | domain |
| `~~domains/10-deployment/deployment.md~~` | ~~Draft~~ | domain |
| `~~domains/11-security/security.md~~` | ~~Draft~~ | domain |

## 2. Gaps by Domain

### Domain 01 — Authentication & Onboarding

Already drafted: `domains/01-auth/onboarding-auth.md` (Draft)

| Gap | Priority | Spec needed |
|-----|----------|-------------|
| Clerk signup → org creation → invite flow | P0 | `domains/01-auth/onboarding-auth.md` |
| Org scoping in Convex queries | P0 | `domains/01-auth/onboarding-auth.md` |

### Domain 02 — Expense Management

| Gap | Priority | Spec needed |
|-----|----------|-------------|
| Expense CRUD API contract | P0 | `tech-specs/backend/api-contract.md` |
| Pending/approved/rejected workflow | P0 | `domains/02-expenses/expense-management.md` |
| Input validation for expense fields | P1 | `tech-specs/backend/api-contract.md` |

### Domain 03 — Settlement Management

| Gap | Priority | Spec needed |
|-----|----------|-------------|
| Settlement create/list API | P0 | `tech-specs/backend/api-contract.md` |
| Balance direction validation | P1 | `domains/04-balance/balance-calculation.md` |

### Domain 04 — Balance Calculation

| Gap | Priority | Spec needed |
|-----|----------|-------------|
| Real-time balance via Convex subscription | P0 | `domains/04-balance/balance-calculation.md` |

### Domain 05 — Receipt Upload & Storage

| Gap | Priority | Spec needed |
|-----|----------|-------------|
| R2 upload via `@convex-dev/r2` | P0 | `tech-specs/backend/file-storage.md` |
| Storage ID lifecycle | P1 | `tech-specs/backend/file-storage.md` |

### Domain 06 — OCR Pipeline

| Gap | Priority | Spec needed |
|-----|----------|-------------|
| Tesseract.js worker in browser | P0 | `tech-specs/frontend/ocr-pipeline.md` |
| Regex/heuristic parsing for store/date/total | P0 | `tech-specs/frontend/ocr-pipeline.md` |
| Low-confidence fallback handling | P1 | `tech-specs/frontend/ocr-pipeline.md` |

### Domain 07 — Duplicate Detection

| Gap | Priority | Spec needed |
|-----|----------|-------------|
| dHash computation on client or server | P0 | `tech-specs/backend/duplicate-detection.md` |
| Fingerprint query in Convex | P0 | `tech-specs/backend/duplicate-detection.md` |
| Near-duplicate fuzzy matching | P1 | `tech-specs/backend/duplicate-detection.md` |

### Domain 08 — Email Notifications

| Gap | Priority | Spec needed |
|-----|----------|-------------|
| Resend template structure | P1 | `tech-specs/backend/email-notifications.md` |
| Deep link format in emails | P1 | `tech-specs/backend/email-notifications.md` |

### Domain 09 — User Interface

| Gap | Priority | Spec needed |
|-----|----------|-------------|
| Mobile-first responsive layout | P0 | `tech-specs/frontend/ui-spec.md` |
| Single-page architecture (no routing) | P0 | `tech-specs/frontend/ui-spec.md` |
| Real-time subscription binding | P1 | `tech-specs/frontend/ui-spec.md` |

### Domain 10 — Deployment & CI/CD

| Gap | Priority | Spec needed |
|-----|----------|-------------|
| GitHub Actions workflow | P0 | `tech-specs/architecture/ci-cd.md` |
| Cloudflare R2 environment variables | P1 | `tech-specs/architecture/deployment.md` |

### Domain 11 — Security & Compliance

| Gap | Priority | Spec needed |
|-----|----------|-------------|
| Clerk auth security review | P0 | `domains/11-security/security.md` |
| PII (expense data) retention policy | P1 | `domains/11-security/security.md` |
| Data export / deletion flow | P2 | `domains/11-security/security.md` |

## 3. Spec Status Table

### Tech Specs

| Spec | Status | Priority |
|------|--------|----------|
| `tech-specs/backend/data-model.md` | Draft | High |
| `tech-specs/backend/api-contract.md` | Draft | High |
| `tech-specs/architecture/project-scaffolding.md` | Draft | High |
| `tech-specs/architecture/ci-cd.md` | Draft | High |
| `tech-specs/architecture/deployment.md` | Draft | High |
| `tech-specs/backend/file-storage.md` | Draft | High |
| `tech-specs/backend/email-notifications.md` | Draft | Medium |
| `tech-specs/backend/duplicate-detection.md` | Draft | High |
| `tech-specs/frontend/ui-spec.md` | Draft | High |
| `tech-specs/frontend/ocr-pipeline.md` | Draft | High |
| `tech-specs/frontend/mobile-compat.md` | Draft | Medium |

### Domain Specs

| Spec | Status | Priority |
|------|--------|----------|
| `domains/01-auth/onboarding-auth.md` | Draft | High |
| `domains/02-expenses/expense-management.md` | Draft | High |
| `domains/03-settlements/settlement-management.md` | Draft | High |
| `domains/04-balance/balance-calculation.md` | Draft | High |
| `domains/05-receipts/receipt-upload.md` | Draft | Medium |
| `domains/06-ocr/ocr-pipeline.md` | Draft | High |
| `domains/07-duplicates/duplicate-detection.md` | Draft | High |
| `domains/08-notifications/email-notifications.md` | Draft | Medium |
| `domains/09-ui/ui-spec.md` | Draft | Medium |
| `domains/10-deployment/deployment.md` | Draft | High |
| `domains/11-security/security.md` | Draft | High |

## 4. Writing Order

1. `tech-specs/backend/data-model.md` — foundation for all expense/settlement work
2. `tech-specs/backend/api-contract.md` — already drafted
3. `domains/01-auth/onboarding-auth.md` — already drafted
4. `tech-specs/backend/file-storage.md` — receipt upload dependency
5. `tech-specs/backend/duplicate-detection.md` — called during expense creation
6. `tech-specs/frontend/ocr-pipeline.md` — frontend OCR before form submission
7. `tech-specs/frontend/ui-spec.md` — UI component spec
8. `tech-specs/architecture/project-scaffolding.md` — scaffolding for implementers
9. `tech-specs/architecture/ci-cd.md` — deployment
10. `tech-specs/architecture/deployment.md` — environment configuration

## 5. Next Actions

Write the missing referenced documents above in priority order (foundational tech-specs first,
then domain specs).

1. ~~Write `tech-specs/architecture/project-scaffolding.md`~~
2. ~~Write `tech-specs/backend/file-storage.md`~~
3. ~~Write `tech-specs/backend/duplicate-detection.md`~~
4. ~~Write `tech-specs/frontend/ocr-pipeline.md`~~
5. ~~Write `tech-specs/frontend/ui-spec.md`~~
6. ~~Write `tech-specs/backend/email-notifications.md`~~
7. ~~Write `tech-specs/frontend/mobile-compat.md`~~
8. ~~Write `tech-specs/architecture/ci-cd.md`~~
9. ~~Write `tech-specs/architecture/deployment.md`~~
10. ~~Write `domains/02-expenses/expense-management.md`~~
11. ~~Write `domains/03-settlements/settlement-management.md`~~
12. ~~Write `domains/04-balance/balance-calculation.md`~~
13. ~~Write `domains/05-receipts/receipt-upload.md`~~
14. ~~Write `domains/06-ocr/ocr-pipeline.md`~~
15. ~~Write `domains/07-duplicates/duplicate-detection.md`~~
16. ~~Write `domains/08-notifications/email-notifications.md`~~
17. ~~Write `domains/09-ui/ui-spec.md`~~
18. ~~Write `domains/10-deployment/deployment.md`~~
19. ~~Write `domains/11-security/security.md`~~

## 6. Open Questions Register

| ID | Question | Status | Source spec | Resolution owner | Target phase |
|----|----------|--------|-------------|------------------|--------------|
| ~~BB-Q1~~ | Should `expenses:list` return a cap or pagination? | Resolved | `tech-specs/backend/api-contract.md` | backend-engineer | Phase 1 — No pagination in v1; ≤2 users per household; list is trivially small |
| ~~BB-Q2~~ | Should `expenses:balance` return a numeric value or a structured object? | Resolved | `tech-specs/backend/api-contract.md` | backend-engineer | Phase 1 — Structured object `{ balance: number, owesWhom: string }` per domain spec D5 |
| ~~BB-Q3~~ | What happens if User B's email is already associated with a different Clerk org? | Resolved | `domains/01-auth/onboarding-auth.md` | backend-engineer | Phase 1 — Block and show error message |
| ~~UI-Q1~~ | Should we add a reduced-motion toggle in settings, or rely solely on `prefers-reduced-motion`? | Resolved | `tech-specs/frontend/ui-spec.md` | frontend-engineer | Phase 2 — Toggle implemented in useAccessibility composable |
| ~~UI-Q2~~ | Should dark mode follow system preference or default to light regardless of OS setting? | Resolved | `tech-specs/frontend/ui-spec.md` | frontend-engineer | Phase 1 — Light mode default per D2 |
| ~~EXP-Q1~~ | Should users be able to re-open a rejected expense, or must they create a new one? | Resolved | `domains/02-expenses/expense-management.md` | backend-engineer | Phase 1 — Create new expense; rejected history stays intact |
| SET-Q1 | Should we add a "settlement requested" status for async confirmation (like expense approval)? | Open | `domains/03-settlements/settlement-management.md` | backend-engineer | Phase 2 |
| ~~REC-Q1~~ | Should we use direct R2 presigned POST instead of Convex action base64 upload? | Resolved | `domains/05-receipts/receipt-upload.md` | backend-engineer | Phase 1 — Stay with Convex action base64 upload (simpler, 5MB limit is sufficient) |
| ~~OCR-Q1~~ | Should OCR pre-fill overwrite user-entered fields, or only populate empty fields? | Resolved | `domains/06-ocr/ocr-pipeline.md` | frontend-engineer | Phase 1 — Only populate empty fields (safer UX) |
| ~~DUP-Q1~~ | Should duplicate detection span across all stores or only the current org? | Resolved | `domains/07-duplicates/duplicate-detection.md` | backend-engineer | Phase 1 — Current org only (privacy-preserving) |
| NOT-Q1 | Should we send a notification when an expense is approved/rejected? | Open | `domains/08-notifications/email-notifications.md` | backend-engineer | Phase 2 |
| UI-D-Q1 | Should settled expenses be collapsed or shown in full? | Open | `domains/09-ui/ui-spec.md` | frontend-engineer | Phase 2 |
| UI-D-Q2 | Should the entry list show expenses and settlements interleaved chronologically? | Open | `domains/09-ui/ui-spec.md` | frontend-engineer | Phase 2 |
| ~~SEC-001~~ | Should R2 receipt objects be encrypted at rest with a per-organisation key, or rely on R2 default encryption? | Resolved | `domains/11-security/security.md` | security-engineer | Phase 1 — R2 default encryption (per-org key adds management overhead for v1; revisit for EU compliance) |
| SEC-002 | Should we implement a GDPR Data Processing Agreement (DPA) with Clerk and Resend, or rely on their standard terms? | Resolved | `domains/11-security/security.md` | security-engineer | Phase 1 — Rely on standard terms (established providers; implement DPA only if EU user base grows) |
| ~~DEPLOY-Q1~~ | What's the optimal deployment strategy for this application architecture? | Resolved | `docs/2-development/02-in-progress/d10-10-minute-deployment.md` | devops-engineer | Phase 2 — Single pipeline via GitHub Actions; Convex first, then Nuxt; no blue-green in v1; rollback via git revert + redeploy |
| ~~DEPLOY-Q2~~ | What are the specific performance requirements for deployment? | Resolved | `docs/2-development/02-in-progress/d10-10-minute-deployment.md` | devops-engineer | Phase 2 — Sub-10-minute target; CI skips docs-only pushes via paths-ignore; health endpoint validates post-deploy |
| ~~UI-Q3~~ | What's the best responsive framework for this project? | Resolved | `docs/2-development/01-draft/d12-mobile-responsive-ui-shell.md` | frontend-engineer | Phase 3 — Bootstrap-style responsive utilities with CSS custom properties |
| ~~UI-Q4~~ | How should we handle mobile-first CSS architecture? | Resolved | `docs/2-development/01-draft/d12-mobile-responsive-ui-shell.md` | frontend-engineer | Phase 3 — CSS variables for breakpoints, media queries built into component stylesheets |
| ~~UI-Q5~~ | What's the optimal approach for offline data sync? | Resolved | `docs/2-development/01-draft/d12-mobile-responsive-ui-shell.md` | backend-engineer | Phase 3 — IndexedDB store with action queue; sync on reconnect |
| ~~TEAM-Q1~~ | What's the optimal RBAC model for this application? | Resolved | `docs/2-development/04-implemented/d13-team-workspaces-collaboration.md` | backend-engineer | Phase 3 — Three-role RBAC (admin, member, viewer) implemented with permission checks per role |
| ~~TEAM-Q2~~ | How should we handle team invitations and security? | Resolved | `docs/2-development/04-implemented/d13-team-workspaces-collaboration.md` | security-engineer | Phase 3 — Token-based invites with rate limiting (10/day/org), org-scoped validation, org ID mismatch rejection, self-action prevention |
| ~~INT-Q1~~ | How should we handle API authentication securely for external integrations? | ~~Resolved~~ | `docs/2-development/04-implemented/d14-advanced-integrations.md` | ~~security-engineer~~ | ~~Phase 3~~ | ~~OAuth 2.0 with token-based auth; credentials stored encrypted in Convex DB with org-scoped access control~~ |
| ~~INT-Q2~~ | What's the best approach for data transformation between external APIs and internal models? | ~~Resolved~~ | `docs/2-development/04-implemented/d14-advanced-integrations.md` | ~~backend-engineer~~ | ~~Phase 3~~ | ~~Adapter pattern — each provider gets its own adapter module with a common interface (`INTEGRATION_TYPES` type constants)~~, Integrations |
| ~~INT-Q3~~ | How should we manage API rate limiting across multiple external providers? | ~~Resolved~~ | `docs/2-development/04-implemented/d14-advanced-integrations.md` | ~~backend-engineer~~ | ~~Phase 3~~ | ~~Global rate limits per org with retry logic and exponential backoff via API gateway; fair usage to prevent abuse and control costs~~ |
| ANL-Q1 | What's the best approach for predictive analytics? | Resolved | `docs/2-development/04-implemented/d15-advanced-analytics-insights.md` | backend-engineer | Phase 3 — Simple linear projection (historical average / period months); ML enhancement deferred to Phase 4+ |
| ANL-Q2 | How should we handle data privacy in analytics? | Resolved | `docs/2-development/04-implemented/d15-advanced-analytics-insights.md` | security-engineer | Phase 3 — Org-scoped queries; analytics return only aggregated numbers; no user-identifiable data in responses |
| ANL-Q3 | What's the optimal visualization approach? | Resolved | `docs/2-development/04-implemented/d15-advanced-analytics-insights.md` | frontend-engineer | Phase 3 — Chart.js with computed series from Convex queries; evaluate lighter alternatives (uPlot, ApexCharts) in Phase 4 |
| LI-Q1 | `OPENROUTER_OCR_MODEL` vs custom trained model for accuracy? | Open | `docs/2-development/04-implemented/d19-line-item-extraction.md` | backend-engineer | Phase 2 — Start with `google/gemini-2.5-flash`; evaluate on real receipts |
| LI-Q2 | How to handle split expense UX — multiple expenses or single with items? | Open | `docs/2-development/04-implemented/d19-line-item-extraction.md` | frontend-engineer | Phase 2 — Design review needed |
| LI-Q3 | Should line items persist for audit/receipt view? | Open | `docs/2-development/04-implemented/d19-line-item-extraction.md` | backend-engineer | Phase 2 — Storage cost vs utility trade-off |
| CAT-Q1 | How many default categories? (8 proposed) | Open | `docs/2-development/01-draft/d20-expense-categories-enhancement.md` | backend-engineer | Phase 2 — Balance completeness vs overwhelm |
| ~~CAT-Q2~~ | Allow users to create unlimited categories? | Resolved | `docs/2-development/01-draft/d20-expense-categories-enhancement.md` | backend-engineer | Phase 2 — No cap implemented; unlimited categories per org, documented in D20 proposal open questions |
| CAT-Q3 | Category icons: emoji or icon font? | Open | `docs/2-development/01-draft/d20-expense-categories-enhancement.md` | frontend-engineer | Phase 2 — Emoji simpler; icons more consistent |
| CAT-Q4 | Budget period: calendar month or rolling 30 days? | Open | `docs/2-development/01-draft/d20-expense-categories-enhancement.md` | backend-engineer | Phase 2 — Calendar month simpler for users |
| P4-Q1 | PDF generation: client-side (jsPDF) or server-side (Convex + puppeteer)? | Deferred | `docs/2-development/02-in-progress/d21-analytics-export-reports.md` | backend-engineer | Phase 4 — Deferred to a follow-up slice; CSV/JSON shipped first |
| ~~P4-Q2~~ | Support custom date ranges beyond presets? | Resolved | `docs/2-development/02-in-progress/d21-analytics-export-reports.md` | frontend-engineer | Phase 4 — Custom dateFrom/dateTo fields in report config |
| ~~P4-Q3~~ | Report sharing: link-only or email attachment? | Resolved | `docs/2-development/02-in-progress/d21-analytics-export-reports.md` | security-engineer | Phase 4 — Link-only via signed R2 URLs (7-day expiry) |
| ~~P4-Q4~~ | Maximum report size / row limit for CSV? | Resolved | `docs/2-development/02-in-progress/d21-analytics-export-reports.md` | backend-engineer | Phase 4 — 10k row safety cap in backend |
| P3-Q1 | Goal period: calendar month, rolling 30-day window, or custom? | Resolved | `docs/2-development/04-implemented/d23-goal-tracking-budget-variance.md` | backend-engineer | Phase 3 — Calendar month aligns with budgets; rolling for multi-household |
| P3-Q2 | Savings goals: track via settlement "savings" category or a separate goal table entry? | Resolved | `docs/2-development/04-implemented/d23-goal-tracking-budget-variance.md` | backend-engineer | Phase 3 — Separate table cleaner; category simpler for v1 |
| P3-Q3 | Variance projection: linear only or include seasonality? | Resolved | `docs/2-development/04-implemented/d23-goal-tracking-budget-variance.md` | backend-engineer | Phase 3 — Linear only in v1; seasonality deferred to Phase 4 |
| P3-Q4 | Goal completion: auto-archive at 100% or manual archive? | Resolved | `docs/2-development/04-implemented/d23-goal-tracking-budget-variance.md` | backend-engineer | Phase 3 — Auto-archive at 100% with option to restore |
| P4-Q5 | Should group-level subscription sharing extend to all members, or only the admin? | Open | `docs/2-development/04-implemented/d24-commercial-model.md` | backend-engineer | Phase 4 — Admin pays, all members free; or per-member subscriptions; default: admin pays, all members free |

## 7. Appendix: Gap Count Summary

| Metric | Count |
|--------|-------|
| Missing referenced documents | 0 |
| Open questions | 6 |
| Domains | 11 |
| Total next actions | 0 |

