# Functional Domains

A registry of the functional domains that make up Happy House Bills.

## Domain Registry

| # | Domain | Spec file | Status | Description |
|---|--------|-----------|--------|-------------|
| 01 | Authentication & Onboarding | `domains/01-auth/onboarding-auth.md` | Planned | Clerk signup, organisation creation, invite flow |
| 02 | Expense Management | `domains/02-expenses/expense-management.md` | Planned | Create, list, approve, reject expenses |
| 03 | Settlement Management | `domains/03-settlements/settlement-management.md` | Planned | Record and list settlements between partners |
| 04 | Balance Calculation | `domains/04-balance/balance-calculation.md` | Planned | Derived balance computation from expenses + settlements |
| 05 | Receipt Upload & Storage | `domains/05-receipts/receipt-upload.md` | Planned | Upload receipt images to R2, store references |
| 06 | OCR Pipeline | `domains/06-ocr/ocr-pipeline.md` | Planned | Client-side OCR extraction of store, date, total |
| 07 | Duplicate Detection | `domains/07-duplicates/duplicate-detection.md` | Planned | dHash and fingerprint-based duplicate detection |
| 08 | Email Notifications | `domains/08-notifications/email-notifications.md` | Planned | Resend email triggers for expense and settlement events |
| 09 | User Interface | `domains/09-ui/ui-spec.md` | Planned | Single-page mobile-first UI (balance, actions, entry list) |
| 10 | Deployment & CI/CD | `domains/10-deployment/deployment.md` | Planned | GitHub Actions, Convex deploy, Cloudflare Workers deploy |
| 11 | Security & Compliance | `domains/11-security/security.md` | Planned | Auth boundaries, PII handling, data retention |

## Dependencies

- Domain 01 (Auth) is foundational — all other domains depend on it
- Domain 04 (Balance) depends on Domain 02 (Expenses) and Domain 03 (Settlements)
- Domain 05 (Receipt Upload) feeds into Domain 06 (OCR) and Domain 07 (Duplicate Detection)
- Domain 06 (OCR) feeds into Domain 02 (Expense creation)
- Domain 07 (Duplicate Detection) is called within Domain 02 (Expense creation)
