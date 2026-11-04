---
status: Implemented
lifecycle: 04-implemented
phase: Phase 1
slice: D6
created: 26-October-2026
updated: 29-October-2026
depends_on: [D1, D2, D4, D5]
blocks: []
owner: frontend-engineer
priority: P0
review_status:
  security: pass
  implementation: pass
  test: pass
---

# D6 — Frontend UI Shell

## Purpose

Implement the single-page frontend: balance header with real-time Convex subscription, expense/settlement entry list (chronological, mixed), action buttons (Add Expense, Settle Up modals), pending expense confirm/reject buttons, and the CSS design system tokens per `ui-spec.md`.

## Scope

### In scope

- CSS design system: `--hhb-*` custom properties (colours, typography, spacing, shadows)
- `app/pages/index.vue` — single page with balance header + entry list + action buttons
- `app/components/SettleUpModal.vue` — settlement recording modal
- Real-time balance via Convex query subscription (using `useBalance()` composable from `app/composables/useExpenses.ts`)
- Entry list: chronological expenses + settlements, with pending approve/reject buttons- Mobile-first responsive: single column mobile, two-panel desktop
- WCAG 2.2 AA compliance (44×44 px touch targets, reduced motion support)

### Out of scope

- Clerk sign-in/sign-up forms (handled by `@clerk/nuxt` UI components)
- Receipt upload and OCR (covered by D4)
- Duplicate detection warnings (covered by D5 — `expenses:create` returns `isDuplicate` flag)

## Acceptance Criteria

- [x] `npm run lint` — 0 problems
- [x] `npx vue-tsc --noEmit` — 0 errors
- [x] `npm run docs:lint` — 0 errors
- [x] Page loads with real-time balance via Convex subscription
- [x] "Add Expense" button opens `AddExpenseModal`
- [x] "Settle Up" button opens `SettleUpModal`
- [x] Entry list shows expenses + settlements chronologically
- [x] Pending expenses show confirm/reject buttons (for the other partner)
- [x] Layout is single-column on mobile, two-panel on desktop
- [x] 44×44 px minimum touch targets on mobile
- [x] Dark mode opt-in via `prefers-color-scheme`

## Technical Details

Per `tech-specs/frontend/ui-spec.md`:

**CSS design tokens** (`app/assets/css/tokens.css`):
- `--hhb-color-*` for semantic colours (emerald `#10b981` primary)
- `--hhb-text-*` type scale (12-36px)
- `--hhb-space-*` spacing ladder (4/8/12/16/24/32/48/64)
- `--hhb-radius-*` (4px inputs, 8px cards, 12px modals)
- `@media (prefers-color-scheme: dark)` for dark mode
- `@media (prefers-reduced-motion: reduce)` for motion reduction

**Page layout** (`app/pages/index.vue`):
```
Mobile (single column):
+--------------------------------+
| Balance: $45.23               |
| [ Add Expense ] [ Settle Up ]  |
+--------------------------------+
| Entry List (chronological)    |
| - Groceries: $30 (Sam)        |
|   Pending [✓ Approve] [✗ Reject]|
| - Settled: $20 (Oct 20)        |
+--------------------------------+

Desktop (two-panel):
+-----------------+---------------------+
| Balance +       | Entry List          |
| Action Buttons  | (chronological)      |
+-----------------+---------------------+
```

**Entry list** (`app/components/EntryList.vue`):
- Fetches `useExpenses()` and `usePendingExpenses()` composables
- Fetches settlements via `useSettlements()` (composable created in D2)
- Merges + sorts by date descending
- Shows `pending` badge and approve/reject buttons for expenses entered by the other user
- Shows settlement rows with "from → to" format

**SettleUpModal** (`app/components/SettleUpModal.vue`):
- Amount input + toUser select (defaults to partner)
- Calls `settlements:create` mutation from D2
- On success, closes and refreshes balance

**Auth-gated app shell** (`app/app.vue`):
- Wraps pages in Clerk `<ClerkProvider>`
- Checks auth state — unauthenticated → `<SignIn />`
- Authenticated but no org → redirect to `/onboard`
- Authenticated with org → render `<NuxtPage />`

## Files Created/Modified

| Path | Action |
|------|--------|
| `app/assets/css/tokens.css` | Create — design tokens |
| `app/pages/index.vue` | Modify — integrate balance + entry list + modals |
| `app/components/SettleUpModal.vue` | Create — settlement modal |
| `app/components/EntryList.vue` | Create — chronological entry list |
| `app/app.vue` | Create — ClerkProvider + auth-gated shell |
| `app/utils/formatting.ts` | Create — currency/date formatting |
| `__tests__/components/EntryList.spec.ts` | Create — component tests |
| `__tests__/utils/formatting.spec.ts` | Create — utility tests |

## Dependencies

- `D1` (balance/composable infrastructure, schema)
- `D2` (settlements API, `useSettlements` composable)
- `D4` (ReceiptUploader used in AddExpenseModal)
- `D5` (duplicate warning displayed in AddExpenseModal)
- `tech-specs/frontend/ui-spec.md` (design tokens, responsive layout, WCAG 2.2)
- `domains/09-ui/ui-spec.md` (UI-D-Q1, UI-D-Q2 origin — source spec for open questions)
- `domains/01-auth/onboarding-auth.md` (auth-gated shell, route guard pattern, `/onboard` redirect)

## Blocks

- None (this is a leaf slice at the end of Phase 1)

## Open Questions

| ID | Question | Status | Resolution Owner | Target Phase |
|----|----------|--------|------------------|--------------|
| UI-D-Q1 | Should settled expenses be collapsed or shown in full? | Open | frontend-engineer | Phase 2 |
| UI-D-Q2 | Should the entry list show expenses and settlements interleaved chronologically? | Open | frontend-engineer | Phase 2 |

> Both questions already registered in `spec-gaps.md §6`. For v1: settled expenses shown in full, entries interleaved chronologically by date.

## Lifecycle Report

**Date:** 28-October-2026  
**Status:** Code complete — ready for review

### Implementation Summary

All files from the proposal were created with the following refinements:

1. **`app/app.vue`** — Auth-gated shell using `useAuth()` composable for sign-in detection. Unauthenticated users see Clerk's `<SignIn>` component; authenticated users see `<NuxtPage>`. The org-check + redirect to `/onboard` is handled by the existing `app/middleware/auth.global.ts` route guard.

2. **`app/pages/index.vue`** — Balance header with real-time Convex subscription via `useBalance()`, action buttons (Add Expense + Settle Up), `EntryList` component, and modal integration. The partner user ID is derived from `BalanceResult.owesWhom` (the other user's Clerk user ID returned by the balance query).

3. **`app/components/EntryList.vue`** — Merges expenses (from `useExpenses()`) and settlements (from `useSettlements()`) into a single chronological list. Shows approve/reject buttons for pending expenses entered by the other user. Uses `usePendingExpenses()` for approve/reject mutations.

4. **`app/components/SettleUpModal.vue`** — Amount input with toUser defaulting to partner. Calls `settlements:create` mutation on submit.

5. **`app/assets/css/tokens.css`** — CSS custom properties for colours, typography scale, spacing, radius, shadows, dark mode, and reduced motion.

6. **`app/utils/formatting.ts`** — `formatCurrency`, `formatDate`, `formatRelativeDate` utilities.

### Test Results

| Check | Status | Details |
|-------|--------|---------|
| Lint | Pass | 0 errors, 0 warnings |
| Typecheck | Pass | `npx vue-tsc --noEmit` — 0 errors |
| Tests | Pass | 183 tests passing (12 files) |
| Doc lint | Pass | `npm run docs:lint` — 0 errors |

### Review Reports

- `supporting-docs/reviews/d6-frontend-ui-shell-review.md` — Implementation review
- `supporting-docs/reviews/d6-security-review.md` — Security review
- `supporting-docs/reviews/d6-test-coverage-report.md` — Test coverage report
