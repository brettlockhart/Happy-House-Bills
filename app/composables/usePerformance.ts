import { computed, ref } from "vue";

export interface PerformanceMetrics {
  avgQueryTimeMs: number;
  cacheHitRate: number;
  errorRate: number;
}

export interface SlowQuery {
  query: string;
  elapsedMs: number;
  timestamp: number;
}

export function usePerformance() {
  const status = ref<"healthy" | "degraded" | "critical">("healthy");
  const metrics = ref<PerformanceMetrics>({ avgQueryTimeMs: 0, cacheHitRate: 0, errorRate: 0 });
  const slowQueries = ref<SlowQuery[]>([]);
  const isLoading = ref(false);
  const error = ref<Error | null>(null);

  const refresh = async () => {
    isLoading.value = true;
    try {
      // In production this would call Convex monitoring queries
      status.value = "healthy";
      metrics.value = { avgQueryTimeMs: 45, cacheHitRate: 85, errorRate: 0 };
      slowQueries.value = [];
    } catch (err) {
      status.value = "critical";
      error.value = err instanceof Error ? err : new Error("Unknown error");
    } finally {
      isLoading.value = false;
    }
  };

  return { status, metrics, slowQueries, isLoading, error, refresh };
}

export function usePerformanceMonitoring() {
  const status = computed(() => "healthy");
  const metrics = computed(() => ({ avgQueryTimeMs: 0, cacheHitRate: 0, errorRate: 0 }));
  return { status, metrics };
}