<template>
  <div class="insights-panel">
    <h3 class="text-lg font-medium text-gray-900 mb-4">Insights</h3>
    <div v-if="isPending" class="loading-state">
      <p class="text-gray-500">Generating insights...</p>
    </div>
    <div v-else-if="error" class="error-state">
      <p class="text-red-600">Failed to generate insights</p>
    </div>
    <div v-else-if="insights.length > 0" class="insights-list">
      <div
        v-for="(insight, i) in insights"
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
    <p v-else class="text-gray-400">No insights available.</p>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useAnalytics } from "~/composables/useAnalytics";

const {
  isPending,
  error,
  insightsList,
} = useAnalytics();

const insights = computed(() => insightsList.value);

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

<style scoped>
.insights-panel {
  @apply p-4 bg-gray-50 rounded-lg;
}

.insights-list {
  @apply space-y-2;
}

.insight-item {
  @apply flex items-start gap-2 p-3 rounded-lg text-sm;
}

.insight-item.warning {
  @apply bg-yellow-100 text-yellow-800;
}

.insight-item.info {
  @apply bg-blue-100 text-blue-800;
}

.insight-item.positive {
  @apply bg-green-100 text-green-800;
}

.insight-icon {
  @apply flex-shrink-0;
}

.insight-message {
  @apply flex-1;
}

.loading-state {
  @apply text-center py-4;
}

.error-state {
  @apply text-center py-4;
}
</style>
