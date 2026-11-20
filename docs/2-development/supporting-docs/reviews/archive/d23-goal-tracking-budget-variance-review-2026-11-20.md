# Implementation Review: D23 Goal Tracking & Budget Variance

**Verdict:** Pass (after remediation)
**Slice:** D23 Goal Tracking & Budget Variance
**Date:** 18-November-2026 (initial review) / 20-November-2026 (final sign-off)
**Reviewer:** implementation-reviewer (agent)
**Archived:** 20-November-2026

---

## Slice Summary

| Field | Value |
|-------|-------|
| **Slice** | D23 Goal Tracking & Budget Variance |
| **Phase** | Phase 3 Enhancement |
| **Dependencies** | D15 (analytics), D18 (notifications), D20 (categories) |
| **Blocks** | None (additive feature) |
| **Lifecycle** | 03-ready-for-review |
| **Files Modified** | 13 new/modified (convex/functions/goals.ts, convex/schema.ts, convex/functions/notifications.ts, app/composables/useGoals.ts, app/components/GoalCard.vue, app/components/GoalsDashboard.vue, app/components/AnalyticsDashboard.vue, __tests__/convex/goals.test.ts, __tests__/composables/useGoals.test.ts, __tests__/components/AnalyticsDashboard.test.ts) |

---

## Verification Checks

| Check | Status | Details |
|-------|--------|---------|
| Lint (new files) | ✅ Pass | 0 errors on D23 files |
| Typecheck | ✅ Pass | D23 files clean; pre-existing errors in unrelated files unchanged |
| Tests | ✅ Pass | 861 tests across 61 files (full suite); 47 D23-specific tests |
| Docs audit | ✅ Pass | 0 errors, 18 pre-existing warnings |

---

## Remediation Log (2026-11-18)

Four blocking correctness issues were identified and fixed:

1. **Daily variance check non-functional** — `listOrgs` internal query enumerates `orgId`s from the `goals` table (not `orgs.slug`), so `checkVariance` passes the correct Clerk org ID to `updateProgress`. Daily variance job now processes goals.

2. **Permission model contradicted spec** — `update` and `remove` mutations no longer restrict edits to the goal creator only; both active org members can edit/delete via the existing `assertOrgWriteAccess` org-membership check. Updated D23 tests accordingly.

3. **Schema validation would fail on create** — `create` mutation now sets required schema field `periodStart: now` on insert. Covered by new test assertion.

4. **Debt payoff progress calculation** — `computeCurrent` for `debt_payoff` now uses the goal's manual `currentAmount` (consistent with savings targets) rather than summing all settlements; settlements carry no debt/category tag in the schema, so manual tracking is the correct data path.

### Minor findings remediated during review:

5. **Cron initial-trigger fix** — Added `convex/crons.ts` declaring a daily Convex cron schedule for `goal-variance-check` (hourUTC 3:00) that invokes `internal.functions.goals.checkVariance`. Removed the `checkVariance` self-scheduling via `ctx.scheduler.runAfter`, now handled declaratively by the cron system.

6. **`alertSent` now resets when status returns to active** — In `updateProgress`, `alertSent` is set to `false` when `status` changes back to `"active"`, so re-crossing thresholds will fire new alerts. Prevents permanent suppression of alerts.

7. **`projectedCompletion` computed in `updateProgress`** — Linear projection based on current run rate: `now + (target - current) / dailyRunRate`. Computed only for savings_target and debt_payoff when 0 < progress < 100.

8. **GoalCard icon accessibility** — Added `aria-label` on the icon `<span>`: `aria-label="icon for goal type ${props.goal.type}"`.

9. **Template picker keyboard activation** — Added `role="button"`, `tabindex="0"`, `@keydown.enter.prevent`, and `@keydown.space.prevent` handlers on each template card in GoalsDashboard, matching the same `@click` handler.

### Post-promotion cleanup (20-November-2026)

10. **`formatVariance` return type simplified** — Changed from `{ sign: string; text: string }` to `string` (sign redundant with text). Updated `__tests__/composables/useGoals.test.ts` assertions accordingly.

11. **Fixed invalid `<option disabled value>` HTML** — Changed to `<option disabled>` in GoalsDashboard.vue category selector.

### Open questions remaining (documented in spec-gaps.md):

- P3-Q5: Goal period semantics (calendar month vs. rolling 30d vs. custom)
- P3-Q6: Savings goals as separate goals table vs. category
- P3-Q7: Variance projection method (linear only vs. seasonality)
- P3-Q8: Goal completion (auto-archive at 100% vs. manual)

### Security & Accessibility Checklists (all pass)

- Security: No XSS, iframe, or secret issues in this slice
- Accessibility: GoalCard icon now has `aria-label`; template picker keyboard-navigable; WCAG AA colour tokens used

---

## Summary

The D23 Goal Tracking & Budget Variance slice delivers the complete feature set: org-scoped goals table with four types (savings target, monthly spending limit, category budget, debt payoff), CRUD operations with real-time progress, variance analysis with status derivation, goal templates seeded on create, and Alert notifications via the existing notification infrastructure. Frontend components (GoalCard, GoalsDashboard with modal create + template picker, AnalyticsDashboard integration) and composable (`useGoals`) are all functional.

All four blocking issues from the initial review have been remediated. Minor findings were also addressed (cron scheduling, alertSent reset, projectedCompletion, icon accessibility, template picker keyboard). Post-promotion cleanup resolved two remaining minor items (`formatVariance` return type and `<option disabled>` markup). The full test suite (861 tests across 61 files) passes, lint is clean (0 errors), and typecheck is clean for all D23 files.

**Open questions** in `spec-gaps.md` (4 entries) reflect unresolved product decisions that will be tracked separately; they do not block promotion.

---

## Promotion Checklist (per AGENTS.md §110-115)

- [x] Run `/slice-promote D23` to advance lifecycle
- [x] Verify roadmap milestone updated in `docs/2-development/roadmap.md`
- [x] Verify priority table updated in `docs/2-development/README.md`
- [x] Archive review report to `docs/2-development/supporting-docs/reviews/archive/`

---

## Handoff Options

| Option | Trigger | Next Action |
|--------|---------|-------------|
| Promote to implemented | Verdict = Pass | Run `/slice-promote D23` to move doc from `03-ready-for-review` → `04-implemented` |
| Security deep-dive | Security issues found | Invoke `security-engineer` |
| Test improvement | Test gaps found | Invoke `test-engineer` to add integration tests |