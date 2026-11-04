---
status: Complete
lifecycle: reviews
slice: D6
security_review: true
scope: slice-level
created: 29-October-2026
updated: 29-October-2026
---

# D6 — Frontend UI Shell — Security Review

**Reviewer:** Security Engineer (automated + manual code review)
**Review type:** Slice-level (code + design)
**Date:** 29-October-2026
**Scope:** `app/app.vue`, `app/pages/index.vue`, `app/components/EntryList.vue`, `app/components/SettleUpModal.vue`, `app/components/AddExpenseModal.vue`, `app/assets/css/tokens.css`, `app/utils/formatting.ts`, `app/middleware/auth.global.ts`, `nuxt.config.ts`

---

## Scope and Sensitivity

| Field | Value |
|-------|-------|
| Affected files | `app/app.vue`, `app/pages/index.vue`, `app/components/EntryList.vue`, `app/components/SettleUpModal.vue`, `app/components/AddExpenseModal.vue`, `app/assets/css/tokens.css`, `app/utils/formatting.ts`, `app/middleware/auth.global.ts`, `nuxt.config.ts` |
| Authentication or authorisation | Yes — Clerk auth via `useAuth()` composables; Convex `requireAuthenticatedOrg` at all mutation/query boundaries |
| Billing or entitlements | No |
| File upload or export | No |
| Iframe, CSP, or preview | No iframe, no postMessage, no preview/export pipeline |
| User data or PII | Yes — expense amounts, dates, notes, settlement amounts (display-only; stored server-side) |

---

## Threat Model (STRIDE)

| Asset | Trust boundary | Data flow | Threat | Mitigation | Residual risk |
|-------|----------------|-----------|--------|------------|---------------|
| Authenticated UI shell | Client ↔ Clerk/Convex | `app.vue` gates render on `isSignedIn` + `hasOrg` from Clerk; `auth.global.ts` middleware redirects | Unauthenticated access to app UI | Middleware redirects to `/sign-in`; `app.vue` renders `<SignIn>` fallback; Convex `requireAuthenticatedOrg` blocks all queries | Info — brief pre-redirect render of index page for signed-in users without org; no data loads (queries fail server-side) |
| Org-redirect path | Client ↔ Clerk | `auth.global.ts:14-15` redirects `isSignedIn && !hasOrg` to `/onboard` | User lands on app with no org and sees data | Middleware guards all non-auth routes; Convex queries call `requireAuthenticatedOrg` which throws for no-org users | None — redirect is correct; server-side guard is the backstop |
| Expense/settlement entry list | Client ↔ Convex | `useConvexQuery` fetches org-scoped data; display via Vue `{{ }}` | Tampering with displayed amounts; viewing other org's entries | Queries scoped to `by_org` index server-side; `orgId` derived from JWT `org_id` claim via `requireAuthenticatedOrg` (convex/auth.ts:19-38) | None |
| Expense creation form | Client → Convex mutation | `createExpense()` sends form data to `expenses:create` (convex/functions/expenses.ts:9-64) | Submit negative or invalid amounts | HTML5 `type="number"`, `step="0.01"`, `required`; server-side `v.number()` validator | Low — no `min` attribute on amount input; server `expenses:create` lacks `amount > 0` check (contrast: `settlements:create` enforces `amount <= 0` at settlements.ts:20-22) |
| Settlement creation form | Client → Convex mutation | `createSettlement()` sends form data to `settlements:create` (convex/functions/settlements.ts:5-40) | Submit negative/void amounts; settle to self | HTML5 `min="0.01"`, `required`; client-side `amount <= 0` check (SettleUpModal.vue:30); server checks `amount <= 0` and `fromUser === toUser` | None |
| Expense notes field | Client → Convex → display | Free-text notes stored in Convex, displayed via `{{ entry.description }}` in EntryList.vue:84 | Stored XSS via notes field | Vue's `{{ }}` interpolation escapes HTML; no `v-html` anywhere (grep verified) | None |
| Runtime configuration | Build/Server → Client | `nuxt.config.ts` `runtimeConfig` exposes `clerkPublishableKey` + `convexUrl` publicly; secrets in private config | Secret leakage to client | Public/private config separation; private secrets in non-`public` runtimeConfig (server-only in Nuxt 4) | None |
| CSS design tokens | Build → Client | Static CSS in `tokens.css`; no dynamic values | CSS value injection or external resource loading | Plain CSS; no `url()`, no `@import`, no variable substitution into JS; no `expression()` | None |

---

## Security Checklist

| Control | Status | Evidence |
|---------|--------|----------|
| Authentication enforced at server boundary | ✅ Pass (existing) | `requireAuthenticatedOrg(ctx)` called at entry of every Convex query/mutation: `expenses:list` (expenses.ts:119), `expenses:balance` (expenses.ts:147), `expenses:pending` (expenses.ts:131), `expenses:create` (expenses.ts:24), `expenses:approve` (expenses.ts:69), `expenses:reject` (expenses.ts:96), `settlements:list` (settlements.ts:44), `settlements:create` (settlements.ts:13). Server derives `userId` from `identity.subject` and `orgId` from JWT `org_id` claim (convex/auth.ts:22-32). |
| Authorisation checked per operation | ✅ Pass (existing) | `expenses:create` checks `userId !== args.paidBy` → throw (expenses.ts:28-30); `expenses:approve/reject` check `expense.enteredBy === userId` → throw (expenses.ts:76-78, 102-104); `settlements:create` checks `args.fromUser !== userId` (settlements.ts:16-18) and `args.fromUser === args.toUser` (settlements.ts:24-26). |
| Inputs validated and size-limited | ⚠️ Partial | HTML5 form validation present (`type="number"`, `step="0.01"`, `required`); Convex `v.object()` validators enforce types. **Gaps:** AddExpenseModal amount input lacks `min="0.01"` (SettleUpModal has it); no `maxlength` on notes textarea; no client-side amount > 0 check in AddExpenseModal (SettleUpModal has it at line 30). See Findings 1 and 2. |
| Output encoded for HTML, CSS, and JavaScript contexts | ✅ Pass | No `v-html` or `dangerouslySetInnerHTML` anywhere in D6 files (grep verified); all dynamic text rendered via Vue's escaped `{{ }}` interpolation; CSS `:class` bindings use only enum-derived values (`entry.type` = "expense" | "settlement"); no `innerHTML` assignments; no `eval()` or `new Function()`. |
| CSP configured for preview and exports | N/A | No iframe, preview, or export pipeline in v1 (per security.md §2.4 Out of scope, ui-spec.md §2.3 Out of scope) |
| Iframe sandbox and postMessage origin validated | N/A | No `<iframe>` elements in any D6 file; no `postMessage` calls (grep verified) |
| Secrets absent from client code, logs, and errors | ✅ Pass | No `console.log` in any D6 file; no `process.env` access in client code; `nuxt.config.ts` places `clerkSecretKey`, `convexDeployKey`, `resendApiKey`, `r2AccessKeyId`, `r2SecretAccessKey` etc. in private `runtimeConfig` (server-only in Nuxt); only `clerkPublishableKey` (public by design) and `convexUrl` (non-secret endpoint) in `public` config. |
| Rate limits and replay protections configured | N/A (platform) | Convex framework handles rate limiting at the platform level; D6 introduces no new endpoints. |
| Webhook signatures verified | N/A (existing) | Webhook HMAC verification in `convex/http.ts` (security.md §11); D6 introduces no new webhooks. |
| Dependency findings triaged | N/A | No new dependencies introduced in D6; `convex-vue` and `@clerk/vue` are existing project dependencies. |

---

## Findings

| # | File or area | Finding | Severity | Required action |
|---|--------------|---------|----------|-----------------|
| D6-SEC-001 | `app/components/AddExpenseModal.vue:68` | Amount input lacks `min="0.01"` attribute; `handleSubmit()` (line 51) performs no positive-amount check before emitting; server-side `expenses:create` (convex/functions/expenses.ts:11) validates `v.number()` but does not enforce `amount > 0`. Contrast with SettleUpModal which has `min="0.01"` (line 43) and a client-side `form.amount <= 0` guard (line 30), and `settlements:create` which enforces `amount <= 0` server-side (settlements.ts:20-22). | Low | Add `min="0.01"` to the amount input; add client-side amount > 0 check in `handleSubmit()`; add `amount > 0` check to `expenses:create` Convex mutation |
| D6-SEC-002 | `app/components/AddExpenseModal.vue:84` | Notes `<textarea v-model="form.notes" />` has no `maxlength` attribute; server-side Convex validator `notes: v.optional(v.string())` (expenses.ts:19) enforces no length constraint. | Low | Add `maxlength` attribute consistent with data model; consider `v.string().maxLen(n)` on Convex schema |
| D6-SEC-003 | `app/pages/index.vue:47-51, 61-65` | `handleExpenseSubmit` and `handleSettleSubmit` pass `orgId: orgId.value` in mutation args, but neither `expenses:create` (expenses.ts:10-23) nor `settlements:create` (settlements.ts:6-11) declares an `orgId` arg. Server derives `orgId` from JWT via `requireAuthenticatedOrg` and never reads `args.orgId`. | Info | Remove client-side `orgId` from mutation calls to match Convex function signatures; not a security issue since server ignores the field |
| D6-SEC-004 | `app/app.vue:16` | `<NuxtPage v-else />` renders for signed-in users without an org (before `auth.global.ts` middleware redirects to `/onboard`), and does so without the `NuxtLayout` wrapper. | Info | No data leakage — all Convex queries fail via `requireAuthenticatedOrg`. Minor UX: brief flash before redirect. Consider wrapping in `NuxtLayout` or adding guard |

---

## Detailed Analysis

### D6-SEC-001: Amount validation gap in AddExpenseModal

**File:** `app/components/AddExpenseModal.vue:68`

The amount input is declared as:
```html
<input v-model.number="form.amount" type="number" step="0.01" required>
```

It lacks a `min` attribute, unlike the `SettleUpModal.vue:43` counterpart which correctly specifies `min="0.01"`. The `v-model.number` modifier ensures the value is coerced to a JavaScript `number`, but with `type="number"` the browser allows negative values and zero at the input level.

The `handleSubmit()` function (line 51-58) emits the form data with no validation:
```typescript
function handleSubmit() {
  emit("submit", { ...form });
  form.amount = 0;
  form.date = new Date().toISOString().split("T")[0] as string;
  form.category = "other";
  form.notes = "";
  form.paidBy = props.currentUserId;
}
```

Contrast with `SettleUpModal.vue:29-33` which has `if (form.amount <= 0) return;`.

On the server side, `expenses:create` (convex/functions/expenses.ts:9-23) validates `amount: v.number()` — this enforces type but not range. Compare with `settlements:create` (settlements.ts:20-22) which explicitly checks `if (args.amount <= 0) throw new Error("Settlement amount must be positive")`.

**Risk assessment:** Low. The expense is always `paidBy` the authenticated user (server-enforced at expenses.ts:28-30), so the worst case is a user creating a negative expense for themselves. Convex's `v.number()` validator prevents non-numeric input at the API boundary. The `step="0.01"` attribute enforces cent-level granularity.

**Recommendation:**
- Frontend (AddExpenseModal): add `min="0.01"` to the input and a `if (form.amount <= 0) return;` guard in `handleSubmit()`
- Backend (expenses.ts): add `if (args.amount <= 0) throw new Error("Amount must be positive")` to the `create` mutation handler

### D6-SEC-002: No maxlength on notes textarea

**File:** `app/components/AddExpenseModal.vue:84`

```html
<textarea v-model="form.notes" />
```

No `maxlength` attribute. Server-side Convex validator `notes: v.optional(v.string())` (expenses.ts:19) accepts strings of any length.

**Risk assessment:** Low. The notes field is stored in Convex and displayed via `{{ entry.description || "Expense" }}` (EntryList.vue:84) — Vue's escaped interpolation prevents XSS. However, unbounded input is a defense-in-depth gap: an excessively long string could consume storage and bandwidth.

**Recommendation:** Add `maxlength="500"` (or a value consistent with the data model spec) to the textarea.

### D6-SEC-003: Client-side orgId passed to mutations (Info)

**File:** `app/pages/index.vue:47-51, 61-65`

```typescript
await createExpense({
  ...expense,
  orgId: orgId.value,
});
```

```typescript
await createSettlement({
  ...settlement,
  orgId: orgId.value,
  date: new Date().toISOString(),
});
```

Neither `expenses:create` (convex/functions/expenses.ts:10-23) nor `settlements:create` (convex/functions/settlements.ts:5-11) declares `orgId` in its `args`. The server derives `orgId` from the JWT via `requireAuthenticatedOrg(ctx)` and uses the server-derived value exclusively in `ctx.db.insert` (expenses.ts:41, settlements.ts:29). The client-supplied `orgId` is never read.

**Risk assessment:** None (security). The server does not trust or use the client-supplied `orgId`. However, Convex's `v.object()` args validator may reject unknown fields depending on the SDK configuration, which could cause runtime errors.

**Recommendation:** Remove `orgId` from the client-side mutation calls to match the Convex function signatures. This is a code-quality fix, not a security requirement.

### D6-SEC-004: Brief no-layout render for users without org (Info)

**File:** `app/app.vue:16`

```vue
<NuxtPage v-else />
```

When a user is signed in but has no organization (`hasOrg === false`), `app.vue` renders `<NuxtPage>` without the `NuxtLayout` wrapper. The global middleware `auth.global.ts:14-15` should redirect to `/onboard`, but there is a brief window where the index page begins rendering before the redirect takes effect.

**Risk assessment:** None (security). During this window, `index.vue` calls `useBalance()`, `useExpenses()`, and `useSettlements()` — all of which trigger Convex queries that call `requireAuthenticatedOrg(ctx)` (convex/auth.ts:19-38), which throws `"Unauthenticated or no organisation"` for users without an org. No data is loaded or displayed. The visible content is the page skeleton: heading ("Happy House Bills"), action buttons, and "Loading..." state.

**Recommendation:** Wrap the fallback in `NuxtLayout` for consistency: `<NuxtLayout v-else><NuxtPage /></NuxtLayout>`. Not security-critical.

---

## Security Test Plan

| ID | Test | SEC ID | Priority | Status |
|----|------|--------|----------|--------|
| None required | D6 is a presentation-layer slice with no new backend functions, mutations, webhooks, or server-side endpoints. All mutations route through existing Convex functions that enforce auth and validation server-side. | — | N/A | Not applicable |

**Rationale:** D6 introduces no new auth boundaries, mutation endpoints, webhook receivers, client-side storage, iframe integrations, or postMessage channels. The security controls are enforced by:

1. **Existing Convex functions** (D1-D5 slices) — `requireAuthenticatedOrg` at every function entry, org-scoping via `by_org` index, `paidBy === userId` enforcement, `enteredBy !== userId` on approve/reject
2. **Vue's built-in output encoding** — `{{ }}` interpolation escapes all dynamic content; no `v-html` anywhere
3. **HTML5 form validation** — defense-in-depth (`type="number"`, `step="0.01"`, `required`, `min="0.01"` on settle modal)
4. **TypeScript strict mode** — compile-time type safety for all props and emits
5. **Runtime config separation** — private secrets in server-only `runtimeConfig`; only public keys in `runtimeConfig.public`

A slice-level security test would only be required if D6 introduced new Convex functions, webhook endpoints, client-side storage, iframe/postMessage integration, or secret handling — none of which it does.

---

## Residual Risk

After reviewing all nine D6 files, the residual risk is **Low**:

1. **Amount validation gap (D6-SEC-001):** The AddExpenseModal form does not enforce positive amounts at the client level (no `min` attribute, no `handleSubmit` check), and the server-side `expenses:create` mutation does not validate `amount > 0`. This is a Low-severity input-validation gap. However, the expense is always `paidBy` the authenticated user (server-enforced), Convex's `v.number()` prevents non-numeric input, and the `step="0.01"` enforces cent-level granularity. The impact is limited to self-inflicted data quality issues, not privilege escalation or cross-tenant access.

2. **Input length (D6-SEC-002):** No `maxlength` on the notes textarea. Output is safely escaped (no XSS); the impact is storage/bandwidth bloat, not injection.

3. **Client-side orgId (D6-SEC-003):** The client passes `orgId` to mutations that don't declare it as an argument. The server derives `orgId` from the JWT and never reads the client-supplied value — this is an Info-level code-quality issue with no security impact.

4. **Brief pre-redirect render (D6-SEC-004):** Signed-in users without an org briefly see the page skeleton before the middleware redirects to `/onboard`. No data loads (Convex queries fail server-side). Info-level, no security impact.

**All other controls are correctly implemented:** auth-gating (middleware + app.vue defense-in-depth), XSS prevention (Vue escaping, no v-html), secret management (runtimeConfig separation), server-side validation (Convex functions), cross-tenant isolation (JWT-derived orgId), and no iframe/postMessage/cookie/localStorage usage.

No Critical, High, or Medium severity findings. Both Low findings are input-validation defense-in-depth gaps with minimal blast radius. The Info findings are code-quality recommendations.

---

## Approval

| Decision | Approver | Date | Notes |
|----------|----------|------|-------|
| Pass | Security Engineer (automated review) | 29-October-2026 | D6 is a presentation-layer slice. Two Low findings (D6-SEC-001 amount validation, D6-SEC-002 notes maxlength) recommended for follow-up. Two Info findings (D6-SEC-003 client-side orgId, D6-SEC-004 brief pre-redirect render) are code-quality items. Core security controls (auth-gating, XSS prevention, secret management, server-side validation) are sound. |

---

## Next Gate

Before D6 is considered fully complete, the recommended follow-ups are:

1. **Fix (Low):** `app/components/AddExpenseModal.vue:68` — add `min="0.01"` to amount input and positive-amount guard in `handleSubmit()`
2. **Fix (Low):** `app/components/AddExpenseModal.vue:84` — add `maxlength="500"` to notes textarea
3. **Backend (Low, out of D6 scope):** `convex/functions/expenses.ts:24-30` — add `if (args.amount <= 0) throw new Error("Amount must be positive")` to match `settlements:create` pattern
4. **Cleanup (Info):** `app/pages/index.vue:47-51, 61-65` — remove client-side `orgId` from mutation args
5. **UX (Info):** `app/app.vue:16` — wrap no-org fallback in `NuxtLayout` for consistency

These findings do not block the slice. The frontend-only nature of D6 means the security posture is inherited from the existing Convex auth/validation layer (D1-D5). The slice can be promoted to implemented with these items tracked as Phase 2 follow-ups.
