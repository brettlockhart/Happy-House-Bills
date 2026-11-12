import { computed, ref } from "vue";
import { useConvexQuery } from "convex-vue";
import { api } from "~/convex/_generated/api";

export interface CategorySpending {
  category: string;
  amount: number;
}

export interface DailyTotal {
  date: string;
  amount: number;
}

export interface AnalyticsSummary {
  period: string;
  totalSpent: number;
  averagePerExpense: number;
  expenseCount: number;
  categories: CategorySpending[];
  topCategory: { category: string; amount: number } | null;
  dailyTotals: DailyTotal[];
}

export interface ForecastResult {
  forecast: number;
  confidence: string;
  period: string;
  historicalTotal: number;
  dataPoints: number;
}

export interface InsightItem {
  type: string;
  severity: string;
  message: string;
}

export interface InsightsResult {
  insights: InsightItem[];
}

export function useAnalytics() {
  const period = ref<"week" | "month" | "quarter" | "year">("month");
  const forecastPeriod = computed(() => (period.value === "week" ? "month" : period.value));

  const summary = useConvexQuery(api.functions.analytics.summary, () => ({ period: period.value }));

  const forecast = useConvexQuery(api.functions.predictions.forecast, () => ({ period: forecastPeriod.value }));

  const insights = useConvexQuery(api.functions.insights.insights, {});

  const totalSpent = computed(() => summary.data.value?.totalSpent ?? 0);
  const averagePerExpense = computed(() => summary.data.value?.averagePerExpense ?? 0);
  const expenseCount = computed(() => summary.data.value?.expenseCount ?? 0);
  const categories = computed<CategorySpending[]>(
    () => summary.data.value?.categories ?? [],
  );
  const topCategory = computed(() => summary.data.value?.topCategory ?? null);
  const dailyTotals = computed<DailyTotal[]>(
    () => summary.data.value?.dailyTotals ?? [],
  );

  const forecastAmount = computed(() => forecast.data.value?.forecast ?? 0);
  const forecastConfidence = computed(() => forecast.data.value?.confidence ?? "low");

  const insightsList = computed<InsightItem[]>(
    () => insights.data.value?.insights ?? [],
  );

  const isPending = computed(
    () => summary.isPending.value || forecast.isPending.value || insights.isPending.value,
  );

  const error = computed(() => summary.error.value ?? forecast.error.value ?? insights.error.value);

  const setPeriod = (newPeriod: "week" | "month" | "quarter" | "year") => {
    period.value = newPeriod;
  };

  return {
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
  };
}
