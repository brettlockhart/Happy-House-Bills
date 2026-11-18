import { describe, it, expect, vi, beforeEach } from "vitest";
import { computed, reactive } from "vue";

const { mockQueryData, mockMutationPending } = vi.hoisted(() => ({
  mockQueryData: { value: [] as unknown[] },
  mockMutationPending: { value: false },
}));

vi.mock("convex-vue", () => ({
  useConvexQuery: () => ({
    data: { value: mockQueryData.value },
    isPending: { value: false },
  }),
  useConvexMutation: () => ({
    mutate: vi.fn().mockResolvedValue({ id: "new_settlement_id" }),
    isPending: { value: mockMutationPending.value },
    error: { value: null },
  }),
}));

vi.mock("~~/convex/_generated/api", () => ({
  api: {
    functions: {
      settlements: {
        create: { _name: "create" },
        list: { _name: "list" },
      },
    },
  },
  Settlement: {} as never,
}));

vi.mock("~~/convex/_generated/dataModel", () => ({
  Doc: {} as never,
  Id: {} as never,
}));

globalThis.computed = computed;
globalThis.reactive = reactive;

const { useSettlements } = await import("../../app/composables/useSettlements");

describe("useSettlements", () => {
  beforeEach(() => {
    mockQueryData.value = [];
    mockMutationPending.value = false;
  });

  it("returns settlements list with correct structure", () => {
    mockQueryData.value = [{ _id: "set1", amount: 50 }];
    const result = useSettlements();
    expect(result.data.value).toHaveLength(1);
    expect((result.data.value as unknown[])[0]).toEqual({ _id: "set1", amount: 50 });
  });

  it("returns createSettlement as a function", () => {
    const { createSettlement } = useSettlements();
    expect(typeof createSettlement).toBe("function");
  });

  it("returns isLoading as a boolean ref", () => {
    const { isLoading } = useSettlements();
    expect(typeof isLoading.value).toBe("boolean");
    expect(isLoading.value).toBe(false);
  });

  it("returns isLoading true when mutation is pending", () => {
    mockMutationPending.value = true;
    const { isLoading } = useSettlements();
    expect(isLoading.value).toBe(true);
  });

  it("falls back to empty array when query data is undefined", () => {
    mockQueryData.value = undefined as unknown as unknown[];
    const result = useSettlements();
    expect(result.data.value).toEqual([]);
  });

  it("falls back to empty array when query data is null", () => {
    mockQueryData.value = null as unknown as unknown[];
    const result = useSettlements();
    expect(result.data.value).toEqual([]);
  });

  it("returns data ref that is defined", () => {
    const result = useSettlements();
    expect(result.data).toBeDefined();
  });
});
