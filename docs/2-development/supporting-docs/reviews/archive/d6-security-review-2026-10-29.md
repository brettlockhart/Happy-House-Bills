---
status: Complete
lifecycle: reviews
slice: D6
security_review: true
scope: slice-level
created: 28-October-2026
updated: 28-October-2026
---

# D6 — Frontend UI Shell — Security Review

**Reviewer:** Security review (automated + manual)  
**Review type:** Slice-level (code + design)  
**Scope:** `app/app.vue`, `app/pages/index.vue`, `app/components/EntryList.vue`, `app/components/SettleUpModal.vue`, `app/assets/css/tokens.css`, `app/utils/formatting.ts`  

---

## 1. Threat Model Summary (STRIDE)

| Threat | Description | Mitigated? |
|--------|-------------|------------|
| **Spoofing** | Attacker spoofs another user to create expenses/settlements on their behalf | ✅ Auth enforced via Clerk + `requireAuthenticatedOrg` at Convex boundary |
| **Tampering** | Attacker modifies expense amounts or settlement amounts in the UI | ✅ All mutations validate on server via Convex validators |
| **Repudiation** | User denies creating an expense | ✅ `enteredBy` set from JWT subject server-side |
| **Information disclosure** | Exposure of another user's expense/settlement data | ✅ All queries scoped to org via server-derived `orgId` |
| **Denial of service** | Attacker floods mutation calls | ✅ Convex rate limiting applies at platform level |
| **Elevation of privilege** | Attacker bypasses auth-gated shell | ✅ `app/app.vue` gates on `isSignedIn` from Clerk |

---

## 2. Scope and Sensitivity

| Field | Value |
|-------|-------|
| Affected files | `app/app.vue`, `app/pages/index.vue`, `app/components/EntryList.vue`, `app/components/SettleUpModal.vue`, `app/assets/css/tokens.css`, `app/utils/formatting.ts` |
| Authentication or authorisation | Yes — uses Clerk auth via `useAuth()` + Convex `requireAuthenticatedOrg` |
| Billing or entitlements | No |
| File upload or export | No |
| Iframe, CSP, or preview | No |
| User data or PII | Yes — amounts, dates shown in UI |

---

## 3. Findings

| ID | Severity | Title | Status |
|----|----------|-------|--------|
| D6-SEC-001 | N/A | Auth-gated app shell | ✅ Pass |
| D6-SEC-002 | N/A | No XSS via v-html | ✅ Pass |
| D6-SEC-003 | N/A | No secrets in client code | ✅ Pass |
| D6-SEC-004 | N/A | Server-side mutation validation | ✅ Pass |
| D6-SEC-005 | Info | Input length not validated client-side | ✅ Pass (server-validated) |

---

## 4. Detailed Analysis

### D6-SEC-001: Auth-gated app shell — ✅ Pass

`app/app.vue` wraps the entire application:

```vue
<SignIn v-if="!isSignedIn" />
<NuxtPage v-else />
```

- `useAuth()` (from `app/composables/useAuth.ts`) wraps Clerk's `useAuth` and `useOrganization` composables
- Unauthenticated users are shown Clerk's `<SignIn>` component
- Authenticated users see `<NuxtPage>` which renders the index page
- The existing `app/middleware/auth.global.ts` middleware also enforces auth on all routes (redirects to `/sign-in`)
- The `auth.global.ts` middleware will redirect unauthenticated users, but the `<SignIn>` component provides the fallback when the middleware hasn't redirected yet (e.g., on initial load)

### D6-SEC-002: No XSS via v-html — ✅ Pass

No `v-html` directives are used anywhere in the D6 files. All text interpolation uses Vue's built-in escaping (`{{ }}` syntax). User-entered data (expense notes, dates, amounts) is rendered through escaped interpolation only.

### D6-SEC-003: No secrets in client code — ✅ Pass

- No `console.log` statements in any D6 file
- No environment variables accessed client-side
- No API keys or tokens in frontend code
- The Convex URL and publishable keys are managed through Nuxt's `runtimeConfig.public` (configured in `nuxt.config.ts`)

### D6-SEC-004: Server-side mutation validation — ✅ Pass

All mutations that modify data are Convex mutations that validate their arguments server-side:

- `expenses:create` — uses `v.object()` schema with `v.number()`, `v.string()` validators
- `settlements:create` — uses `v.object()` schema with `v.number()`, `v.string()` validators
- `expenses:approve` / `expenses:reject` — uses `v.id()` and `v.string()`

Client-side form data is validated via HTML5 form validation (`required`, `type="number"`, `step="0.01"`, `min="0.01"`) but the real enforcement is server-side.

### D6-SEC-005: Input length not validated client-side — Info

The expense notes textarea and settlement amount inputs have no `maxlength` or `min`/`max` attributes set at the HTML level. While this is acceptable for an MVP (server-side validation enforces constraints), adding `maxlength` would improve UX by providing immediate feedback. This is a minor enhancement for a future slice.

---

## 5. Security Test Plan

| ID | Test | Status |
|----|------|--------|
| None required | D6 is a presentation-layer slice with no new backend surfaces | N/A |

D6 introduces no new Convex functions, webhooks, or server-side endpoints. All security-critical operations (auth, validation, org-scoping) are enforced by existing Convex functions from D1-D5. No new security tests are required for this slice.

---

## 6. Verdict

**Pass** — The D6 Frontend UI Shell implementation introduces no new security surfaces. All user interactions route through existing Convex mutations that enforce authentication, org-scoping, and input validation server-side.

Key security properties verified:
- Auth-gated shell prevents unauthenticated access to the application
- No `v-html` usage eliminates XSS risk from user-entered data
- No secrets in client code
- All mutations validate server-side via Convex validators

**Spec-level controls:** N/A (no auth/payment/iframe/export changes in this slice).  
**Implementation-level verification:** Not required for presentation-layer only changes.
