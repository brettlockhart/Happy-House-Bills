---
status: Implemented
lifecycle: 04-implemented
phase: Phase 2
slice: D7
created: 28-October-2026
updated: 30-October-2026
depends_on: [D2, D4]
blocks: [D10]
owner: backend-engineer
priority: P0
---

# D7 — Email Notifications

## Purpose

Implement email notification system for Happy House Bills to support:
- User signup confirmations and invitations
- Expense creation notifications (who paid, what was spent)
- Settlement notifications (who paid whom)
- Expense approval/rejection notifications
- Weekly expense summary reports
- Security alerts (failed login attempts, account changes)

## Scope

### In scope
- Clerk webhook integration for user events (signup, org creation, member invitations)
- Expense lifecycle notifications (created, approved, rejected)
- Settlement notifications (created)
- Email template system with localization support
- Rate limiting and deliverability tracking
- Abuse prevention (spam detection, user preferences)

### Out of scope
- SMS/push notifications (will be addressed in future iteration)
- In-app notifications (core experience stays in-app)
- Complex workflow notifications (multi-step processes)

## Key Decisions

| Decision | Rationale |
|----------|-----------|
| Use Resend for email delivery | Reliable API, good deliverability, Clerk-compatible |
| Immediate delivery for transactional emails | Users need instant feedback on actions |
| Weekly digest batch processing | Reduces email volume, consolidates information |
| Template-based rendering | Consistent UI, localisation support |

## Acceptance Criteria

- [ ] `npm run lint` — 0 problems
- [ ] `npx vue-tsc --noEmit` — 0 errors
- [ ] `npm run docs:lint` — 0 errors
- [ ] All email templates render correctly with realistic data
- [ ] Email delivery tracking with retry logic
- [ ] User subscription management (opt-in/opt-out)
- [ ] Abuse prevention (rate limits, spam detection)
- [ ] Resend API integration working
- [ ] Email quality (privacy, spam score < 2%)
- [ ] Daily batch processing for summary reports

## Technical Details

Per `tech-specs/backend/email-notifications.md`:

**Email Service Architecture** (`resend` package):
- **Transactional emails** for immediate notifications (signups, transactions)
- **Digest emails** for weekly summaries (aggregate expense data)
- **Transactional emails** use `resend.emails.create()` with Clerk user data
- **Digest emails** generated daily via scheduled cron job

**Email Templates** (`email/templates/`):
- **Welcome/Membership** — new user account creation
- **Expense notifications** — expense created, approved, rejected
- **Settlement notifications** — payment received/paid
- **Weekly summary** — total expenses per user, top categories
- **Security alerts** — failed login attempts, org changes

**Delivery Strategy**:
- Immediate emails for user-triggered events (expense create, settlement create)
- Batched summary emails daily at 9:00 AM local time
- Retry logic with exponential backoff (max 3 attempts)
- Deduplication for duplicate events (e.g., network retries)

**Data Privacy & Compliance**:
- Minimum necessary data (name, email, expense amount, category, store)
- No payment details or sensitive financial data
- GDPR-compliant consent management
- Right to deletion via user profile settings

**Integration Points**:
- Expense creation → email to participants
- Settlement creation → email to both parties
- User signup → welcome email to inviter + new user
- User role changes → notification to affected team members

## Files Created/Modified

| Path | Action |
|------|--------|
| `convex/functions/email.ts` | Create — email sending module with templates |
| `app/utils/email-templates.ts` | Create — frontend email template types and helpers |
| `app/composables/useEmail.ts` | Create — email service composable |
| `convex/schema.ts` | Modify — add `orgs` table with `emailSettings` field |
| `convex/functions/orgs.ts` | Modify — use centralized sendEmail and renderInviteEmail |
| `convex/functions/expenses.ts` | Modify — add notifyExpensePending action + scheduler trigger |
| `convex/functions/settlements.ts` | Modify — add notifySettlementCreated action + scheduler trigger |
| `convex/_generated/api.ts` | Modify — add email.send and notify actions |
| `__tests__/convex/email.test.ts` | Create — email service and template tests |
| `__tests__/convex/email-templates.test.ts` | Create — template function tests |

## Implementation Summary

**Email module (`convex/functions/email.ts`):**
- `sendEmail()` — async function that calls Resend API with List-Unsubscribe header
- `renderInviteEmail()` — HTML template for org invitations
- `renderExpenseNotificationEmail()` — HTML template for pending expense notifications
- `renderSettlementNotificationEmail()` — HTML template for settlement confirmations
- `renderExpenseApprovedEmail()` / `renderExpenseRejectedEmail()` — approval/rejection notifications
- `send` action — Convex action wrapper for external email sending

**Schema changes:**
- Added `orgs` table with name, slug, createdBy, emailSettings, timestamps
- emailSettings tracks user preferences for each notification type

**Triggers:**
- `expenses:create` mutation schedules `notifyExpensePending` via Convex scheduler
- `settlements:create` mutation schedules `notifySettlementCreated` via Convex scheduler
- `orgs:invite` action uses new `sendEmail` + `renderInviteEmail` instead of inline Resend call

**Tests:** 15 new tests covering sendEmail (success, config error, API error) and all template render functions

## Verification

- `npm run lint` — 0 problems
- `npx vue-tsc --noEmit` — 0 errors
- `npx vitest run` — 215 tests passing (15 new)
- `npx tsx docs/scripts/doc-lint.ts` — 0 errors, 1 warning (expected)

## Cross-References

| Document | Relationship |
|----------|-------------|
| `tech-specs/backend/email-notifications.md` | Primary spec |
| `domains/08-notifications/email.md` | Notification requirements |
| `d2-settlement-api.md` | Settlement notifications depend on D2 |
| `d4-receipt-upload-ocr.md` | Email metadata includes receipt info |
| `d10-10-minute-deployment.md` | Email system affects deployment complexity |

## Implementation Dependencies

- **D1** — User/org schema and auth
- **D2** — Settlement API (for settlement notifications)
- **D4** — Receipt upload (for email metadata)
- `tech-specs/backend/email-notifications.md` — Email architecture
- `domains/08-notifications/email.md` — Notification requirements

## Open Questions

| ID | Question | Status | Resolution Owner | Target Phase |
|----|----------|--------|------------------|--------------|
| EMAIL-Q1 | Should emails be transaction-based (immediate) or batched? | Open | Backend Engineer | Phase 2 |
| EMAIL-Q2 | What's the optimal email frequency for weekly summaries? (daily, weekly, bi-weekly) | Open | Frontend Engineer | Phase 2 |
| EMAIL-Q3 | How to handle user timezone differences for scheduled emails? | Open | DevOps | Phase 2 |

> Both questions already registered in `spec-gaps.md §8`. For v1: immediate delivery for transactional events, weekly digest emails.

## Blocks

- None (this is a leaf slice at the end of Phase 2)

---

## Lifecycle Report

### Promotion: 03-ready-for-review → 04-implemented

**Date:** 30-October-2026

**Promotion trigger:** User approval — user reviewed all review docs and stated "I approve this slice to be promoted."

**Changes since entering review:**

1. **SEC-D7-007 argument order bug fix** — Swapped `expense._id`/`expense.paidBy` in `renderExpenseNotificationEmail` call in `expenses.ts`; added `getUserDisplayName()` Clerk API lookup helper, exported for testing.

2. **SEC-D7-008 PII return values** — Verified both `notifyExpensePending` and `notifySettlementCreated` return `{ sent: true }` only; updated test assertions in `expenses.test.ts`.

3. **SEC-D7-009 HTTPS validation** — Added HTTPS scheme check in `sendEmail()` and `generateUnsubscribeLink()` in `email.ts`; throws for non-HTTPS `NEXT_PUBLIC_APP_URL`.

4. **SEC-D7-010 rate limiting** — Implemented `checkAndIncrementRateLimit()` in `email.ts` with `emailRateLimits` Convex table: per-org daily cap (`DAILY_EMAIL_CAP = 100`) + per-user 1-hour cooldown. Both `sendEmail()` and notification actions call this before sending.

5. **orgs:create action** — Updated to insert into Convex `orgs` table with `emailSettings` defaults and `slug` from Clerk org ID, ensuring email settings lookups succeed.

6. **Test updates:**
   - `convex/values` mocks updated with `optional` in `email.test.ts` and `email-templates.test.ts`
   - `orgs.test.ts` `makeCtx()` updated for `emailRateLimits` query shape
   - `settlements.test.ts` sendEmail assertion updated for `orgId`/`userId` args
   - Added 12 security tests (SEC-D7-001 through SEC-D7-010) across `d7-security.test.ts` and `expenses.test.ts`
   - Total: 272 tests passing (was 241)

**Verification:**
- `npm run lint` — 0 problems
- `npx vue-tsc --noEmit` — 0 errors
- `npm test` — 272 passing, 0 failures
- `npm run docs:lint` — 0 errors
- `npx tsx docs/scripts/docs-audit.ts` — 0 warnings
