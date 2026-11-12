import { computed } from "vue";
import { useConvexQuery, useConvexMutation } from "convex-vue";
import { api } from "~/convex/_generated/api";
import type { Doc } from "~/convex/_generated/dataModel";

type Settlement = Doc<"settlements">;

export function useSettlements() {
  const result = useConvexQuery(api.functions.settlements.list, {});
  const createMutation = useConvexMutation(api.functions.settlements.create);

  return {
    data: computed(() => (result.data.value as Settlement[] | undefined) ?? []),
    isLoading: computed(() => result.isPending.value || createMutation.isPending.value),
    createSettlement: createMutation.mutate,
  };
}
