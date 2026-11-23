import { useConvexQuery } from "convex-vue";
import { api } from "~~/convex/_generated/api";

export function useGroups() {
  return {
    listMyGroups: useConvexQuery(api.functions.groups.listMine, {}),
  };
}