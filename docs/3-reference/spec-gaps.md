# Spec Gaps

Tracks gaps between requirements and technical specifications, the Open Questions Register,
and the next actions for spec writing.

## 1. Missing Referenced Documents

| Document | Status | Layer |
|----------|--------|-------|
| `tech-specs/architecture/project-scaffolding.md` | Missing | architecture |
| `tech-specs/architecture/ci-cd.md` | Missing | architecture |
| `tech-specs/architecture/deployment.md` | Missing | architecture |
| `tech-specs/backend/file-storage.md` | Missing | backend |
| `tech-specs/backend/email-notifications.md` | Missing | backend |
| `tech-specs/backend/duplicate-detection.md` | Missing | backend |
| `tech-specs/frontend/ui-spec.md` | Missing | frontend |
| `tech-specs/frontend/ocr-pipeline.md` | Missing | frontend |
| `tech-specs/frontend/mobile-compat.md` | Missing | frontend |
| `domains/02-expenses/expense-management.md` | Missing | domain |
| `domains/03-settlements/settlement-management.md` | Missing | domain |
| `domains/04-balance/balance-calculation.md` | Missing | domain |
| `domains/05-receipts/receipt-upload.md` | Missing | domain |
| `domains/06-ocr/ocr-pipeline.md` | Missing | domain |
| `domains/07-duplicates/duplicate-detection.md` | Missing | domain |
| `domains/08-notifications/email-notifications.md` | Missing | domain |
| `domains/09-ui/ui-spec.md` | Missing | domain |
| `domains/10-deployment/deployment.md` | Missing | domain |
| `domains/11-security/security.md` | Missing | domain |

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
| `tech-specs/architecture/project-scaffolding.md` | Missing | High |
| `tech-specs/architecture/ci-cd.md` | Missing | High |
| `tech-specs/architecture/deployment.md` | Missing | High |
| `tech-specs/backend/file-storage.md` | Missing | High |
| `tech-specs/backend/email-notifications.md` | Missing | Medium |
| `tech-specs/backend/duplicate-detection.md` | Missing | High |
| `tech-specs/frontend/ui-spec.md` | Missing | High |
| `tech-specs/frontend/ocr-pipeline.md` | Missing | High |
| `tech-specs/frontend/mobile-compat.md` | Missing | Medium |

### Domain Specs

| Spec | Status | Priority |
|------|--------|----------|
| `domains/01-auth/onboarding-auth.md` | Draft | High |
| `domains/02-expenses/expense-management.md` | Missing | High |
| `domains/03-settlements/settlement-management.md` | Missing | High |
| `domains/04-balance/balance-calculation.md` | Missing | High |
| `domains/05-receipts/receipt-upload.md` | Missing | Medium |
| `domains/06-ocr/ocr-pipeline.md` | Missing | High |
| `domains/07-duplicates/duplicate-detection.md` | Missing | High |
| `domains/08-notifications/email-notifications.md` | Missing | Medium |
| `domains/09-ui/ui-spec.md` | Missing | Medium |
| `domains/10-deployment/deployment.md` | Missing | High |
| `domains/11-security/security.md` | Missing | High |

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

## 6. Next Actions

Write the missing referenced documents above in priority order (foundational tech-specs first,
then domain specs).

- [ ] 1. **Write `tech-specs/architecture/project-scaffolding.md`**
- [ ] 2. **Write `tech-specs/backend/file-storage.md`**
- [ ] 3. **Write `tech-specs/backend/duplicate-detection.md`**
- [ ] 4. **Write `tech-specs/frontend/ocr-pipeline.md`**
- [ ] 5. **Write `tech-specs/frontend/ui-spec.md`**
- [ ] 6. **Write `tech-specs/backend/email-notifications.md`**
- [ ] 7. **Write `tech-specs/frontend/mobile-compat.md`**
- [ ] 8. **Write `tech-specs/architecture/ci-cd.md`**
- [ ] 9. **Write `tech-specs/architecture/deployment.md`**
- [ ] 10. **Write `domains/02-expenses/expense-management.md`**
- [ ] 11. **Write `domains/03-settlements/settlement-management.md`**
- [ ] 12. **Write `domains/04-balance/balance-calculation.md`**
- [ ] 13. **Write `domains/05-receipts/receipt-upload.md`**
- [ ] 14. **Write `domains/06-ocr/ocr-pipeline.md`**
- [ ] 15. **Write `domains/07-duplicates/duplicate-detection.md`**
- [ ] 16. **Write `domains/08-notifications/email-notifications.md`**
- [ ] 17. **Write `domains/09-ui/ui-spec.md`**
- [ ] 18. **Write `domains/10-deployment/deployment.md`**
- [ ] 19. **Write `domains/11-security/security.md`**

## Open Questions Register

| ID | Question | Status | Source spec | Resolution owner | Target phase |
|----|----------|--------|-------------|------------------|--------------|
| BB-Q1 | Should `expenses:list` return a cap or pagination? | Open | `tech-specs/backend/api-contract.md` | backend-engineer | Phase 1 |
| BB-Q2 | Should `expenses:balance` return a numeric value or a structured object? | Open | `tech-specs/backend/api-contract.md` | backend-engineer | Phase 1 |
| BB-Q3 | What happens if User B's email is already associated with a different Clerk org? | Open | `domains/01-auth/onboarding-auth.md` | backend-engineer | Phase 1 |

## Appendix: Gap Count Summary

| Metric | Count |
|--------|-------|
| Missing referenced documents | 19 |
| Open questions | 3 |
| Domains | 11 |
| Total next actions | 19 |
