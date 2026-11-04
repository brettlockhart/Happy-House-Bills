---
status: Draft
package: frontend
priority: high
created: 25-October-2026
updated: 25-October-2026
tags: [frontend, design-system, styling, components, tokens, ui]
---

# Tech Spec: User Interface Design System

**Date:** 25-October-2026
**Status:** Draft
**Audience:** Frontend engineers, UI designer

## 1. Purpose

Define the visual design system for the Happy House Bills Nuxt 4 application: CSS custom properties, colour palette, typography, spacing, component patterns, and responsive behaviour. The system uses **plain CSS with CSS custom properties** (`--hhb-*` namespace), no CSS frameworks, no CSS-in-JS, and no utility libraries.

## 2. Scope

### In scope

- CSS token architecture: custom properties with `--hhb-*` prefix
- Colour system: semantic colour roles with green primary accent (money semantics)
- Typography: system font stack, type scale for consumer readability
- Spacing: 4 px base grid (4, 8, 12, 16, 24, 32, 48, 64)
- Component patterns: buttons, inputs, modals, cards, toast notifications
- Responsive behaviour: mobile-first, single-column on mobile, two-panel on desktop
- Accessibility: WCAG 2.2 AA compliance throughout
- Light mode default with dark mode opt-in

### Out of scope

- OCR receipt display patterns (covered by `tech-specs/frontend/ocr-pipeline.md`)
- Convex client integration (covered by `api-contract.md`)
- Clerk component styling (covered by `domains/01-auth/onboarding-auth.md`)
- Email template styling (covered by `tech-specs/backend/email-notifications.md`)

## 3. Key Decisions

| ID | Decision | Rationale | Source |
|----|----------|-----------|--------|
| D1 | Plain CSS with `--hhb-*` custom properties — no Tailwind, no CSS-in-JS, no utility frameworks | Consumer app must load instantly on mobile; CSS variables have zero runtime overhead | `docs/AGENTS.md` (## 4. Code Style), user preference |
| D2 | Light mode default, dark mode opt-in via `prefers-color-scheme` | B2C consumer audience prefers light mode; dark mode as enhancement | Adapted from UIBuilder `design-system.md` D2 (tracked in `spec-gaps.md`), diverging from Linear's dark-default for B2C context |
| D3 | Green primary accent (`#10b981` / emerald) for money/finance semantics | Green signals positive balance, growth, success; red for negative/owed | Adapted from UIBuilder colour palette, diverging for finance context |
| D4 | Single-column layout on mobile, two-panel on desktop | Household expense tracking is simple; single action at a time; mobile is primary device | `docs/AGENTS.md` (## 2. Project Layout — Frontend Modules), `project_brief.md` (## Tech Stack) |
| D5 | 44 × 44 px minimum touch targets on mobile | WCAG 2.2 target-size requirement; prevents accidental taps on expense actions | `docs/AGENTS.md` (## 4. Code Style), WCAG 2.2 AA floor |
| D6 | System font stack with no web fonts | Zero font-loading overhead; instant render, crisp on all devices | UIBuilder `design-system.md` D7 |
| D7 | 4 px base grid with spacing ladder (4, 8, 12, 16, 24, 32, 48, 64) | Consistent visual rhythm; easier mental model than 8 px-only | UIBuilder `design-system.md` D6 |
| D8 | 8 px border radius for cards/modals, 4 px for inputs/buttons | Softer than developer tools but still polished; balances approachable and professional | UIBuilder `design-system.md` D8, adapted for consumer |

## 4. Open Questions

| ID | Question | Status | Notes |
|----|----------|--------|-------|
| UI-Q1 | Should we add a reduced-motion toggle in settings, or rely solely on `prefers-reduced-motion`? | Open | Phase 2 consideration |
| UI-Q2 | Should dark mode follow system preference or default to light regardless of OS setting? | Resolved | Light mode default per D2 |

## 5. Cross-References

- `tech-specs/backend/api-contract.md` — API responses consumed by UI
- `tech-specs/backend/data-model.md` — field types and status workflow
- `tech-specs/frontend/ocr-pipeline.md` — receipt display and OCR feedback
- `domains/01-auth/onboarding-auth.md` — auth flow screens
- `domains/02-expenses/expense-management.md` — expense entry list UI
- `domains/04-balance/balance-calculation.md` — balance display
- `domains/08-notifications/email-notifications.md` — toast notification patterns
- `spec-gaps.md` — gap tracking

## 6. Implementation Dependencies

- **Depends on:** `data-model.md` (field types inform form validation)
- **Blocks:** `domains/02-expenses/expense-management.md`, `domains/04-balance/balance-calculation.md`, `domains/09-ui/ui-spec.md`
- **Consumer integration:** `app/assets/css/main.css`, `app/components/`, `app/composables/`

## 7. Colour System

```css
:root {
  /* Neutral surface */
  --hhb-color-bg: #ffffff;
  --hhb-color-bg-elevated: #f8fafc;
  --hhb-color-bg-hover: #f1f5f9;

  /* Border */
  --hhb-color-border: #e2e8f0;
  --hhb-color-border-subtle: #f1f5f9;

  /* Text */
  --hhb-color-text: #0f172a;
  --hhb-color-text-secondary: #64748b;
  --hhb-color-text-tertiary: #94a3b8;

  /* Primary (green — money/growth) */
  --hhb-color-primary: #10b981;
  --hhb-color-primary-hover: #059669;
  --hhb-color-primary-light: #6ee7b7;
  --hhb-color-primary-fg: #ffffff;

  /* Semantic */
  --hhb-color-success: #10b981;
  --hhb-color-warning: #f59e0b;
  --hhb-color-error: #ef4444;
  --hhb-color-error-bg: #fef2f2;
  --hhb-color-info: #3b82f6;
}

/* Dark mode opt-in */
@media (prefers-color-scheme: dark) {
  :root {
    --hhb-color-bg: #0f172a;
    --hhb-color-bg-elevated: #1e293b;
    --hhb-color-bg-hover: #334159;
    --hhb-color-border: #334159;
    --hhb-color-border-subtle: #1e293b;
    --hhb-color-text: #f1f5f9;
    --hhb-color-text-secondary: #94a3b8;
    --hhb-color-text-tertiary: #64748b;
    --hhb-color-primary: #34d399;
    --hhb-color-primary-hover: #10b981;
    --hhb-color-error-bg: #450a0a;
  }
}
```

## 8. Typography System

```css
:root {
  /* Font stacks */
  --hhb-font-sans: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  --hhb-font-mono: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace;

  /* Type scale */
  --hhb-text-xs: 0.75rem;   /* 12px — captions, helper text */
  --hhb-text-sm: 0.875rem;  /* 14px — body text, form labels */
  --hhb-text-base: 1rem;    /* 16px — default body */
  --hhb-text-lg: 1.125rem;  /* 18px — lead text */
  --hhb-text-xl: 1.25rem;   /* 20px — small headings */
  --hhb-text-2xl: 1.5rem;   /* 24px — section headings */
  --hhb-text-3xl: 1.875rem; /* 30px — page headings */
  --hhb-text-4xl: 2.25rem;  /* 36px — hero/empty state headings */

  /* Font weights */
  --hhb-font-regular: 400;
  --hhb-font-medium: 500;
  --hhb-font-semibold: 600;
  --hhb-font-bold: 700;

  /* Line heights */
  --hhb-leading-tight: 1.25;
  --hhb-leading-normal: 1.5;
  --hhb-leading-relaxed: 1.625;
}
```

## 9. Spacing System

```css
:root {
  /* 4 px base grid */
  --hhb-space-1: 0.25rem;  /* 4px — tight gaps, icon padding */
  --hhb-space-2: 0.5rem;   /* 8px — compact padding, inline gaps */
  --hhb-space-3: 0.75rem;  /* 12px — default padding, list gaps */
  --hhb-space-4: 1rem;     /* 16px — standard padding, section gaps */
  --hhb-space-5: 1.5rem;   /* 24px — large padding, card gaps */
  --hhb-space-6: 2rem;     /* 32px — section spacing */
  --hhb-space-8: 3rem;     /* 48px — page-level spacing */
  --hhb-space-12: 4rem;    /* 64px — hero spacing */
}
```

## 10. Border Radius & Shadows

```css
:root {
  /* Radius */
  --hhb-radius-sm: 4px;    /* inputs, small elements */
  --hhb-radius-md: 8px;    /* buttons, cards */
  --hhb-radius-lg: 12px;   /* modals, large cards */
  --hhb-radius-full: 9999px; /* pills, badges, circular */

  /* Shadows */
  --hhb-shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
  --hhb-shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.05);
  --hhb-shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
}
```

## 11. Component Patterns

### 11.1 Button

```css
.HhbButton {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: var(--hhb-radius-md);
  padding: var(--hhb-space-2) var(--hhb-space-4);
  font-family: var(--hhb-font-sans);
  font-size: var(--hhb-text-sm);
  font-weight: var(--hhb-font-medium);
  cursor: pointer;
  transition: background-color 150ms var(--hhb-easing-standard);
}

.HhbButton--primary {
  background: var(--hhb-color-primary);
  color: var(--hhb-color-primary-fg);
}

.HhbButton--primary:hover {
  background: var(--hhb-color-primary-hover);
}

.HhbButton--ghost {
  background: transparent;
  color: var(--hhb-color-text-secondary);
}
```

### 11.2 Card / Surface

```css
.HhbCard {
  background: var(--hhb-color-bg-elevated);
  border: 1px solid var(--hhb-color-border);
  border-radius: var(--hhb-radius-lg);
  padding: var(--hhb-space-4);
  box-shadow: var(--hhb-shadow-sm);
}
```

## 12. Responsive Behaviour

| Breakpoint | Width | Layout |
|-----------|-------|--------|
| Mobile | < 768 px | Single column: header + balance + action buttons + entry list |
| Desktop | ≥ 768 px | Two-panel: balance/actions (left), entry list (right) |

### 12.1 Mobile Layout

```ascii
+--------------------------+
| Balance: $45.23          |
+--------------------------+
| [ Add Expense ] [ Settle ]|
+--------------------------+
| - Groceries: $30 (Sam)   |
|   ⏳ Pending [✓] [✗]     |
|   ✓ Approved $15 (You)   |
| - Utilities: $80 (Alex)  |
|   ✓ Approved $40 (You)   |
|                          |
| Settled: $20 (Oct 20)    |
|                          |
| Balance: You owe Alex     |
|           $35.00         |
+--------------------------+
```

### 12.2 Desktop Layout

```ascii
+-------------------+------------------+
| Balance: $45.23   | Entry List       |
+-------------------+ +-----------------+
| [ Add Expense ]   | | Expenses &     |
| [ Settle Up ]     | | Settlements    |
|                   | | (chronological)|
+-------------------+ +-----------------+
```

## 13. Motion & Accessibility

```css
:root {
  --hhb-easing-standard: cubic-bezier(0.4, 0, 0.2, 1);
  --hhb-duration-fast: 100ms;
  --hhb-duration-normal: 150ms;
}

/* Respect reduced motion */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```
