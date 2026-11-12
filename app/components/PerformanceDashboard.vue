<template>
  <div class="performance-dashboard">
    <div class="dashboard-header">
      <h2 class="text-xl font-semibold text-gray-900">Performance</h2>
      <div class="status-section">
        <span class="status-badge" :class="statusClass">{{ statusText }}</span>
      </div>
    </div>

    <div class="metrics-grid">
      <div class="metric-card">
        <p class="text-sm text-gray-500">Avg Query Time</p>
        <p class="text-2xl font-semibold text-gray-900">{{ avgQueryTimeMs }}ms</p>
      </div>
      <div class="metric-card">
        <p class="text-sm text-gray-500">Cache Hit Rate</p>
        <p class="text-2xl font-semibold text-gray-900">{{ cacheHitRate }}%</p>
      </div>
      <div class="metric-card">
        <p class="text-sm text-gray-500">Error Rate</p>
        <p class="text-2xl font-semibold text-gray-900">{{ errorRate }}%</p>
      </div>
    </div>

    <div class="chart-section">
      <h3 class="text-lg font-medium text-gray-900 mb-4">Slow Queries</h3>
      <div v-if="slowQueries.length > 0" class="slow-query-list">
        <div v-for="(q, i) in slowQueries" :key="`${q.query}-${i}`" class="slow-query-item">
          <span>{{ q.query }}</span>
          <span>{{ q.elapsedMs }}ms</span>
        </div>
      </div>
      <p v-else class="text-gray-400">No slow queries detected.</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from "vue";
import { usePerformance } from "~/composables/usePerformance";

const { status, metrics, slowQueries, refresh } = usePerformance();

onMounted(() => {
  refresh();
});

const avgQueryTimeMs = computed(() => metrics.value.avgQueryTimeMs);
const cacheHitRate = computed(() => metrics.value.cacheHitRate);
const errorRate = computed(() => metrics.value.errorRate);

const statusClass = computed(() => {
  switch (status.value) {
    case "healthy":
      return "bg-green-100 text-green-800";
    case "degraded":
      return "bg-yellow-100 text-yellow-800";
    case "critical":
      return "bg-red-100 text-red-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
});

const statusText = computed(() => {
  switch (status.value) {
    case "healthy":
      return "Healthy";
    case "degraded":
      return "Degraded";
    case "critical":
      return "Critical";
    default:
      return "Unknown";
  }
});
</script>

<style scoped>
.performance-dashboard {
  @apply p-6 bg-white rounded-lg shadow-sm border border-gray-200;
}
.dashboard-header {
  @apply flex items-center justify-between mb-6;
}
.status-section {
  @apply flex items-center gap-2;
}
.status-badge {
  @apply px-3 py-1 text-sm font-medium rounded-full;
}
.metrics-grid {
  @apply grid grid-cols-3 gap-4 mb-6;
}
.metric-card {
  @apply p-4 bg-gray-50 rounded-lg;
}
.chart-section {
  @apply mt-6;
}
.slow-query-list {
  @apply space-y-2;
}
.slow-query-item {
  @apply flex justify-between p-2 bg-gray-50 rounded text-sm;
}
.text-gray-400 {
  @apply text-gray-400;
}
</style>
