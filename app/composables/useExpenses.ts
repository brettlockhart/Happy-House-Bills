import { computed } from "vue";
import { useConvexQuery, useConvexMutation } from "convex-vue";
import { api } from "~/convex/_generated/api";
import type { Doc } from "~/convex/_generated/dataModel";

type Expense = Doc<"expenses"> & {
  categoryColor?: string;
  categoryIcon?: string;
  category?: string;
};
type BalanceResult = { balance: number; owesWhom: string };

export function useBalance() {
  const result = useConvexQuery(api.functions.expenses.balance, {});
  return {
    data: computed(() => result.data.value as BalanceResult | undefined),
    balance: computed(() => (result.data.value as BalanceResult | undefined)?.balance ?? 0),
    owesWhom: computed(() => (result.data.value as BalanceResult | undefined)?.owesWhom ?? ""),
    isPending: result.isPending,
  };
}

export function useExpenses() {
  const result = useConvexQuery(api.functions.expenses.list, {});
  const createMutation = useConvexMutation(api.functions.expenses.create);

  return {
    data: computed(() => (result.data.value as Expense[] | undefined) ?? []),
    isLoading: computed(() => result.isPending.value || createMutation.isPending.value),
    createExpense: createMutation.mutate,
  };
}

export function usePendingExpenses() {
  const result = useConvexQuery(api.functions.expenses.pending, {});
  const approveMutation = useConvexMutation(api.functions.expenses.approve);
  const rejectMutation = useConvexMutation(api.functions.expenses.reject);

  return {
    data: computed(() => (result.data.value as Expense[] | undefined) ?? []),
    isLoading: result.isPending,
    approveExpense: approveMutation.mutate,
    rejectExpense: rejectMutation.mutate,
  };
}
