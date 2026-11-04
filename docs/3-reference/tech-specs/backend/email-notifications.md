---
status: Draft
package: backend
priority: medium
created: 25-October-2026
updated: 25-October-2026
tags: [backend, email, resend, notifications, onboarding]
---

# Tech Spec: Email Notifications

**Date:** 25-October-2026
**Status:** Draft
**Audience:** Backend engineers

## 1. Purpose

Define the transactional email system for Happy House Bills. Emails are sent via Resend and dispatched asynchronously through Convex's scheduler. Two email types are defined in v1: organisation invite emails (sent during onboarding) and pending-expense notifications (sent when a partner records an expense requiring confirmation).

## 2. Scope

### In scope

- Resend SDK integration in Convex (via `@resend/convex` or HTTP action)
- Invite email template — HTML with deep link to Clerk sign-in with org context
- Pending-expense notification email — HTML with expense summary and deep link
- Asynchronous dispatch via Convex scheduler (`runAfter`)
- Template structure: shared header, dynamic body, shared footer with unsubscribe link
- Deep link format: `https://app.happyhousebills.com/invite?token=<inviteToken>` for invites, `https://app.happyhousebills.com/?expense=<expenseId>` for expense notifications
- Environment variables and sender identity configuration

### Out of scope

- Email template UI design (covered by `tech-specs/frontend/ui-spec.md`)
- Push notifications (out of scope for v1 per `project_brief.md`)
- In-app notification UI (deferred to Phase 2)
- Bulk email campaigns (not needed for v1)

## 3. Key Decisions

| ID | Decision | Rationale | Source |
|----|----------|-----------|--------|
| D1 | Use Resend for transactional email | Cheap, reliable, good DX with React-like templates; integrates with Cloudflare Workers | `project_brief.md` (## 2. Tech Stack) |
| D2 | Dispatch emails via Convex scheduler, not inline | Avoids blocking the user-facing mutation; retries automatically on transient failures | `tech-specs/backend/api-contract.md` D4 |
| D3 | Deep links use Clerk's invite token flow for onboarding emails | Clerk handles invite acceptance, org joining, and session creation natively | `domains/01-auth/onboarding-auth.md` D3 |
| D4 | Expense notification deep links use `expenseId` query param | Frontend reads the param and scrolls to the pending expense in the list | `user-flows.md` (## 2. Receipt Upload & OCR) |
| D5 | HTML templates use inline CSS (no external stylesheets) | Email clients strip `<head>` and `<link>` tags; inline ensures consistent rendering | Adapted from Resend best practices |
| D6 | From address: `noreply@happyhousebills.com` (verified domain) | Consistent sender; domain verified in Resend dashboard | `project_brief.md` (## 2. Tech Stack) |

## 4. Open Questions

| ID | Question | Status | Notes |
|----|----------|--------|-------|
| (none) | — | — | — |

## 5. Cross-References

- `tech-specs/architecture/deployment.md` — `RESEND_API_KEY` and `RESEND_FROM_EMAIL` env vars
- `tech-specs/backend/api-contract.md` — `orgs:create` mutation triggers invite email
- `domains/01-auth/onboarding-auth.md` — invite flow integration
- `domains/08-notifications/email-notifications.md` — domain-level notification workflow
- `tech-specs/frontend/ui-spec.md` — notification toast patterns (in-product)
- `spec-gaps.md` — gap tracking

## 6. Implementation Dependencies

- **Depends on:** `api-contract.md` (mutation triggers), `onboarding-auth.md` (invite token generation)
- **Blocks:** `domains/08-notifications/email-notifications.md`
- **Consumer integration:** Convex `orgs:create` and `expenses:approve` mutations schedule email actions

## 7. Email Templates

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
    <p><strong>{{payer_name}}</strong> added an expense of <strong>${{amount}}</strong> for <em>{{category}}</em>. Please review and confirm.</p>
    <a href="{{deep_link}}" style="display: inline-block; padding: 12px 24px; background: #10b981; color: white; text-decoration: none; border-radius: 8px;">
      Review Expense
    </a>
  </body>
</html>
```

## 8. Deep Link Format

| Email type | Deep link | Frontend handler |
|-----------|-----------|-----------------|
| Invite | `https://app.happyhousebills.com/invite?token=<token>` | `pages/invite.vue` — accepts invite, joins org |
| Expense notification | `https://app.happyhousebills.com/?expense=<expenseId>` | `pages/index.vue` — scrolls to pending expense |

## 9. Environment Variables

| Variable | Description |
|----------|-------------|
| `RESEND_API_KEY` | Resend API key (server-side Convex env) |
| `RESEND_FROM_EMAIL` | Verified sender address (e.g. `noreply@happyhousebills.com`) |
| `NEXT_PUBLIC_APP_URL` | Base URL for deep links (e.g. `https://app.happyhousebills.com`) |
