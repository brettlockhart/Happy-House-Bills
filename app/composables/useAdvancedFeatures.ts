import { computed, ref } from "vue";
import { useConvexQuery, useConvexMutation } from "convex-vue";
import { api } from "~/convex/_generated/api";
import type { Category, Budget, ExpenseSummary, Expense } from "~/convex/_generated/api";

export function useCategories() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = useConvexQuery((api as any).categories?.list || (api as any).categories?.listCategories, {});
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const createMutation = useConvexMutation((api as any).categories?.create || (api as any).categories?.createCategory);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updateMutation = useConvexMutation((api as any).categories?.update || (api as any).categories?.updateCategory);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const deleteMutation = useConvexMutation((api as any).categories?.delete || (api as any).categories?.deleteCategory || (api as any).categories?.del);

  return {
    data: computed(() => (result.data.value as Category[] | undefined) ?? []),
    isLoading: computed(() => result.isPending.value || createMutation.isPending.value || updateMutation.isPending.value || deleteMutation.isPending.value),
    createCategory: createMutation.mutate,
    updateCategory: updateMutation.mutate,
    deleteCategory: deleteMutation.mutate,
  };
}

export function useBudgets() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = useConvexQuery((api as any).budgets?.list || (api as any).budgets?.listBudgets, {});
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const createMutation = useConvexMutation((api as any).budgets?.create || (api as any).budgets?.createBudget);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updateMutation = useConvexMutation((api as any).budgets?.update || (api as any).budgets?.updateBudget);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const deleteMutation = useConvexMutation((api as any).budgets?.delete || (api as any).budgets?.deleteBudget || (api as any).budgets?.del);

  return {
    data: computed(() => (result.data.value as Budget[] | undefined) ?? []),
    isLoading: computed(() => result.isPending.value || createMutation.isPending.value || updateMutation.isPending.value || deleteMutation.isPending.value),
    createBudget: createMutation.mutate,
    updateBudget: updateMutation.mutate,
    deleteBudget: deleteMutation.mutate,
  };
}

export function useReports() {
  const filters = ref({
    dateFrom: undefined as string | undefined,
    dateTo: undefined as string | undefined,
    category: undefined as string | undefined,
    userId: undefined as string | undefined,
    status: undefined as string | undefined,
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const generateQuery = useConvexQuery((api as any).reports?.generate || (api as any).reports?.generateReport, filters);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const exportCsvQuery = useConvexQuery((api as any).reports?.exportCsv || (api as any).reports?.exportReportCsv, filters);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const summaryQuery = useConvexQuery((api as any).reports?.summary || (api as any).reports?.getExpenseSummary || (api as any).reports?.getSummary, {});

  return {
    data: computed(() => (generateQuery.data.value as Expense[] | undefined) ?? []),
    isLoading: computed(() => generateQuery.isPending.value),
    csv: computed(() => exportCsvQuery.data.value as string | undefined),
    isExporting: exportCsvQuery.isPending,
    summary: computed(() => summaryQuery.data.value as ExpenseSummary | undefined),
    isSummaryLoading: summaryQuery.isPending,
    filters,
  };
}

export function useExpenseSummary() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const summaryQuery = useConvexQuery((api as any).reports?.summary || (api as any).reports?.getExpenseSummary || (api as any).reports?.getSummary, {});

  const summary = computed(() => {
    return summaryQuery.data.value as ExpenseSummary | undefined;
  });

  const summaryLoading = computed(() => summaryQuery.isPending.value);

  return {
    summary,
    summaryLoading,
  };
}