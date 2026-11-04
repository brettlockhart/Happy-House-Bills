import { describe, it, expect, vi } from "vitest";
import { computed, reactive } from "vue";

vi.mock("convex-vue", () => ({
  useConvexQuery: (ref: { _name: string }) => ({
    data: { value: ref._name === "balance" ? { balance: -25, owesWhom: "partner" } : [] },
    isPending: { value: false },
  }),
  useConvexMutation: () => ({
    mutate: vi.fn().mockResolvedValue({ id: "new_id" }),
    isPending: { value: false },
    error: { value: null },
  }),
}));

vi.mock("~/convex/_generated/api", () => ({
  api: {
    expenses: {
      create: { _name: "create" },
      list: { _name: "list" },
      pending: { _name: "pending" },
      balance: { _name: "balance" },
    },
  },
  BalanceResult: {} as never,
  Expense: {} as never,
}));

vi.mock("~/convex/_generated/dataModel", () => ({
  Doc: {} as never,
  Id: {} as never,
}));

globalThis.computed = computed;
globalThis.reactive = reactive;

const { useBalance, useExpenses, usePendingExpenses } = await import("../../app/composables/useExpenses");

describe("useBalance", () => {
  it("returns balance data with proper structure", () => {
    const result = useBalance();
    expect(result.data.value).toEqual({ balance: -25, owesWhom: "partner" });
  });

  it("returns numeric balance", () => {
    const { balance } = useBalance();
    expect(typeof balance.value).toBe("number");
    expect(balance.value).toBe(-25);
  });

  it("returns string owesWhom", () => {
    const { owesWhom } = useBalance();
    expect(typeof owesWhom.value).toBe("string");
    expect(owesWhom.value).toBe("partner");
  });

  it("returns isPending ref", () => {
    const { isPending } = useBalance();
    expect(isPending.value).toBe(false);
  });
});

describe("useExpenses", () => {
  it("returns expenses list and createExpense function", () => {
    const result = useExpenses();
    expect(result.data.value).toEqual([]);
    expect(typeof result.createExpense).toBe("function");
  });

  it("returns isLoading computed", () => {
    const { isLoading } = useExpenses();
    expect(isLoading.value).toBe(false);
  });
});

describe("usePendingExpenses", () => {
  it("returns pending expenses list and mutation functions", () => {
    const result = usePendingExpenses();
    expect(result.data.value).toEqual([]);
    expect(typeof result.approveExpense).toBe("function");
    expect(typeof result.rejectExpense).toBe("function");
  });

  it("returns isLoading state", () => {
    const { isLoading } = usePendingExpenses();
    expect(isLoading.value).toBe(false);
  });
});