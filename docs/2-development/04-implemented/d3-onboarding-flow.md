---
status: Implemented
lifecycle: 04-implemented
phase: Phase 1
slice: D3
created: 26-October-2026
updated: 28-October-2026
depends_on: [D1]
blocks: []
owner: backend-engineer
priority: P0
---

# D3 — Onboarding Flow

## 1. Purpose

Implement the household onboarding flow: User A creates an organisation and sends an invite
email to User B via Resend. User B accepts the invite link and joins the household as the
second member. Enforces exactly 2 members per household.

## 2. Scope

### In scope

- `orgs:create` Convex action — creates a Clerk organisation via Clerk Backend API
- `orgs:invite` Convex action — generates a token, stores in Convex invites table, sends Resend email with deep link
- `orgs:acceptInvite` Convex action — validates token, adds user to Clerk org, checks member count
- `orgs:listPendingInvites` Convex query — lists pending invites for the current org
- Frontend `useAuth` composable wrapping `@clerk/nuxt` (via `useAuth`, `useUser`, `useOrganization`)
- `useOrgs` composable wrapping Convex org actions via `useConvexClient`
- Onboarding page (`app/pages/onboard.vue`) with partner email input
- Email template for household invitation (HTML via Resend API)
- Frontend route guard (`app/middleware/auth.global.ts`) — redirect unauthenticated users to /sign-in
- Member count enforcement (exactly 2 per household)
- Invite token with 7-day expiry and member count check

### Out of scope

- Clerk signup/sign-in forms (handled natively by `@clerk/nuxt`)
- Multi-organisation switching (explicitly excluded in v1)
- Password reset flows (Clerk handles natively)
- Team plan / subscription tiers (no monetisation in v1)

## 3. Key Decisions

| ID | Decision | Rationale | Source |
|----|----------|-----------|--------|
| D1 | Use Convex `action` for `orgs:create` and `orgs:invite` (not `mutation`) | Actions can make external API calls (Clerk Backend API, Resend); mutations cannot | `api-contract.md` D3 |
| D2 | Invite tokens stored in Convex `invites` table (not Clerk metadata) | Allows token expiry, one-time use, and audit trail in Convex; avoids Clerk API limits on metadata | `data-model.md` §5 (invites table) |
| D3 | Deep-link invitation URL with `?token=` query param | Matches email notification architecture; no in-app invite UI in v1 | `onboarding-auth.md` D3 |
| D4 | Enforce 2-member limit at `acceptInvite` (not at invite creation) | Allows flexibility in user sign-up timing; check is at join time | `onboarding-auth.md` D4 |
| D5 | `auth.global.ts` uses auto-imports for Clerk `useAuth` and Nuxt `defineNuxtRouteMiddleware`/`navigateTo` | Nuxt 4 auto-imports make explicit imports redundant; `#imports` module path unreliable in tsconfig | `AGENTS.md` §5 |

## 4. Open Questions

| ID | Question | Status | Resolution Owner | Target Phase |
|----|----------|--------|------------------|--------------|
| BB-Q3 | What happens if User B's email is already associated with a different Clerk org? | Resolved | backend-engineer | Phase 1 — Block and show error message |

> BB-Q3 resolution: Before sending invite, `orgs:invite` checks the Clerk API for existing
> memberships and user organisations. If the email is already in a Clerk org, the function
> throws an error: "This email is already associated with another household. Please use a
> different email or sign in to your existing account."

## 5. Cross-References

- `domains/01-auth/onboarding-auth.md` — auth context wiring, JWT template config
- `tech-specs/backend/api-contract.md` — API patterns and auth helper usage
- `tech-specs/backend/data-model.md` — `invites` table schema
- `tech-specs/backend/email-notifications.md` — Resend integration patterns
- `domains/11-security/security.md` — auth enforcement, cross-tenant isolation, invite token security

## 6. Implementation Dependencies

- **Depends on:** D1 — Expense Management Foundation (auth helper pattern in `convex/auth.ts`)
- **Blocks:** All domain specs that query user-scoped data (auth + org context required)
- **Consumer integration:** Frontend `useAuth` composable wraps `@clerk/nuxt`; Convex functions call `requireAuthenticatedOrg(ctx)`

## 7. Implementation

### 7.1 Auth Helper (`convex/auth.ts`)

Two auth helpers export from `convex/auth.ts`:

```typescript
// Require an authenticated user (for onboarding entry points)
export async function requireAuthenticatedUser(
  ctx: { auth: { getUserIdentity: () => Promise<UserIdentity | null> } }
): Promise<{ userId: string }>

// Require an authenticated user with an active org (for org-scoped operations)
export async function requireAuthenticatedOrg(
  ctx: { auth: { getUserIdentity: () => Promise<UserIdentity | null> } }
): Promise<{ userId: string; orgId: string }>
```

The `orgId` is extracted from the Clerk JWT `org_id` custom claim (see
`onboarding-auth.md` §8.1 for JWT template configuration).

### 7.2 Schema (`convex/schema.ts`)

The `invites` table:

```typescript
invites: defineTable({
  token: v.string(),
  email: v.string(),
  orgId: v.string(),
  orgName: v.string(),
  inviteeUserId: v.optional(v.string()),
  createdBy: string,
  expiresAt: v.number(),
  createdAt: v.number(),
  updatedAt: v.number(),
})
.index("by_token", ["token"])
.index("by_email", ["email"])
.index("by_org", ["orgId"]),
```

### 7.3 Convex Functions (`convex/functions/orgs.ts`)

Three actions and one query:

- **`create`** — Calls Clerk Backend API `POST /v3/organizations` to create a new org. Requires authenticated user.
- **`invite`** — Requires authenticated org. Validates email format, checks existing memberships/orgs via Clerk API, generates `crypto.randomUUID()` token, stores invite in Convex `invites` table, sends Resend email with deep link.
- **`acceptInvite`** — Requires authenticated user. Validates token via Convex db lookup, checks expiry, enforces 2-member limit, adds user to Clerk org via `POST /v3/organizations/{org_id}/memberships`.
- **`listPendingInvites`** — Query requiring authenticated org. Returns invites for current org that are pending and not expired.

### 7.4 Frontend

**`app/composables/useOrgs.ts`** — Provides `useOrgs()` composable wrapping Convex actions via `useConvexClient`:

```typescript
export function useOrgs() {
  const client = useConvexClient();
  return {
    createOrg: (args: { name: string }) =>
      client.action(api.orgs.create, args),
    invitePartner: (args: { email: string; orgId: string; orgName?: string }) =>
      client.action(api.orgs.invite, args),
    acceptInvite: (args: { token: string }) =>
      client.action(api.orgs.acceptInvite, args),
  };
}
```

**`app/pages/onboard.vue`** — Household creation form with partner email input. Calls `createOrg` then `invitePartner` in sequence.

**`app/middleware/auth.global.ts`** — Route guard using Clerk's `useAuth()` to check authentication state. Redirects unauthenticated users to `/sign-in`.

### 7.5 Tests

- `__tests__/convex/orgs.test.ts` — 12 tests covering auth enforcement, cross-tenant org mismatch (SEC-007), email validation (SEC-008), token expiry (SEC-008), member count enforcement (SEC-005), invalid token (SEC-008), and listPendingInvites
- `__tests__/convex/auth.test.ts` — 8 tests covering `requireAuthenticatedUser` and `requireAuthenticatedOrg` null identity, empty userId, missing orgId, and happy paths (SEC-001, SEC-004)

## 8. Lifecycle Report

**Start of slice:** 26-October-2026 — moved from `01-draft` → `02-in-progress`
**End of slice:** 28-October-2026 — implementation review complete, promoted to `04-implemented`

| Check | Command | Status | Notes |
|-------|---------|--------|-------|
| `npm run lint` | ESLint | ✅ Pass | 0 errors, 0 warnings |
| `npx nuxt typecheck` | TypeScript | ✅ Pass | 0 errors |
| `npm test` | Vitest | ✅ Pass | 88 tests, 6 files |
| `npm run docs:lint` | doc-lint.ts | ✅ Pass | 0 errors, 0 warnings |
| Auth enforcement | Manual review | ✅ Verified | `requireAuthenticatedUser`/`requireAuthenticatedOrg` on all 4 function entry points |
| Cross-tenant isolation | SEC-001 | ✅ Verified | `args.orgId !== callerOrgId` check in `invite`; orgId from JWT `org_id` claim |
| Token security | SEC-004 | ✅ Verified | `crypto.randomUUID()` (not Math.random); 7-day expiry; single-use via `inviteeUserId` patch |
| Member count enforcement | SEC-005 | ✅ Verified | `members.length >= 2` check at `acceptInvite` |
| Email validation | SEC-008 | ✅ Verified | `args.email.includes("@")` check; cross-org membership prevention |

**Security review:** Conditional Pass — all SEC-001 through SEC-008 controls implemented. Full report at `docs/2-development/supporting-docs/reviews/d3-security-review.md`.

**Test coverage review:** Coverage improved from 44% to 66% on `orgs.ts` after adding 12 new tests. Auth helpers at 100% coverage. Full report at `docs/2-development/supporting-docs/reviews/d3-test-coverage-report.md`.

**Implementation review:** Completed — verdict Pass. Full report at `docs/2-development/supporting-docs/reviews/d3-onboarding-flow-review.md`.

## 9. Acceptance Criteria

- [x] `npm run lint` — 0 problems
- [x] `npx tsc --noEmit` — 0 errors (verified via `nuxt typecheck`)
- [x] `npm test` — 0 failures (88 tests)
- [x] `npm run docs:lint` — 0 errors
- [x] User A can create an organisation and receive a Clerk org ID
- [x] Invite email sent via Resend with valid 7-day expiry link
- [x] User B can accept invite and join the organisation
- [x] App rejects 3rd member attempt with error message
- [x] Users without an org are redirected to onboarding (route guard in place)
- [x] `BB-Q3` resolved: duplicate email on existing org shows error
