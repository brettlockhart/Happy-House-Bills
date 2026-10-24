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

## Purpose

Define how Happy House Bills handles authentication and multi-tenancy using Clerk
Organizations. Each household is a Clerk organisation with exactly two members. The onboarding
flow ensures users land in an organisation with their partner before seeing any expense data.

## Scope

### In scope

- Clerk signup and sign-in flows via `@clerk/nuxt`
- Organisation creation on first signup
- Invite generation and email delivery via Resend
- Partner acceptance of the invite
- `orgId` derivation in Convex from the Clerk session
- Enforcement that a user belongs to exactly one organisation

### Out of scope

- Password reset flows (Clerk handles natively)
- Multi-organisation switching (explicitly excluded in v1 — `project_brief.md` §215)
- Team plan / subscription tiers (no monetisation in v1)

## Key Decisions

| ID | Decision | Rationale | Source |
|----|----------|-----------|--------|
| D1 | Use Clerk organisations for household multi-tenancy | Matches the "one household = one org, two members" model directly | `project_brief.md` §26-32 |
| D2 | `orgId` extracted from Clerk session JWT, passed to Convex | Convex reads `auth.getUserId()` and the org from the session token | `project_brief.md` §29-30 |
| D3 | Invite flow uses Resend email with deep link | Matches the email notification architecture; no in-app invite UI in v1 | `project_brief.md` §170-182 |
| D4 | Enforce single-org membership in application logic | Clerk does not natively restrict to one org per user; we enforce in the onboarding guard | `project_brief.md` §32 |

## Open Questions

| ID | Question | Status | Notes |
|----|----------|--------|-------|
| BB-Q3 | What happens if User B's email is already associated with a different Clerk org? | Open | v1 should block and show an error |

## Cross-References

- `tech-specs/backend/data-model.md` — `orgId` on all tables
- `tech-specs/backend/api-contract.md` — `orgs:create` mutation
- `tech-specs/backend/email-notifications.md` — invite email template
- `user-flows.md` §1 — onboarding flow diagram
- `project_brief.md` §25-32

## Implementation Dependencies

- **Depends on:** None (foundational auth)
- **Blocks:** All domain specs that query user-scoped data
- **Consumer integration:** Frontend `useAuth` composable wraps `@clerk/nuxt`; Convex functions call `getAuthUser(ctx)`

## Onboarding Flow

```
1. User A signs up via Clerk
2. Frontend calls `orgs:create` → creates Clerk organisation
3. System generates invite link → sends email via Resend
4. User B clicks link → accepts invite → joins organisation
5. Both users are now members; app loads with org-scoped data
```

## Auth Context in Convex

```typescript
// convex/auth.ts
import { getAuthUser } from "@convex-dev/clerk-auth";

export const getOrgId = async (ctx: any) => {
  const user = await getAuthUser(ctx);
  if (!user) throw new Error("Unauthenticated");
  return user.org_id;
};
```

Every query and mutation calls `getOrgId(ctx)` and scopes by it.
