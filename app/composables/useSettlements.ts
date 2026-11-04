import { useConvexQuery, useConvexMutation } from "convex-vue";
import { api } from "~/convex/_generated/api";
import type { Settlement } from "~/convex/_generated/api";

export function useSettlements() {
  const result = useConvexQuery(api.settlements.list, {});
  const createMutation = useConvexMutation(api.settlements.create);

  return {
    data: computed(() => (result.data.value as Settlement[] | undefined) ?? []),
    isLoading: computed(() => result.isPending.value || createMutation.isPending.value),
    createSettlement: createMutation.mutate,
  };
}
