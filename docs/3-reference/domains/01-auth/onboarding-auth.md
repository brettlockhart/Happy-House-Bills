---
status: Draft
package: app
priority: high
created: 24-October-2026
updated: 24-October-2026
tags: [auth, onboarding, clerk, multi-tenancy]
---

# Domain Spec: Authentication & Onboarding

**Date:** 24-October-2026
**Status:** Draft
**Audience:** Backend engineers, frontend engineers

## 1. Purpose

Define how Happy House Bills handles authentication and multi-tenancy using Clerk
Organizations. Each household is a Clerk organisation with exactly two members. The onboarding
flow ensures users land in an organisation with their partner before seeing any expense data.

## 2. Scope

### In scope

- Clerk signup and sign-in flows via `@clerk/nuxt`
- Organisation creation on first signup
- Invite generation and email delivery via Resend
- Partner acceptance of the invite
- `orgId` derivation in Convex from the Clerk session
- Enforcement that a user belongs to exactly one organisation

### Out of scope

- Password reset flows (Clerk handles natively)
- Multi-organisation switching (explicitly excluded in v1 — `project_brief.md`)
- Team plan / subscription tiers (no monetisation in v1)

## 3. Key Decisions

| ID | Decision | Rationale | Source |
|----|----------|-----------|--------|
| D1 | Use Clerk organisations for household multi-tenancy | Matches the "one household = one org, two members" model directly | `project_brief.md` (## Multi-Tenancy Model) |
| D2 | `orgId` extracted from Clerk JWT `org_id` claim via Convex `getUserIdentity()` | Configure Clerk JWT template to include `org_id`; Convex whitelists the claim | `project_brief.md` (## Multi-Tenancy Model) |
| D3 | Invite flow uses Resend email with deep link | Matches the email notification architecture; no in-app invite UI in v1 | `project_brief.md` (## Tech Stack) |
| D4 | Enforce single-org membership in application logic | Clerk does not natively restrict to one org per user; we enforce in the onboarding guard | `project_brief.md` (## Multi-Tenancy Model) |

## 4. Open Questions

| ID | Question | Status | Notes |
|----|----------|--------|-------|
| BB-Q3 | What happens if User B's email is already associated with a different Clerk org? | Resolved | v1 should block and show an error message. Document the error copy in D4 of the onboarding flow. |

## 5. Cross-References

- `tech-specs/backend/data-model.md` — `orgId` on all tables
- `tech-specs/backend/api-contract.md` — `orgs:create` mutation
- `tech-specs/backend/email-notifications.md` — invite email template
- `user-flows.md` — onboarding flow diagram
- `project_brief.md` (## Multi-Tenancy Model)

## 6. Implementation Dependencies

- **Depends on:** None (foundational auth)
- **Blocks:** All domain specs that query user-scoped data
- **Consumer integration:** Frontend `useAuth` composable wraps `@clerk/nuxt`; Convex functions call `getAuthUser(ctx)`

## 7. Onboarding Flow

```
1. User A signs up via Clerk
2. Frontend calls `orgs:create` → creates Clerk organisation
3. System generates invite link → sends email via Resend
4. User B clicks link → accepts invite → joins organisation
5. Both users are now members; app loads with org-scoped data
```

## 8. Auth Context in Convex

The project uses `@clerk/nuxt` (installed) for frontend auth via the `useAuth()` composable.
On the Convex backend, auth context is derived from the Clerk session JWT passed through
the `@clerk/nuxt` middleware. Convex extracts the `UserIdentity` via `ctx.auth.getUserIdentity()`.

### 8.1 Clerk JWT Template Configuration

The `org_id` claim must be present in the JWT for multi-tenant isolation. Configure the
Clerk Frontend API JWT template as follows in the Clerk dashboard:

```json
{
  "type": "template",
  "properties": {
    "org_id": "{{org.id}}"
  }
}
```

This injects the current organisation's ID as a custom claim in the session JWT.
Convex must whitelist `org_id` in its auth configuration so it appears on
`getUserIdentity()`.

### 8.2 Auth Helper Implementation

The canonical auth helper lives in `convex/auth.ts`:

```typescript
export async function requireAuthenticatedOrg(
  ctx: { auth: { getUserIdentity: () => Promise<UserIdentity | null> } }
): Promise<{ userId: string; orgId: string }> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("Unauthenticated");
  }
  const userId = identity.subject;
  const orgId = identity.org_id; // from Clerk JWT template custom claim
  if (!userId || !orgId) {
    throw new Error("Unauthenticated or no organisation");
  }
  return { userId, orgId };
}
```

Every query and mutation calls `requireAuthenticatedOrg(ctx)` and scopes by `orgId`.
Cross-tenant checks enforce `expense.orgId === orgId` on every data access path.
