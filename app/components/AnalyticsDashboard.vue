<script setup lang="ts">
import { computed, ref } from "vue";
import { useAnalytics } from "~/composables/useAnalytics";
import { useGoals } from "~/composables/useGoals";
import type { Id } from "~~/convex/_generated/dataModel";
import { useBudgets } from "~/composables/useAdvancedFeatures";
import ReportBuilderModal from "~/components/ReportBuilderModal.vue";
import GoalCard from "~/components/GoalCard.vue";

const {
  period,
  totalSpent,
  averagePerExpense,
  expenseCount,
  categories: categorySpending,
  topCategory,
  dailyTotals,
  forecastAmount,
  forecastConfidence,
  insightsList,
  isPending,
  error,
  setPeriod,
} = useAnalytics();

const { data: budgets } = useBudgets();
const {
  activeGoals,
  completedGoals,
  pausedGoals,
  totalProgress,
  isLoading: goalsIsLoading,
  deleteGoal,
} = useGoals();

const showReportModal = ref(false);

const handleReportCreated = (_reportId: string) => {
  showReportModal.value = false;
};

const handleGoalDelete = (goalId: Id<"goals">) => {
  deleteGoal({ goalId });
};

const periods: Array<{ value: "week" | "month" | "quarter" | "year"; label: string }> = [
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
  { value: "quarter", label: "Quarter" },
  { value: "year", label: "Year" },
];

const maxDaily = computed(() => {
  if (dailyTotals.value.length === 0) return 1;
  return Math.max(...dailyTotals.value.map((d) => d.amount));
});

const budgetProgress = computed(() => {
  const catSpend = new Map((categorySpending.value || []).map((c) => [c.category, c.amount]));
  return (budgets.value || [])
    .filter((b) => b.period === "monthly")
    .map((budget) => {
      const spent = catSpend.get(budget.category) ?? 0;
      const limit = budget.amount / 100;
      const pct = limit > 0 ? (spent / limit) * 100 : 0;
      return { budget, spent, limit, pct };
    });
});

const severityClass = (severity: string): string => {
  switch (severity) {
    case "warning":
      return "hhb-insight--warning";
    case "info":
      return "hhb-insight--info";
    case "positive":
      return "hhb-insight--positive";
    default:
      return "hhb-insight--info";
  }
};

const budgetBarClass = (pct: number): string => {
  if (pct >= 100) return "hhb-progress-fill--over";
  if (pct >= 80) return "hhb-progress-fill--warn";
  return "hhb-progress-fill--ok";
};
</script>

<template>
  <section class="hhb-card analytics" aria-label="Analytics">
    <div class="hhb-card__header analytics__header">
      <h2 class="hhb-card__title">Analytics</h2>
      <div class="hhb-segmented" role="tablist" aria-label="Period">
        <button
          v-for="p in periods"
          :key="p.value"
          class="hhb-segmented__btn"
          :class="{ 'is-active': period === p.value }"
          role="tab"
          :aria-selected="period === p.value"
          @click="setPeriod(p.value)"
        >
          {{ p.label }}
        </button>
      </div>
    </div>

    <div class="hhb-card__body">
      <div v-if="isPending" class="hhb-empty">
        <p class="hhb-text-secondary">Loading analytics…</p>
      </div>

      <div v-else-if="error" class="hhb-empty">
        <p class="hhb-empty__title">Couldn't load analytics</p>
        <p class="hhb-text-secondary">Please try again in a moment.</p>
      </div>

      <div v-else class="hhb-stack">
        <!-- KPI stats -->
        <div class="summary-grid">
          <div class="summary-card">
            <p class="summary-card__label">Total Spent</p>
            <p class="summary-card__value">${{ totalSpent.toFixed(2) }}</p>
          </div>
          <div class="summary-card">
            <p class="summary-card__label">Avg per Expense</p>
            <p class="summary-card__value">${{ averagePerExpense.toFixed(2) }}</p>
          </div>
          <div class="summary-card">
            <p class="summary-card__label">Expenses</p>
            <p class="summary-card__value">{{ expenseCount }}</p>
          </div>
          <div class="summary-card">
            <p class="summary-card__label">Forecast</p>
            <p
              class="summary-card__value"
              :class="forecastConfidence === 'low' ? 'is-warn' : 'is-good'"
            >
              ${{ forecastAmount.toFixed(2) }}
            </p>
          </div>
        </div>

        <!-- Category breakdown -->
        <section class="analytics-section">
          <h3 class="analytics-section__title">Category Breakdown</h3>
          <div v-if="categorySpending.length > 0" class="category-list">
            <div
              v-for="cat in categorySpending"
              :key="cat.category"
              class="category-row"
            >
              <div class="category-row__info">
                <span class="category-row__name">{{ cat.category }}</span>
                <span class="category-row__amount">${{ cat.amount.toFixed(2) }}</span>
              </div>
              <div class="hhb-progress">
                <div
                  class="category-bar-fill hhb-progress-fill"
                  :style="{ width: totalSpent > 0 ? `${(cat.amount / totalSpent) * 100}%` : '0%' }"
                />
              </div>
            </div>
          </div>
          <p v-else class="hhb-text-muted">No spending data available for this period.</p>
        </section>

        <!-- Budget progress -->
        <section v-if="budgetProgress.length > 0" class="analytics-section">
          <h3 class="analytics-section__title">Budget Progress</h3>
          <div class="budget-list">
            <div
              v-for="{ budget, spent, limit, pct } in budgetProgress"
              :key="budget._id"
              class="budget-row"
            >
              <div class="budget-row__info">
                <span class="budget-row__name">{{ budget.category }}</span>
                <span class="budget-row__amount">
                  ${{ spent.toFixed(2) }} / ${{ limit.toFixed(2) }}
                </span>
              </div>
              <div class="hhb-progress">
                <div
                  class="budget-bar-fill hhb-progress-fill"
                  :class="budgetBarClass(pct)"
                  :style="{ width: `${Math.min(pct, 100)}%` }"
                />
              </div>
              <p v-if="pct >= 80" class="budget-row__warning" :class="{ 'is-over': pct >= 100 }">
                {{ pct >= 100 ? "Over budget" : "Near limit" }}
              </p>
            </div>
          </div>
        </section>

        <!-- Top category -->
        <section v-if="topCategory" class="analytics-section">
          <h3 class="analytics-section__title">Top Category</h3>
          <p class="hhb-text-secondary">
            Your highest spending is on <strong>{{ topCategory.category }}</strong>
            at <strong>${{ topCategory.amount.toFixed(2) }}</strong>
          </p>
        </section>

        <!-- Daily totals -->
        <section class="analytics-section">
          <h3 class="analytics-section__title">Daily Totals</h3>
          <div v-if="dailyTotals.length > 0" class="daily-chart" role="img" aria-label="Daily spending">
            <div
              v-for="day in dailyTotals"
              :key="day.date"
              class="daily-bar"
              :style="{ height: `${(day.amount / maxDaily) * 100}%` }"
              :title="`${day.date}: $${day.amount.toFixed(2)}`"
            />
          </div>
          <p v-else class="hhb-text-muted">No daily data available for this period.</p>
        </section>

        <!-- Insights -->
        <section v-if="insightsList.length > 0" class="analytics-section">
          <h3 class="analytics-section__title">Insights</h3>
          <div class="insights-list">
            <div
              v-for="insight in insightsList"
              :key="`${insight.type}:${insight.message}`"
              class="hhb-insight"
              :class="severityClass(insight.severity)"
            >
              <span class="hhb-insight__icon" aria-hidden="true">
                {{ insight.severity === 'warning' ? '⚠' : 'ℹ' }}
              </span>
              <span class="hhb-insight__message">{{ insight.message }}</span>
            </div>
          </div>
        </section>

        <div class="analytics-actions">
          <button class="hhb-btn hhb-btn--secondary" @click="showReportModal = true">
            Export Insights
          </button>
        </div>

        <!-- Goals section -->
        <section class="analytics-section">
          <h3 class="analytics-section__title">Goals</h3>
          <div v-if="goalsIsLoading" class="hhb-empty">
            <p class="hhb-text-secondary">Loading goals…</p>
          </div>
          <div v-else-if="activeGoals.length === 0 && completedGoals.length === 0 && pausedGoals.length === 0" class="hhb-empty">
            <p class="hhb-text-secondary">No goals yet. Create your first goal to track progress.</p>
          </div>
          <div v-else class="goal-section">
            <div class="goal-section__summary">
              <span class="goal-section__count">{{ activeGoals.length }} active</span>
              <span class="goal-section__progress">{{ Math.round(totalProgress) }}% overall</span>
            </div>
            <div class="goal-section__list">
<GoalCard
              v-for="goal in activeGoals"
              :key="goal._id"
              :goal="goal"
              :on-delete="() => handleGoalDelete(goal._id)"
/>
            </div>
            <div v-if="completedGoals.length > 0" class="goal-section__completed">
              <h4 class="goal-section__title">Completed</h4>
              <div class="goal-section__list">
<GoalCard
              v-for="goal in completedGoals"
              :key="goal._id"
              :goal="goal"
              :on-delete="() => handleGoalDelete(goal._id)"
/>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>

    <ReportBuilderModal
      :visible="showReportModal"
      @close="showReportModal = false"
      @created="handleReportCreated"
    />
  </section>
</template>

<style scoped>
.analytics__header {
  flex-wrap: wrap;
  gap: var(--hhb-space-3);
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--hhb-space-3);
}
@media (min-width: 768px) {
  .summary-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); }
}

.summary-card {
  background: var(--hhb-color-bg-alt);
  border: 1px solid var(--hhb-color-border);
  border-radius: var(--hhb-radius-lg);
  padding: var(--hhb-space-4);
}
.summary-card__label {
  font-size: var(--hhb-text-sm);
  color: var(--hhb-color-text-secondary);
}
.summary-card__value {
  margin-top: var(--hhb-space-1);
  font-size: var(--hhb-text-2xl);
  font-weight: var(--hhb-font-bold);
  letter-spacing: -0.02em;
  font-variant-numeric: tabular-nums;
}
.summary-card__value.is-good { color: var(--hhb-color-success); }
.summary-card__value.is-warn { color: var(--hhb-color-warning); }

.analytics-section {
  padding-top: var(--hhb-space-4);
  border-top: 1px solid var(--hhb-color-border);
}
.analytics-section__title {
  font-size: var(--hhb-text-base);
  font-weight: var(--hhb-font-semibold);
  margin-bottom: var(--hhb-space-3);
}

.category-list,
.budget-list {
  display: flex;
  flex-direction: column;
  gap: var(--hhb-space-3);
}
.category-row__info,
.budget-row__info {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--hhb-space-1);
}
.category-row__name,
.budget-row__name {
  font-size: var(--hhb-text-sm);
  font-weight: var(--hhb-font-medium);
}
.category-row__amount,
.budget-row__amount {
  font-size: var(--hhb-text-sm);
  color: var(--hhb-color-text-secondary);
  font-variant-numeric: tabular-nums;
}
.budget-row__warning {
  margin-top: var(--hhb-space-1);
  font-size: var(--hhb-text-xs);
  color: var(--hhb-color-warning);
}
.budget-row__warning.is-over { color: var(--hhb-color-error); }

.daily-chart {
  display: flex;
  align-items: flex-end;
  gap: 0.25rem;
  height: 8rem;
}
.daily-bar {
  flex: 1;
  min-height: 2px;
  background: var(--hhb-color-primary-light);
  border-radius: var(--hhb-radius-sm) var(--hhb-radius-sm) 0 0;
  transition: height var(--hhb-transition-slow);
}
.daily-bar:hover { background: var(--hhb-color-primary); }

.insights-list {
  display: flex;
  flex-direction: column;
  gap: var(--hhb-space-2);
}
.hhb-insight {
  display: flex;
  align-items: flex-start;
  gap: var(--hhb-space-2);
  padding: var(--hhb-space-3);
  border-radius: var(--hhb-radius-lg);
  font-size: var(--hhb-text-sm);
}
.hhb-insight--warning {
  background: var(--hhb-color-warning-subtle);
  color: var(--hhb-color-warning);
}
.hhb-insight--info {
  background: var(--hhb-color-info-subtle);
  color: var(--hhb-color-info);
}
.hhb-insight--positive {
  background: var(--hhb-color-success-subtle);
  color: var(--hhb-color-primary-dark);
}
.hhb-insight__icon { flex-shrink: 0; }
.hhb-insight__message { flex: 1; color: var(--hhb-color-text); }

.analytics-actions {
  display: flex;
  justify-content: flex-end;
  padding-top: var(--hhb-space-4);
  border-top: 1px solid var(--hhb-color-border);
}
</style>
