<script setup lang="ts">
import { useExpenseSummary } from "~/composables/useAdvancedFeatures";

const { summary, summaryLoading } = useExpenseSummary();

const emit = defineEmits<{
  "export-csv": [];
}>();
</script>

<template>
  <div class="expense-summary">
    <div class="hhb-flex hhb-justify-between hhb-items-end hhb-mb-4">
      <h2 class="hhb-text-lg hhb-font-semibold">Expense Summary</h2>
    </div>

    <div v-if="summaryLoading" class="hhb-text-center hhb-py-4">
      Loading summary...
    </div>

    <div v-else-if="summary">
      <div class="hhb-grid hhb-grid-cols-2 hhb-gap-4 hhb-mb-4">
        <div>
          <div class="hhb-text-2xl hhb-text-orange-600">${{ (summary.total / 100).toFixed(2) }}</div>
          <div class="hhb-text-sm hhb-text-muted">Total Expenses</div>
        </div>
        <div>
          <div class="hhb-text-2xl hhb-text-blue-600">${{ (summary.total / 100).toFixed(2) }}</div>
          <div class="hhb-text-sm hhb-text-muted">Approved Total</div>
        </div>
      </div>

      <div class="hhb-grid hhb-gap-4">
        <div v-for="(amount, category) in summary.byCategory" :key="category" class="hhb-col-6">
          <div class="hhb-flex hhb-justify-between hhb-mb-1">
            <span>{{ category }}</span>
            <span class="hhb-text-orange-600">${{ (amount / 100).toFixed(2) }}</span>
          </div>
          <div class="hhb-h-2 hhb-rounded hhb-bg-orange-100" :style="{ width: Math.min(100, (amount / (summary.total || 1) * 100)) + '%' }"/>
        </div>

        <div v-for="(amount, month) in summary.byMonth" :key="month" class="hhb-col-6">
          <div class="hhb-flex hhb-justify-between hhb-mb-1">
            <span>{{ month }}</span>
            <span class="hhb-text-blue-600">${{ (amount / 100).toFixed(2) }}</span>
          </div>
          <div class="hhb-h-2 hhb-rounded hhb-bg-blue-100" :style="{ width: Math.min(100, (amount / (summary.total || 1) * 100)) + '%' }"/>
        </div>
      </div>

      <div class="hhb-grid hhb-grid-cols-2 hhb-gap-4">
        <div v-for="(amount, payer) in summary.byPayer" :key="payer" class="hhb-col-6">
          <div class="hhb-flex hhb-justify-between hhb-mb-1">
            <span>{{ payer }}</span>
            <span class="hhb-text-green-600">${{ (amount / 100).toFixed(2) }}</span>
          </div>
          <div class="hhb-h-2 hhb-rounded hhb-bg-green-100" :style="{ width: Math.min(100, (amount / (summary.total || 1) * 100)) + '%' }"/>
        </div>
      </div>
    </div>

    <button class="hhb-btn hhb-btn-primary hhb-w-full hhb-mt-4" @click="emit('export-csv')">
      Export CSV
    </button>
  </div>
</template>