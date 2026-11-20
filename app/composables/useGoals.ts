import { computed } from "vue";
import { useConvexQuery, useConvexMutation } from "convex-vue";
import { api } from "~~/convex/_generated/api";
import type { Doc } from "~~/convex/_generated/dataModel";

type Goal = Doc<"goals">;

export type GoalType =
  | "savings_target"
  | "monthly_spending_limit"
  | "category_budget"
  | "debt_payoff";

export type GoalStatus =
  | "active"
  | "achieved"
  | "at_risk"
  | "over_budget"
  | "paused";

export interface GoalTemplate {
  name: string;
  type: GoalType;
  targetAmount: number;
  icon: string;
  color: string;
}

export const GOAL_TEMPLATES: GoalTemplate[] = [
  { name: "Emergency Fund", type: "savings_target", targetAmount: 10000, icon: "shield", color: "#22c55e" },
  { name: "Vacation Fund", type: "savings_target", targetAmount: 3000, icon: "plane", color: "#3b82f6" },
  { name: "Large Purchase", type: "savings_target", targetAmount: 5000, icon: "shopping-bag", color: "#a855f7" },
  { name: "Debt Freedom", type: "debt_payoff", targetAmount: 0, icon: "credit-card", color: "#ef4444" },
  { name: "Monthly Budget", type: "monthly_spending_limit", targetAmount: 2000, icon: "wallet", color: "#f59e0b" },
];

export function useGoals() {
  const result = useConvexQuery(api.functions.goals.list, {});
  const createMutation = useConvexMutation(api.functions.goals.create);
  const updateMutation = useConvexMutation(api.functions.goals.update);
  const removeMutation = useConvexMutation(api.functions.goals.remove);

  const goals = computed(() => (result.data.value as Goal[] | undefined) ?? []);
  const isLoading = computed(() => result.isPending.value || createMutation.isPending.value || updateMutation.isPending.value || removeMutation.isPending.value);

  const activeGoals = computed(() =>
    goals.value.filter((g) => g.status === "active" || g.status === "at_risk"),
  );
  const completedGoals = computed(() =>
    goals.value.filter((g) => g.status === "achieved"),
  );
  const pausedGoals = computed(() =>
    goals.value.filter((g) => g.status === "paused" || g.status === "over_budget"),
  );

  const totalProgress = computed(() => {
    if (activeGoals.value.length === 0) return 0;
    const sum = activeGoals.value.reduce((acc, g) => acc + g.progressPercent, 0);
    return Math.round(sum / activeGoals.value.length);
  });

  const createGoal = createMutation.mutate;
  const updateGoal = updateMutation.mutate;
  const deleteGoal = removeMutation.mutate;

  const goalStatusLabel = (status: GoalStatus): string => {
    const labels: Record<GoalStatus, string> = {
      active: "On track",
      achieved: "Achieved",
      at_risk: "At risk",
      over_budget: "Over budget",
      paused: "Paused",
    };
    return labels[status] ?? status;
  };

  const goalTypeLabel = (type: GoalType): string => {
    const labels: Record<GoalType, string> = {
      savings_target: "Savings Target",
      monthly_spending_limit: "Monthly Spending Limit",
      category_budget: "Category Budget",
      debt_payoff: "Debt Payoff",
    };
    return labels[type] ?? type;
  };

  const formatProgress = (goal: Goal): string => {
    const pct = goal.progressPercent;
    if (pct >= 100) return `${Math.round(pct)}%`;
    if (pct >= 1) return `${Math.round(pct)}%`;
    return "<1%";
  };

  const formatVariance = (goal: Goal): string => {
    const v = goal.varianceAmount;
    if (v === 0) return "$0.00";
    const sign = v > 0 ? "+" : "";
    return `${sign}$${Math.abs(v).toFixed(2)}`;
  };

  const templateDefaults = (template: GoalTemplate) => ({
    name: template.name,
    type: template.type,
    targetAmount: template.targetAmount,
    alertAtPercent: 80,
  });

  return {
    goals,
    activeGoals,
    completedGoals,
    pausedGoals,
    totalProgress,
    isLoading,
    createGoal,
    updateGoal,
    deleteGoal,
    goalStatusLabel,
    goalTypeLabel,
    formatProgress,
    formatVariance,
    templateDefaults,
    templates: GOAL_TEMPLATES,
  };
}