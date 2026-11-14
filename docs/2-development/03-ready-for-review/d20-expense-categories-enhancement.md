---
status: Ready for Review
package: app
priority: high
created: 11-November-2026
updated: 14-November-2026
tags: [expenses, categories, ui, phase2]
lifecycle: 03-ready-for-review
---

# Slice D20: Expense Categories Enhancement

**Date:** 11-November-2026
**Status:** Ready for Review
**Phase:** Phase 2 Enhancement

## 1. Purpose

Expand the hardcoded three-category system (groceries, utilities, other) to a flexible, user-configurable category system with sub-categories, icons, colours, and budget tracking per category.

## 2. Scope

### In scope

- Convex schema: new `categories` table (org-scoped, user-configurable)
- Default categories seeded on org creation: Groceries, Utilities, Transport, Dining, Entertainment, Health, Shopping, Other
- Sub-category support (e.g., Groceries → Supermarket, Convenience, Online)
- Category CRUD via Convex mutations/queries
- Frontend: category picker in AddExpenseModal with search, icons, colours
- Category display in expense list with coloured badges/icons
- Budget limits per category (monthly) with progress indicators
- Category analytics: spending by category, trends, budget variance
- Migration: existing expenses with hardcoded categories mapped to new system

### Out of scope

- Category templates/shared libraries across organisations
- AI-powered category suggestion (beyond keyword matching)
- Category-based approval workflows
- Tax category mapping

## 3. Key Decisions

| ID | Decision | Rationale | Source |
|----|----------|-----------|--------|
| D1 | Org-scoped categories table | Each household has different needs; consistent with org-scoping | D1 data model |
| D2 | Seed defaults on org creation | Zero-config for new users; customisable later | UX principle |
| D3 | Sub-categories as nested array in category doc | Simple hierarchy; avoids separate table | Convex schema |
| D4 | Budget per category (monthly) | Core budgeting feature; aligns with analytics | D15 analytics |
| D5 | Icons from Lucide/heroicons set | Lightweight, consistent, tree-shakeable | Frontend convention |
| D6 | Colours from design token palette | Consistent with UI theming; supports dark mode | assets/scss/ |

## 4. Open Questions

| ID | Question | Status | Notes |
|----|----------|--------|-------|
| CAT-Q1 | How many default categories? (8 proposed) | Open | Balance completeness vs overwhelm |
| CAT-Q2 | Allow users to create unlimited categories? | Open | Cap at 20? Performance/UX |
| CAT-Q3 | Category icons: emoji or icon font? | Open | Emoji simpler; icons more consistent |
| CAT-Q4 | Budget period: calendar month or rolling 30 days? | Open | Calendar month simpler for users |

## 5. Cross-References

- `docs/3-reference/tech-specs/backend/data-model.md` — Schema patterns
- `docs/3-reference/domains/02-expenses/expense-management.md` — Expense domain
- `docs/2-development/04-implemented/d15-advanced-analytics-insights.md` — Category analytics
- `spec-gaps.md` — gap tracking

## 6. Implementation Dependencies

- **Depends on:** D1 (expense schema), D15 (analytics for category breakdown)
- **Blocks:** Category budgeting UI, advanced analytics filters
- **Consumer integration:** `AddExpenseModal`, `ExpenseRow`, `AnalyticsDashboard`, `useExpenses`

## 7. Technical Approach

### Schema: `convex/schema.ts`

```typescript
categories: defineTable({
  orgId: v.string(),
  name: v.string(),
  icon: v.string(),        // Lucide icon name or emoji
  colour: v.string(),      // Hex from design tokens
  parentId: v.optional(v.id("categories")),  // for sub-categories
  budgetMonthly: v.optional(v.number()),     // null = no budget
  isDefault: v.boolean(),  // system defaults vs user-created
  sortOrder: v.number(),
  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index("by_org", ["orgId"])
  .index("by_org_parent", ["orgId", "parentId"])
```

### Default Seed Data (on org creation)

```typescript
const DEFAULT_CATEGORIES = [
  { name: "Groceries", icon: "shopping-cart", colour: "#22c55e", subCategories: ["Supermarket", "Convenience", "Online Grocery"] },
  { name: "Utilities", icon: "zap", colour: "#f59e0b", subCategories: ["Electricity", "Water", "Gas", "Internet", "Phone"] },
  { name: "Transport", icon: "car", colour: "#3b82f6", subCategories: ["Fuel", "Public Transport", "Rideshare", "Parking"] },
  { name: "Dining", icon: "utensils", colour: "#ef4444", subCategories: ["Restaurant", "Takeaway", "Coffee", "Fast Food"] },
  { name: "Entertainment", icon: "film", colour: "#a855f7", subCategories: ["Streaming", "Games", "Events", "Subscriptions"] },
  { name: "Health", icon: "heart-pulse", colour: "#ec4899", subCategories: ["Pharmacy", "Doctor", "Dental", "Insurance"] },
  { name: "Shopping", icon: "shopping-bag", colour: "#06b6d4", subCategories: ["Clothing", "Electronics", "Home", "Gifts"] },
  { name: "Other", icon: "more-horizontal", colour: "#6b7280", subCategories: [] },
]
```

### Convex Functions: `convex/functions/categories.ts`

- `create` — create category (check org limit, validate parent exists)
- `list` — query all for org, ordered by sortOrder, include sub-categories
- `update` — rename, change icon/colour/budget, reorder
- `delete` — soft delete (check no expenses reference it, or reassign to "Other")
- `seedDefaults` — internal, called from orgs.onboardingComplete

### Frontend Integration

- `app/composables/useCategories.ts` — reactive category list, CRUD actions
- `app/components/CategoryPicker.vue` — searchable, grouped by parent, shows icons/colours
- `app/components/CategoryBadge.vue` — coloured dot + icon + name for expense list
- `AddExpenseModal.vue` — replace hardcoded select with CategoryPicker
- `AnalyticsDashboard.vue` — category breakdown chart, budget progress bars
- `app/utils/category-utils.ts` — colour/icon helpers, budget calculations

## 8. Migration Strategy

1. Add `categories` table to schema
2. Deploy Convex functions + seed on org creation
3. Backfill: existing expenses with `category: "groceries"|"utilities"|"other"` → map to seeded defaults
4. Update `expenses.ts` queries to join category for display
5. Replace hardcoded category logic in frontend

## 9. Testing

- Unit: category CRUD, budget validation, sub-category hierarchy
- Integration: create org → verify defaults seeded → create expense with category
- UI: CategoryPicker displays correctly, search filters, sub-categories expand
- Analytics: category spending sums match expense totals
- Budget: progress bar shows correct percentage, warning at 80%, over-budget at 100%+

## 10. Rollout Plan

1. Schema migration + Convex functions deploy to dev
2. Build CategoryPicker + CategoryBadge components
3. Integrate into AddExpenseModal, ExpenseRow
4. Add category analytics to AnalyticsDashboard
5. Test migration on dev with existing data
6. Deploy to production

## Lifecycle

- `01-draft` → `02-in-progress`: 13-November-2026 (implementation started)
- `02-in-progress` → `03-ready-for-review`: 14-November-2026 (implementation complete)

## Lifecycle Report — D20 Expense Categories Enhancement

**Promoted to:** 03-ready-for-review (14-November-2026)
**Commit:** a782751
**Tests:** 46 files, 694 passed
**Lint:** 0 problems
**Typecheck:** 24 errors (pre-existing baseline)
**Docs audit:** 0 errors, 59 pre-existing warnings

### Completed
- Convex schema: `categories` table (org-scoped, user-configurable) with `by_org` and `by_org_parent` indexes
- Default categories seeded on org creation: Groceries, Utilities, Transport, Dining, Entertainment, Health, Shopping, Other (8 defaults)
- Category CRUD (create, list, update, delete) via Convex mutations/queries with auth & IDOR protection
- Seed idempotency (does not duplicate existing defaults)
- `seedDefaults` internalMutation for org creation
- CategoryPicker component: searchable, grouped by parent, inline category creation
- CategoryBadge component: coloured dot + icon + name
- AnalyticsDashboard: budget progress bars with colour tiers (green <80%, yellow 80–100%, red 100%+), over-budget / near-limit warnings
- Test coverage: `__tests__/convex/categories.test.ts` (17 tests), `__tests__/components/CategoryBadge.test.ts` (5), `__tests__/components/CategoryPicker.test.ts` (10), `__tests__/components/AnalyticsDashboard.test.ts` (11)

### Open Questions Resolved
- CAT-Q1: 8 default categories — decided and seeded
- CAT-Q3: Icons from Lucide/heroicons set — decided
- CAT-Q4: Budget period — calendar month — decided

### Open Questions Remaining
- CAT-Q2: Allow users to create unlimited categories? (Open — no cap implemented)
