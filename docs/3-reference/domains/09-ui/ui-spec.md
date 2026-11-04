---
status: Draft
package: app
priority: medium
created: 25-October-2026
updated: 25-October-2026
tags: [ui, domain-spec, single-page, mobile-first, real-time]
---

# Domain Spec: User Interface

**Date:** 25-October-2026
**Status:** Draft
**Audience:** Frontend engineers

## 1. Purpose

Define the user interface domain: the single-page application architecture, screen layouts, navigation model, and real-time data binding. The UI is a single page (no client-side routing in v1) — it shows a balance header, action buttons (Add Expense, Settle Up), and a chronological entry list (expenses and settlements).

## 2. Scope

### In scope

- Single-page architecture (no client-side routing in v1)
- Mobile-first layout: single column on mobile, two-panel on desktop
- Balance header: shows "You owe Sam $35.00" with colour-coded sign (green = positive, red = negative)
- Primary action buttons: "Add Expense" (opens modal) and "Settle Up" (opens modal)
- Entry list: chronological display of expenses and settlements, with status badges
- Real-time updates via Convex reactive subscriptions
- Pending expense confirmation: inline approve/reject buttons on pending entries
- Toast notifications for success/error states
- Loading states for all async operations

### Out of scope

- Visual design system (covered by `tech-specs/frontend/ui-spec.md`)
- Mobile compatibility / PWA (covered by `tech-specs/frontend/mobile-compat.md`)
- Component-level styling (covered by `tech-specs/frontend/ui-spec.md`)
- Auth screens (covered by `domains/01-auth/onboarding-auth.md`)

## 3. Key Decisions

| ID | Decision | Rationale | Source |
|----|----------|-----------|--------|
| D1 | Single-page architecture (no client-side routing) | v1 has one screen (the main expense view); routing adds complexity without benefit | `project_brief.md` (## Non-Goals) |
| D2 | Balance display uses "You owe X" / "X owes you" with sign-based colour | More intuitive than abstract positive/negative numbers for non-financial users | `lexicon.md` — Balance |
| D3 | Pending expenses show inline approve/reject buttons | Reduces clicks; partner can confirm from the entry list without opening a modal | `user-flows.md` |
| D4 | Real-time via Convex reactive queries (no manual refresh) | Convex pushes updates automatically; balances update instantly for both users | `project_brief.md` (## Acceptance Criteria) |
| D5 | Toasts for success/error, auto-dismiss after 4 seconds | Feedback without blocking workflow; matches consumer app patterns | `tech-specs/frontend/ui-spec.md` (## 11. Component Patterns) |

## 4. Open Questions

| ID | Question | Status | Notes |
|----|----------|--------|-------|
| UI-D-Q1 | Should settled expenses be collapsed or shown in full? | Open | Collapsing keeps the list short; full history may be useful for reconciliation. |
| UI-D-Q2 | Should the entry list show expenses and settlements interleaved chronologically? | Open | Interleaved is most intuitive; but grouping by type is cleaner for scanning. |

## 5. Cross-References

- `tech-specs/frontend/ui-spec.md` — design system, component patterns, responsive layout
- `tech-specs/frontend/mobile-compat.md` — touch targets, PWA, camera capture
- `domains/02-expenses/expense-management.md` — expense row display, approval buttons
- `domains/03-settlements/settlement-management.md` — settlement row in list
- `domains/04-balance/balance-calculation.md` — balance header data source
- `spec-gaps.md` — gap tracking

## 6. Implementation Dependencies

- **Depends on:** `ui-spec.md` (design system), `balance-calculation.md`, `expense-management.md`
- **Blocks:** None (UI is the consumer of all domain specs)
- **Consumer integration:** `app/pages/index.vue` renders the main screen; `app/composables/useBalance`, `useExpenses` subscribe to Convex queries

## 7. Screen Layout

```ascii
┌─────────────────────────────┐
│ Balance: You owe Sam        │ ← balance-calculation.md
│         $35.00       🔴     │
├─────────────────────────────┤
│ [ Add Expense ] [ Settle Up ]│ ← actions
├─────────────────────────────┤
│ Receipt: Groceries          │ ← expense-management.md
│   $30.00 · Paid by you      │
│   ⏳ Pending [✓ Confirm]    │
├─────────────────────────────┤
│ Receipt: Utilities          │
│   $80.00 · Paid by Sam      │
│   ✓ Approved · $40 (you)    │
├─────────────────────────────┤
│ 💰 Sam settled up $20       │ ← settlement-management.md
│   Oct 20                      │
└─────────────────────────────┘
```

## 8. Real-Time Subscription

```typescript
// app/composables/useBalance.ts
export function useBalance() {
  const balance = useConvexQuery(api.expenses.balance, {});
  return {
    balance: computed(() => balance.value?.balance ?? 0),
    displayText: computed(() => {
      if (balance.value?.balance > 0) return `You owe ${balance.value.owesWhom} $${Math.abs(balance.value.balance).toFixed(2)}`;
      if (balance.value?.balance < 0) return `${balance.value.owesWhom} owes you $${Math.abs(balance.value.balance).toFixed(2)}`;
      return "All settled up!";
    }),
    isPositive: computed(() => balance.value?.balance > 0),
  };
}
```
