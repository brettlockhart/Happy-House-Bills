<script setup lang="ts">
import { useExpenseSummary } from "~/composables/useAdvancedFeatures";

const { summary, summaryLoading } = useExpenseSummary();

const emit = defineEmits<{
  "export-csv": [];
}>();
</script>

<template>
  <section class="hhb-card expense-summary" aria-label="Expense summary">
    <div class="hhb-card__header">
      <h2 class="hhb-card__title">Expense Summary</h2>
    </div>

    <div class="hhb-card__body">
      <div v-if="summaryLoading" class="hhb-empty">
        <p class="hhb-text-secondary">Loading summary…</p>
      </div>

      <div v-else-if="summary" class="hhb-stack">
        <div class="summary-totals">
          <div class="summary-total">
            <p class="summary-total__value">${{ (summary.total / 100).toFixed(2) }}</p>
            <p class="summary-total__label">Total Expenses</p>
          </div>
          <div class="summary-total">
            <p class="summary-total__value is-approved">${{ (summary.total / 100).toFixed(2) }}</p>
            <p class="summary-total__label">Approved Total</p>
          </div>
        </div>

        <div v-if="summary.byCategory" class="summary-group">
          <h3 class="summary-group__title">By Category</h3>
          <div
            v-for="(amount, category) in summary.byCategory"
            :key="category"
            class="summary-bar"
          >
            <div class="summary-bar__info">
              <span>{{ category }}</span>
              <span class="summary-bar__amount">${{ (amount / 100).toFixed(2) }}</span>
            </div>
            <div class="hhb-progress">
              <div
                class="hhb-progress-fill hhb-progress-fill--warn"
                :style="{ width: Math.min(100, (amount / (summary.total || 1) * 100)) + '%' }"
              />
            </div>
          </div>
        </div>

        <div v-if="summary.byMonth" class="summary-group">
          <h3 class="summary-group__title">By Month</h3>
          <div
            v-for="(amount, month) in summary.byMonth"
            :key="month"
            class="summary-bar"
          >
            <div class="summary-bar__info">
              <span>{{ month }}</span>
              <span class="summary-bar__amount">${{ (amount / 100).toFixed(2) }}</span>
            </div>
            <div class="hhb-progress">
              <div
                class="hhb-progress-fill hhb-progress-fill--info"
                :style="{ width: Math.min(100, (amount / (summary.total || 1) * 100)) + '%' }"
              />
            </div>
          </div>
        </div>

        <div v-if="summary.byPayer" class="summary-group">
          <h3 class="summary-group__title">By Payer</h3>
          <div
            v-for="(amount, payer) in summary.byPayer"
            :key="payer"
            class="summary-bar"
          >
            <div class="summary-bar__info">
              <span>{{ payer }}</span>
              <span class="summary-bar__amount">${{ (amount / 100).toFixed(2) }}</span>
            </div>
            <div class="hhb-progress">
              <div
                class="hhb-progress-fill hhb-progress-fill--ok"
                :style="{ width: Math.min(100, (amount / (summary.total || 1) * 100)) + '%' }"
              />
            </div>
          </div>
        </div>

        <button class="hhb-btn hhb-btn--primary hhb-btn--block" @click="emit('export-csv')">
          Export CSV
        </button>
      </div>
    </div>
  </section>
</template>

<style scoped>
.summary-totals {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--hhb-space-4);
}
.summary-total__value {
  font-size: var(--hhb-text-2xl);
  font-weight: var(--hhb-font-bold);
  color: var(--hhb-color-warning);
  font-variant-numeric: tabular-nums;
}
.summary-total__value.is-approved {
  color: var(--hhb-color-info);
}
.summary-total__label {
  font-size: var(--hhb-text-sm);
  color: var(--hhb-color-text-secondary);
}

.summary-group__title {
  font-size: var(--hhb-text-base);
  font-weight: var(--hhb-font-semibold);
  margin-bottom: var(--hhb-space-3);
}
.summary-bar {
  margin-bottom: var(--hhb-space-3);
}
.summary-bar__info {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--hhb-space-1);
  font-size: var(--hhb-text-sm);
}
.summary-bar__amount {
  color: var(--hhb-color-text-secondary);
  font-variant-numeric: tabular-nums;
}
</style>
