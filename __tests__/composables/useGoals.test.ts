import { describe, it, expect, vi, beforeEach } from "vitest";
import { useConvexQuery } from "convex-vue";

vi.mock("convex-vue", () => ({
  useConvexQuery: vi.fn((_api: unknown, _args: unknown) => ({
    data: { value: null },
    isPending: { value: false },
    error: { value: null },
  })),
  useConvexMutation: vi.fn(() => ({
    mutate: vi.fn(),
    isPending: { value: false },
    error: { value: null },
  })),
}));

vi.mock("~~/convex/_generated/api", () => ({
  api: {
    functions: {
      goals: {
        list: {},
        create: {},
        update: {},
        remove: {},
        getById: {},
      },
    },
  },
}));

describe("useGoals", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns initial state from convex queries", async () => {
    const { useGoals } = await import("../../app/composables/useGoals");
    const result = useGoals();

    expect(result.goals).toBeDefined();
    expect(result.isLoading).toBeDefined();
    expect(result.activeGoals).toBeDefined();
    expect(result.completedGoals).toBeDefined();
    expect(result.pausedGoals).toBeDefined();
    expect(result.totalProgress).toBeDefined();
    expect(result.createGoal).toBeDefined();
    expect(result.updateGoal).toBeDefined();
    expect(result.deleteGoal).toBeDefined();
    expect(result.goalStatusLabel).toBeDefined();
    expect(result.goalTypeLabel).toBeDefined();
    expect(result.formatProgress).toBeDefined();
    expect(result.formatVariance).toBeDefined();
    expect(result.templateDefaults).toBeDefined();
    expect(result.templates).toBeDefined();
  });

  function setupGoalsMock(data: unknown) {
    vi.mocked(useConvexQuery).mockReturnValueOnce({
      data: { value: data },
      isPending: { value: false },
      error: { value: null },
    } as never);
  }

  it("computes active goals filter", async () => {
    const { useGoals } = await import("../../app/composables/useGoals");
    setupGoalsMock([
      { status: "active", progressPercent: 50 },
      { status: "achieved", progressPercent: 100 },
      { status: "at_risk", progressPercent: 90 },
    ]);

    const result = useGoals();

    expect(result.activeGoals.value.length).toBe(2);
    expect(result.activeGoals.value[0].status).toBe("active");
    expect(result.activeGoals.value[1].status).toBe("at_risk");
  });

  it("computes completed goals filter", async () => {
    const { useGoals } = await import("../../app/composables/useGoals");
    setupGoalsMock([
      { status: "active", progressPercent: 50 },
      { status: "achieved", progressPercent: 100 },
    ]);

    const result = useGoals();

    expect(result.completedGoals.value.length).toBe(1);
    expect(result.completedGoals.value[0].status).toBe("achieved");
  });

  it("computes paused goals filter", async () => {
    const { useGoals } = await import("../../app/composables/useGoals");
    setupGoalsMock([
      { status: "paused", progressPercent: 30 },
      { status: "over_budget", progressPercent: 110 },
      { status: "active", progressPercent: 50 },
    ]);

    const result = useGoals();

    expect(result.pausedGoals.value.length).toBe(2);
    expect(result.pausedGoals.value[0].status).toBe("paused");
    expect(result.pausedGoals.value[1].status).toBe("over_budget");
  });

  it("computes totalProgress average from active goals", async () => {
    const { useGoals } = await import("../../app/composables/useGoals");
    setupGoalsMock([
      { status: "active", progressPercent: 80 },
      { status: "active", progressPercent: 60 },
      { status: "achieved", progressPercent: 100 },
    ]);

    const result = useGoals();

    expect(result.totalProgress.value).toBe(70);
  });

  it("computes totalProgress as 0 when no active goals", async () => {
    const { useGoals } = await import("../../app/composables/useGoals");
    setupGoalsMock([{ status: "achieved", progressPercent: 100 }]);

    const result = useGoals();

    expect(result.totalProgress.value).toBe(0);
  });

  it("handles empty goals list", async () => {
    const { useGoals } = await import("../../app/composables/useGoals");
    setupGoalsMock([]);

    const result = useGoals();

    expect(result.goals.value).toEqual([]);
    expect(result.activeGoals.value).toEqual([]);
    expect(result.completedGoals.value).toEqual([]);
    expect(result.pausedGoals.value).toEqual([]);
    expect(result.totalProgress.value).toBe(0);
  });

  it("returns isLoading true when query is pending", async () => {
    const { useGoals } = await import("../../app/composables/useGoals");
    vi.mocked(useConvexQuery).mockReturnValueOnce({
      data: { value: null },
      isPending: { value: true },
      error: { value: null },
    } as unknown as ReturnType<typeof useConvexQuery> extends (a: never, b: never) => infer R
      ? R
      : MockQueryReturn);

    const result = useGoals();

    expect(result.isLoading.value).toBe(true);
  });

  it("labels statuses correctly", async () => {
    const { useGoals } = await import("../../app/composables/useGoals");
    const result = useGoals();

    expect(result.goalStatusLabel("active")).toBe("On track");
    expect(result.goalStatusLabel("achieved")).toBe("Achieved");
    expect(result.goalStatusLabel("at_risk")).toBe("At risk");
    expect(result.goalStatusLabel("over_budget")).toBe("Over budget");
    expect(result.goalStatusLabel("paused")).toBe("Paused");
  });

  it("labels goal types correctly", async () => {
    const { useGoals } = await import("../../app/composables/useGoals");
    const result = useGoals();

    expect(result.goalTypeLabel("savings_target")).toBe("Savings Target");
    expect(result.goalTypeLabel("monthly_spending_limit")).toBe("Monthly Spending Limit");
    expect(result.goalTypeLabel("category_budget")).toBe("Category Budget");
    expect(result.goalTypeLabel("debt_payoff")).toBe("Debt Payoff");
  });

  it("formats progress percentage", async () => {
    const { useGoals } = await import("../../app/composables/useGoals");
    const result = useGoals();

    expect(result.formatProgress({ progressPercent: 100 })).toBe("100%");
    expect(result.formatProgress({ progressPercent: 42.7 })).toBe("43%");
    expect(result.formatProgress({ progressPercent: 0.5 })).toBe("<1%");
  });

  it("formats variance amount", async () => {
    const { useGoals } = await import("../../app/composables/useGoals");
    const result = useGoals();

    expect(result.formatVariance({ varianceAmount: 0 })).toBe("$0.00");
    expect(result.formatVariance({ varianceAmount: 12.5 })).toBe("+$12.50");
    expect(result.formatVariance({ varianceAmount: -10 })).toBe("$10.00");
  });

  it("applies template defaults", async () => {
    const { useGoals, GOAL_TEMPLATES } = await import("../../app/composables/useGoals");
    const result = useGoals();

    const defaults = result.templateDefaults(GOAL_TEMPLATES[0]);
    expect(defaults.name).toBe("Emergency Fund");
    expect(defaults.type).toBe("savings_target");
    expect(defaults.targetAmount).toBe(10000);
    expect(defaults.alertAtPercent).toBe(80);
  });
});
