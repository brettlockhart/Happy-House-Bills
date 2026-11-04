<script setup lang="ts">
import { useBudgets } from "~/composables/useAdvancedFeatures";

const { data: budgets, isLoading } = useBudgets();
</script>

<template>
  <div class="budget-alerts">
    <h2 class="hhb-text-lg hhb-font-semibold hhb-mb-4">Budget Alerts</h2>

    <div v-if="isLoading" class="hhb-text-center hhb-py-4">
      Loading budgets...
    </div>

    <table v-else-if="budgets.length > 0" class="hhb-table">
      <thead>
        <tr>
          <th>Category</th>
          <th>Budget Amount</th>
          <th>Period</th>
          <th>Alert Threshold</th>
          <th>Alert Sent</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="budget in budgets" :key="budget._id">
          <td>{{ budget.category }}</td>
          <td>{{ (budget.amount / 100).toFixed(2) }}</td>
          <td class="hhb-capitalize">{{ budget.period }}</td>
          <td>{{ budget.alertThreshold }}%</td>
          <td>
            <span v-if="budget.alertSent" class="hhb-badge hhb-badge-danger">Sent</span>
            <span v-else class="hhb-badge hhb-badge-success">No</span>
          </td>
        </tr>
      </tbody>
    </table>

    <div v-if="!isLoading && budgets.length === 0" class="hhb-text-center hhb-text-muted hhb-py-8">No budgets configured</div>
  </div>
</template>