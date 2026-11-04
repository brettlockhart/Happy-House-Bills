---
status: Draft
package: app
priority: medium
created: 25-October-2026
updated: 25-October-2026
tags: [notifications, email, resend, expenses, settlements]
---

# Domain Spec: Email Notifications

**Date:** 25-October-2026
**Status:** Draft
**Audience:** Backend engineers

## 1. Purpose

Define the email notification domain: what triggers an email, what content it contains, and how it is dispatched. Two email types exist in v1 — organisation invite emails (onboarding) and pending-expense notifications (when a partner creates an expense that requires the other partner's confirmation).

## 2. Scope

### In scope

- Invite email: sent when `orgs:create` mutation creates a Clerk organisation and generates an invite
- Pending-expense email: sent when an expense is created with `status: "pending"` (the partner needs to review)
- Email dispatch via Resend API (asynchronous via Convex scheduler)
- Email templates: HTML with inline CSS, deep links to the app
- Deep link format: invite uses `https://app.happyhousebills.com/invite?token=<token>`; expense notification uses `https://app.happyhousebills.com/?expense=<expenseId>`
- No in-app notification UI (deferred to Phase 2)

### Out of scope

- Email template styling (covered by `tech-specs/frontend/ui-spec.md`)
- Resend SDK integration (covered by `tech-specs/backend/email-notifications.md`)
- CI/CD deployment env vars (covered by `tech-specs/architecture/deployment.md`)
- Push notifications (out of scope per `project_brief.md`)

## 3. Key Decisions

| ID | Decision | Rationale | Source |
|----|----------|-----------|--------|
| D1 | Invite emails sent during onboarding, after `orgs:create` | Partner needs to receive the invite to join the household | `domains/01-auth/onboarding-auth.md` D3 |
| D2 | Pending-expense emails sent immediately after `expenses:create` | Partner should know there's a pending expense to confirm | `user-flows.md` (## 2. Receipt Upload & OCR) |
| D3 | Emails dispatched via Convex scheduler (`runAfter`) | Decouples notification delivery from the user-facing mutation path | `tech-specs/backend/api-contract.md` D4 |
| D4 | Deep links use Clerk invite tokens for onboarding and `expenseId` for expense notifications | Clerk handles invite acceptance natively; expense deep link lets partner jump to the pending item | `tech-specs/backend/email-notifications.md` D3, D4 |

## 4. Open Questions

| ID | Question | Status | Notes |
|----|----------|--------|-------|
| NOT-Q1 | Should we send a notification when an expense is approved/rejected? | Open | Phase 2 consideration; could inform the user without them checking the app. |

## 5. Cross-References

- `tech-specs/backend/email-notifications.md` — Resend integration, templates, deep links
- `tech-specs/backend/api-contract.md` — `orgs:create` mutation triggers invite; `expenses:create` triggers notification
- `domains/01-auth/onboarding-auth.md` — invite flow, org creation
- `domains/02-expenses/expense-management.md` — pending expense triggers notification
- `tech-specs/frontend/ui-spec.md` — toast notification patterns (in-product, Phase 2)
- `spec-gaps.md` — gap tracking

## 6. Implementation Dependencies

- **Depends on:** `email-notifications.md` (backend), `api-contract.md`, `onboarding-auth.md`, `expense-management.md`
- **Blocks:** None (notification consumer)
- **Consumer integration:** Convex `orgs:create` and `expenses:create` mutations schedule email actions via `runAfter`

## 7. Notification Triggers

| Event | Trigger mutation | Email type | Recipient | Content |
|-------|-----------------|-----------|-----------|---------|
| Household created | `orgs:create` | Invite | Partner (User B) | Accept invite to join household |
| Expense created (pending) | `expenses:create` | Pending review | Other partner | New expense needs your confirmation |
| Expense approved | (future) | Approved | Expense creator | Partner confirmed your expense |
| Settlement recorded | (future) | Settlement notice | Partner | You settled up for $X.XX |

## 8. Email Templates

### Invite Email

```html
<html>
  <body style="font-family: system-ui, sans-serif; color: #0f172a; max-width: 600px; margin: 0 auto;">
    <h2>You're invited to join Happy House Bills</h2>
    <p>User A has invited you to share household expense tracking.</p>
    <p>Click below to accept the invitation and create your account:</p>
    <a href="{{deep_link}}" style="display: inline-block; padding: 12px 24px; background: #10b981; color: white; text-decoration: none; border-radius: 8px;">
      Accept Invite
    </a>
    <p style="color: #64748b; font-size: 12px;">This link expires in 7 days.</p>
  </body>
</html>
```

### Pending Expense Notification

```html
<html>
  <body style="font-family: system-ui, sans-serif; color: #0f172a; max-width: 600px; margin: 0 auto;">
    <h2>New expense pending your confirmation</h2>
    <p><strong>{{payer_name}}</strong> added an expense of <strong>${{amount}}</strong> for <em>{{category}}</em>.</p>
    <p>Please review and confirm or reject.</p>
    <a href="{{deep_link}}" style="display: inline-block; padding: 12px 24px; background: #10b981; color: white; text-decoration: none; border-radius: 8px;">
      Review Expense
    </a>
  </body>
</html>
```
