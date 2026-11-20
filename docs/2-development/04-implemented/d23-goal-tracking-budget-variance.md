---
status: 04-implemented
package: app
priority: high
created: 11-November-2026
updated: 2026-11-20
tags: [analytics, goals, budgets, tracking, phase3]
lifecycle: 04-implemented
---

# Slice D23: Goal Tracking & Budget Variance

**Date:** 11-November-2026
**Status:** Implemented
**Phase:** Phase 3 Enhancement

## 1. Purpose

Complete the D15 acceptance criteria items for goal tracking system and budget variance analysis, enabling users to set financial goals (savings, spending limits) and track progress with variance alerts.

## 2. Scope

### In scope

- Convex schema: `goals` table (org-scoped, user-created)
- Goal types: savings target, monthly spending limit, category budget, debt payoff
- Goal CRUD via Convex mutations/queries
- Progress tracking: real-time via Convex subscriptions
- Variance analysis: actual vs planned, trend projection, alerts at thresholds
- Frontend: GoalCard component, GoalsDashboard page, progress visualisations
- Integration with category budgets (D20) and analytics (D15)
- Notifications: goal achieved, at risk (80%+), over budget (100%+)
- Goal templates: Emergency Fund, Vacation, Large Purchase, Debt Freedom

### Out of scope

- Investment goal tracking (stocks, crypto)
- Multi-currency goals (v1 USD only)
- Goal sharing beyond household (already org-scoped)
- Automatic transfers/banking integration (separate slice)

## 3. Key Decisions

| ID | Decision | Rationale | Source |
|----|----------|-----------|--------|
| D1 | Goals org-scoped, visible to both partners | Household financial goals are shared | D1 org model |
| D2 | Goal types as union in schema | Type-safe; easy to add new types | Convex schema |
| D3 | Progress computed server-side in query | Consistent; no client drift | D15 analytics pattern |
| D4 | Variance alerts via notification system | Reuses D18/D22 infrastructure | D18, D22 |
| D5 | Templates as seed data, not hardcoded | User can modify/delete; extensible | D20 categories |

## 4. Open Questions

| ID | Question | Status | Notes |
|----|----------|--------|-------|
| P3-Q5 | Goal period: calendar month, rolling 30d, or custom? | Open | Calendar month aligns with budgets — registered as P3-Q1 in `spec-gaps.md` |
| P3-Q6 | Savings goals: track via settlement "savings" category or separate? | Open | Separate table cleaner; category simpler — registered as P3-Q2 in `spec-gaps.md` |
| P3-Q7 | Variance projection: linear only or include seasonality? | Open | Linear v1; seasonality Phase 4+ — registered as P3-Q3 in `spec-gaps.md` |
| P3-Q8 | Goal completion: auto-archive or manual? | Open | Auto-archive at 100% with option to extend — registered as P3-Q4 in `spec-gaps.md` |

## 5. Cross-References

- `docs/2-development/04-implemented/d15-advanced-analytics-insights.md` — Base analytics (ANL-Q1, ANL-Q2)
- `docs/2-development/01-draft/d20-expense-categories-enhancement.md` — Category budgets
- `docs/2-development/04-implemented/d18-push-notifications.md` — Alert notifications
- `docs/2-development/01-draft/d22-notification-preferences-rich-actions.md` — Alert preferences
- `spec-gaps.md` — gap tracking (D15 acceptance criteria items)

## 6. Implementation Dependencies

- **Depends on:** D15 (analytics engine), D18 (notifications), D20 (categories for category budgets)
- **Blocks:** None (additive feature)
- **Consumer integration:** `AnalyticsDashboard`, `InsightsPanel`, `useAnalytics`, `useNotifications`

## 7. Technical Approach

### Schema: `convex/schema.ts`

```typescript
goals: defineTable({
  orgId: v.string(),
  userId: v.string(),           // creator (both can see/edit)
  name: v.string(),
  type: v.union(
    v.literal("savings_target"),
    v.literal("monthly_spending_limit"),
    v.literal("category_budget"),
    v.literal("debt_payoff"),
  ),
  // Type-specific config
  targetAmount: v.number(),     // savings: target; spending: limit; debt: total owed
  categoryId: v.optional(v.id("categories")),  // for category_budget
  currentAmount: v.number(),    // savings: saved so far; debt: paid so far
  periodStart: v.number(),      // timestamp for monthly goals
  periodEnd: v.optional(v.number()),  // for debt payoff target date
  // Progress & variance
  progressPercent: v.number(),  // computed, 0-100+
  varianceAmount: v.number(),   // actual - planned (negative = under)
  variancePercent: v.number(),  // variance / planned * 100
  projectedCompletion: v.optional(v.number()),  // timestamp if on track
  // Status
  status: v.union(v.literal("active"), v.literal("achieved"), v.literal("at_risk"), v.literal("over_budget"), v.literal("paused")),
  // Alerts
  alertAtPercent: v.number(),   // default 80 for at_risk, 100 for over_budget
  alertSent: v.boolean(),       // prevent duplicate alerts
  // Metadata
  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index("by_org", ["orgId"])
  .index("by_org_status", ["orgId", "status"])
  .index("by_org_user", ["orgId", "userId"])
```

### Goal Templates (seed on first goal creation or onboarding)

```typescript
const GOAL_TEMPLATES = [
  { name: "Emergency Fund", type: "savings_target", targetAmount: 10000, icon: "shield", colour: "#22c55e" },
  { name: "Vacation Fund", type: "savings_target", targetAmount: 3000, icon: "plane", colour: "#3b82f6" },
  { name: "Large Purchase", type: "savings_target", targetAmount: 5000, icon: "shopping-bag", colour: "#a855f7" },
  { name: "Debt Freedom", type: "debt_payoff", targetAmount: 0, icon: "credit-card", colour: "#ef4444" },
  { name: "Monthly Budget", type: "monthly_spending_limit", targetAmount: 2000, icon: "wallet", colour: "#f59e0b" },
]
```

### Convex Functions: `convex/functions/goals.ts`

```typescript
// create: mutation — from template or custom, compute initial progress
// list: query — org-scoped, ordered by createdAt desc, include computed progress
// update: mutation — partial (name, targetAmount, periodEnd, alertAtPercent, status)
// delete: mutation — soft delete (status = "paused")
// updateProgress: internal mutation — called by expenses/settlements mutations
// checkVariance: internal action — run daily via cron, evaluate all active goals, send alerts
```

### Progress Computation

```typescript
// Called on expense/settlement create/update/delete via internal mutation
async function updateGoalProgress(ctx, orgId, goalId) {
  const goal = await ctx.db.get(goalId)
  if (!goal || goal.status !== "active") return

  let current = 0
  if (goal.type === "savings_target") {
    current = await sumSavings(ctx, orgId, goal.categoryId)
  } else if (goal.type === "monthly_spending_limit") {
    current = await sumExpensesInPeriod(ctx, orgId, goal.periodStart, goal.periodEnd)
  } else if (goal.type === "category_budget") {
    current = await sumCategoryExpenses(ctx, orgId, goal.categoryId, goal.periodStart, goal.periodEnd)
  } else if (goal.type === "debt_payoff") {
    current = await sumDebtPayments(ctx, orgId)
  }

  const progress = goal.targetAmount > 0 ? (current / goal.targetAmount) * 100 : 0
  const variance = current - goal.targetAmount

  let status: GoalStatus = "active"
  if (goal.type === "savings_target" || goal.type === "debt_payoff") {
    if (progress >= 100) status = "achieved"
  } else {
    if (progress >= 100) status = "over_budget"
    else if (progress >= goal.alertAtPercent) status = "at_risk"
  }

  await ctx.db.patch(goalId, {
    currentAmount: current,
    progressPercent: progress,
    varianceAmount: variance,
    variancePercent: goal.targetAmount > 0 ? (variance / goal.targetAmount) * 100 : 0,
    status,
    updatedAt: Date.now(),
  })

  if (status !== "active" && !goal.alertSent) {
    await ctx.runMutation(internal.functions.notifications.create, {
      orgId,
      userId: goal.userId,
      type: "goal_alert",
      title: `Goal ${status.replace("_", " ")}`,
      body: `${goal.name} is ${progress.toFixed(0)}% ${status === "achieved" ? "complete" : status}`,
      data: { goalId, status },
    })
    await ctx.db.patch(goalId, { alertSent: true })
  }
}
```

### Frontend Integration

- `app/components/GoalCard.vue` — progress ring, variance indicator, status badge, actions (edit, pause, delete)
- `app/components/GoalsDashboard.vue` — grid of GoalCards, "Create Goal" button (template picker)
- `app/components/GoalTemplatePicker.vue` — modal with template cards, custom option
- `app/composables/useGoals.ts` — reactive goals list, CRUD, progress subscriptions
- `AnalyticsDashboard.vue` — "Goals" tab showing GoalsDashboard
- `InsightsPanel.vue` — goal insights: "You're on track for Emergency Fund in 3 months"

### Variance Analysis (in `convex/functions/insights.ts` or new `goals.ts`)

```typescript
// Daily cron: checkVariance for all active goals
// Project completion date based on current run rate
// Generate insight: "At current spending, you'll exceed Monthly Budget by $150"
```

### Notifications Integration

- New notification type: `goal_alert` (added to D18 schema)
- Respect D22 notification preferences (quiet hours, batching, email fallback)
- Rich action: "View Goal" → navigate to GoalsDashboard

## 8. Testing

- Unit: progress computation for each goal type, variance calculation, status transitions
- Integration: create goal → add expenses/settlements → verify progress updates in real-time
- Alerts: simulate 80% threshold → verify notification sent; 100% → over_budget alert
- Templates: create from each template → verify correct defaults
- Variance projection: known expense pattern → verify projected completion date
- Permissions: both org members can view/edit goals

## 9. Rollout Plan

1. Add `goals` table + Convex functions → deploy to dev
2. Build GoalCard + GoalsDashboard + GoalTemplatePicker components
3. Integrate progress updates into expenses/settlements mutations
4. Add daily variance check cron + notification alerts
5. Add goals tab to AnalyticsDashboard
6. Test with real data in dev
7. Deploy to production

## Lifecycle

- `01-draft` → `02-in-progress`: 11-November-2026 (implementation started)
- `02-in-progress` → `03-ready-for-review`: 18-November-2026 (implementation complete)
- `03-ready-for-review` → `04-implemented`: 20-November-2026 (promoted after full Big Three review)

## Lifecycle Report — D23 Goal Tracking & Budget Variance

**Promoted to:** 04-implemented (20-November-2026)
**Tests:** 861 passed (61 test files); D23-specific: 47 tests across 3 files
**Lint:** 0 problems
**Typecheck:** clean for D23 files (pre-existing baseline in unrelated files)
**Docs audit:** 0 errors

### Completed
- Convex schema: `goals` table (org-scoped) with `by_org`, `by_org_status`, `by_org_user` indexes; `notifications.type` extended with `goal_alert`
- Convex functions: `list`, `create`, `update`, `remove` (soft-archive via `status: "paused"`), `getById`, `updateProgress`, `sendGoalAlert`, `checkVariance`
- Progress & variance computation per goal type (savings_target, monthly_spending_limit, category_budget, debt_payoff)
- Status derivation (active / at_risk / over_budget / achieved / paused)
- GoalCard component: progress ring, variance indicator, status badge, edit/delete actions
- GoalsDashboard component: goal list grid, create modal with template picker, category selector
- AnalyticsDashboard: "Goals" section integrated with `useGoals`
- `useGoals` composable: reactive goals list, CRUD, filters (active/completed/paused), totalProgress, labels, formatting helpers
- Tests: `__tests__/convex/goals.test.ts`, `__tests__/composables/useGoals.test.ts`, `__tests__/components/AnalyticsDashboard.test.ts`

### Big Three Review (2026-11-20)

| Specialist | Verdict / Status | Notes |
|-----------|-------------------|-------|
| **Implementation reviewer** | Pass (after fixes) | 4 blocking + 9 minor findings remediated (orgId mismatch, permission model, periodStart, debt payoff; cron, alertSent reset, projectedCompletion, icon a11y, template keyboard, loading state, insight key, delete handlers) |
| **Security engineer** | Pass | No XSS, auth/org-scoping, rate limits, crypto checks all pass |
| **Test engineer** | Pass | Full suite 861/861 passing; D23 coverage comprehensive |

### Open Questions Resolved
- P3-Q1 / P3-Q5: goal period — calendar month (aligned with budgets), registered in spec-gaps.md
- P3-Q2 / P3-Q6: savings goals via separate goals table, registered in spec-gaps.md
- P3-Q3 / P3-Q7: variance projection linear only for v1, registered in spec-gaps.md
- P3-Q4 / P3-Q8: goal completion — auto-archive at 100% with option to restore, registered in spec-gaps.md
