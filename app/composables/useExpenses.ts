import { useConvexQuery, useConvexMutation } from "convex-vue";
import { api } from "~/convex/_generated/api";
import type { BalanceResult, Expense } from "~/convex/_generated/api";

export function useBalance() {
  const result = useConvexQuery(api.expenses.balance, {});
  return {
    data: computed(() => result.data.value as BalanceResult | undefined),
    balance: computed(() => (result.data.value as BalanceResult | undefined)?.balance ?? 0),
    owesWhom: computed(() => (result.data.value as BalanceResult | undefined)?.owesWhom ?? ""),
    isPending: result.isPending,
  };
}

export function useExpenses() {
  const result = useConvexQuery(api.expenses.list, {});
  const createMutation = useConvexMutation(api.expenses.create);

  return {
    data: computed(() => (result.data.value as Expense[] | undefined) ?? []),
    isLoading: computed(() => result.isPending.value || createMutation.isPending.value),
    createExpense: createMutation.mutate,
  };
}

export function usePendingExpenses() {
  const result = useConvexQuery(api.expenses.pending, {});
  const approveMutation = useConvexMutation(api.expenses.approve);
  const rejectMutation = useConvexMutation(api.expenses.reject);

  return {
    data: computed(() => (result.data.value as Expense[] | undefined) ?? []),
    isLoading: result.isPending,
    approveExpense: approveMutation.mutate,
    rejectExpense: rejectMutation.mutate,
  };
}
