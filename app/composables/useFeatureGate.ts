import { useConvexClient } from "convex-vue";
import { api } from "~~/convex/_generated/api";

export function useFeatureGate() {
  const client = useConvexClient();

  async function getRole(_orgId?: string, _userId?: string): Promise<"free" | "paying" | "admin"> {
    const res = await client.query(api.functions.orgs.getMySubscriptionRole, {});
    const role = res.subscriptionRole as "free" | "paying" | "admin";
    return role ?? "free";
  }

  async function getUsageLimits(_orgId?: string) {
    return client.query(api.functions.orgs.getMyUsageLimits, {});
  }

  async function incrementExpenseCount(_orgId?: string) {
    return client.mutation(api.functions.orgs.incrementMyExpenseCount, {});
  }

  async function incrementOcrCount(_orgId?: string) {
    return client.mutation(api.functions.orgs.incrementMyOcrCount, {});
  }

  function canAccess(role: "free" | "paying" | "admin", requiredRole: "free" | "paying" | "admin"): boolean {
    const rank: Record<string, number> = { free: 0, paying: 1, admin: 2 };
    return (rank[role] ?? 0) >= (rank[requiredRole] ?? 0);
  }

  function hasReachedLimit(limits: { expenseCount: number; ocrCount: number; expenseCap: number; ocrCap: number } | null, type: "expense" | "ocr"): boolean {
    if (!limits) return false;
    return type === "expense" ? limits.expenseCount >= limits.expenseCap : limits.ocrCount >= limits.ocrCap;
  }

  function isAt80Percent(limits: { expenseCount: number; ocrCount: number; expenseCap: number; ocrCap: number } | null, type: "expense" | "ocr"): boolean {
    if (!limits) return false;
    const cap = type === "expense" ? limits.expenseCap : limits.ocrCap;
    const count = type === "expense" ? limits.expenseCount : limits.ocrCount;
    return count >= Math.ceil(cap * 0.8);
  }

  return {
    getRole,
    getUsageLimits,
    incrementExpenseCount,
    incrementOcrCount,
    canAccess,
    hasReachedLimit,
    isAt80Percent,
  };
}