<script setup lang="ts">
import { computed } from "vue";
import { useAnalytics } from "~/composables/useAnalytics";

const {
  period,
  totalSpent,
  averagePerExpense,
  expenseCount,
  categories,
  topCategory,
  dailyTotals,
  forecastAmount,
  forecastConfidence,
  insightsList,
  isPending,
  error,
  setPeriod,
} = useAnalytics();

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

const severityClass = (severity: string): string => {
  switch (severity) {
    case "warning":
      return "bg-yellow-100 text-yellow-800";
    case "info":
      return "bg-blue-100 text-blue-800";
    case "positive":
      return "bg-green-100 text-green-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
};
</script>

<template>
  <div class="analytics-dashboard">
    <div class="dashboard-header">
      <h2 class="text-xl font-semibold text-gray-900">Analytics</h2>
      <div class="period-selector">
        <button
          v-for="p in periods"
          :key="p.value"
          class="px-3 py-1 text-sm rounded-lg transition-colors"
          :class="
            period === p.value
              ? 'bg-emerald-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          "
          @click="setPeriod(p.value)"
        >
          {{ p.label }}
        </button>
      </div>
    </div>

    <div v-if="isPending" class="loading-state">
      <p class="text-gray-500">Loading analytics...</p>
    </div>

    <div v-else-if="error" class="error-state">
      <p class="text-red-600">Failed to load analytics</p>
    </div>

    <div v-else class="analytics-content">
      <div class="summary-grid">
        <div class="summary-card">
          <p class="text-sm text-gray-500">Total Spent</p>
          <p class="text-2xl font-semibold text-gray-900">${{ totalSpent.toFixed(2) }}</p>
        </div>
        <div class="summary-card">
          <p class="text-sm text-gray-500">Avg per Expense</p>
          <p class="text-2xl font-semibold text-gray-900">${{ averagePerExpense.toFixed(2) }}</p>
        </div>
        <div class="summary-card">
          <p class="text-sm text-gray-500">Expenses</p>
          <p class="text-2xl font-semibold text-gray-900">{{ expenseCount }}</p>
        </div>
        <div class="summary-card">
          <p class="text-sm text-gray-500">Forecast</p>
          <p
            class="text-2xl font-semibold"
            :class="forecastConfidence === 'low' ? 'text-yellow-600' : 'text-emerald-600'"
          >
            ${{ forecastAmount.toFixed(2) }}
          </p>
        </div>
      </div>

      <div class="chart-section">
        <h3 class="text-lg font-medium text-gray-900 mb-4">Category Breakdown</h3>
        <div v-if="categories.length > 0" class="category-list">
          <div
            v-for="cat in categories"
            :key="cat.category"
            class="category-row"
          >
            <div class="category-info">
              <span class="category-name">{{ cat.category }}</span>
              <span class="category-amount">${{ cat.amount.toFixed(2) }}</span>
            </div>
            <div class="category-bar">
              <div
                  class="category-bar-fill"
                  :style="{ width: totalSpent > 0 ? `${(cat.amount / totalSpent) * 100}%` : '0%' }"
                />
            </div>
          </div>
        </div>
        <p v-else class="text-gray-400">No spending data available for this period.</p>
      </div>

      <div v-if="topCategory" class="chart-section">
        <h3 class="text-lg font-medium text-gray-900 mb-4">Top Category</h3>
        <p class="text-gray-700">
          Your highest spending is on <strong>{{ topCategory.category }}</strong>
          at <strong>${{ topCategory.amount.toFixed(2) }}</strong>
        </p>
      </div>

      <div class="chart-section">
        <h3 class="text-lg font-medium text-gray-900 mb-4">Daily Totals</h3>
        <div v-if="dailyTotals.length > 0" class="daily-chart">
          <div
            v-for="day in dailyTotals"
            :key="day.date"
            class="daily-bar"
            :style="{ height: `${(day.amount / maxDaily) * 100}%` }"
            :title="`${day.date}: $${day.amount.toFixed(2)}`"
          />
        </div>
        <p v-else class="text-gray-400">No daily data available for this period.</p>
      </div>

      <div v-if="insightsList.length > 0" class="chart-section">
        <h3 class="text-lg font-medium text-gray-900 mb-4">Insights</h3>
        <div class="insights-list">
          <div
            v-for="(insight, i) in insightsList"
            :key="i"
            class="insight-item"
            :class="severityClass(insight.severity)"
          >
            <span class="insight-icon">
              {{ insight.severity === 'warning' ? '⚠' : 'ℹ' }}
            </span>
            <span class="insight-message">{{ insight.message }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.analytics-dashboard {
  @apply p-6 bg-white rounded-lg shadow-sm border border-gray-200;
}

.dashboard-header {
  @apply flex items-center justify-between mb-6;
}

.period-selector {
  @apply flex gap-2;
}

.summary-grid {
  @apply grid grid-cols-2 md:grid-cols-4 gap-4 mb-6;
}

.summary-card {
  @apply p-4 bg-gray-50 rounded-lg;
}

.chart-section {
  @apply mt-6;
}

.category-list {
  @apply space-y-3;
}

.category-row {
  @apply flex flex-col gap-1;
}

.category-info {
  @apply flex justify-between text-sm;
}

.category-name {
  @apply font-medium text-gray-700;
}

.category-amount {
  @apply text-gray-500;
}

.category-bar {
  @apply w-full bg-gray-200 rounded-full h-2;
}

.category-bar-fill {
  @apply bg-emerald-500 h-2 rounded-full transition-all duration-300;
}

.daily-chart {
  @apply flex items-end gap-1 h-32;
}

.daily-bar {
  @apply flex-1 bg-emerald-400 rounded-t transition-all duration-300 min-h-[2px];
}

.insights-list {
  @apply space-y-2;
}

.insight-item {
  @apply flex items-start gap-2 p-3 rounded-lg text-sm;
}

.insight-item.warning {
  @apply bg-yellow-50 text-yellow-800;
}

.insight-item.info {
  @apply bg-blue-50 text-blue-800;
}

.insight-icon {
  @apply flex-shrink-0;
}

.insight-message {
  @apply flex-1;
}

.loading-state {
  @apply text-center py-12;
}

.error-state {
  @apply text-center py-12;
}

.analytics-content {
  @apply space-y-6;
}
</style>