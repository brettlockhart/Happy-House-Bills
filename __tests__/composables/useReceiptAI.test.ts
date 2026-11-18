import { describe, it, expect, vi, beforeEach } from "vitest";

const mockClient = vi.hoisted(() => ({
  action: vi.fn(),
  mutation: vi.fn(),
}));

const mockQueryData = vi.hoisted(() => ({
  value: [] as Array<{ _id: string; store?: string; date: string; amount: number }>,
}));

vi.mock("convex-vue", () => ({
  useConvexClient: () => mockClient,
  useConvexQuery: (_ref: { _name: string }) => ({
    data: mockQueryData,
  }),
}));

vi.mock("~~/convex/_generated/api", () => ({
  api: {
    functions: {
      receiptUpgrades: {
        needsAiUpgrade: { _name: "needsAiUpgrade" },
        dismissOcrUpgrade: { _name: "dismissOcrUpgrade" },
      },
      ocrOpenRouter: {
        reprocessReceipt: { _name: "reprocessReceipt" },
      },
    },
  },
}));

vi.mock("~~/convex/_generated/dataModel", () => ({
  Doc: {} as never,
  Id: {} as never,
}));

const { useReceiptAI } = await import("../../app/composables/useReceiptAI");

beforeEach(() => {
  vi.clearAllMocks();
  mockQueryData.value = [];
  mockClient.action.mockResolvedValue(undefined);
  mockClient.mutation.mockResolvedValue(undefined);
});

describe("useReceiptAI", () => {
  it("returns expected reactive properties and methods", () => {
    const result = useReceiptAI();
    expect(result).toHaveProperty("pendingUpgrades");
    expect(result).toHaveProperty("pendingCount");
    expect(result).toHaveProperty("isUpgrading");
    expect(result).toHaveProperty("syncError");
    expect(result).toHaveProperty("upgradeReceipt");
    expect(result).toHaveProperty("dismissReceipt");
    expect(result).toHaveProperty("syncWhenOnline");
  });

  it("pendingUpgrades is empty by default", () => {
    const { pendingUpgrades } = useReceiptAI();
    expect(pendingUpgrades.value).toEqual([]);
  });

  it("pendingCount is zero by default", () => {
    const { pendingCount } = useReceiptAI();
    expect(pendingCount.value).toBe(0);
  });

  it("upgradeReceipt calls client.action with expenseId", async () => {
    const { upgradeReceipt } = useReceiptAI();
    await upgradeReceipt("expense_1" as never);
    expect(mockClient.action).toHaveBeenCalledWith(
      expect.objectContaining({ _name: "reprocessReceipt" }),
      { expenseId: "expense_1" },
    );
  });

  it("dismissReceipt calls client.mutation with expenseId", async () => {
    const { dismissReceipt } = useReceiptAI();
    await dismissReceipt("expense_1" as never);
    expect(mockClient.mutation).toHaveBeenCalledWith(
      expect.objectContaining({ _name: "dismissOcrUpgrade" }),
      { expenseId: "expense_1" },
    );
  });

  it("syncWhenOnline returns early when offline", async () => {
    Object.defineProperty(navigator, "onLine", { value: false, configurable: true });
    try {
      const { syncWhenOnline, syncError } = useReceiptAI();
      await syncWhenOnline();
      expect(syncError.value).toBe("Connect to the internet to improve receipts with AI.");
    } finally {
      Object.defineProperty(navigator, "onLine", { value: true, configurable: true });
    }
  });

  it("syncWhenOnline returns early when already upgrading", async () => {
    const { syncWhenOnline, isUpgrading } = useReceiptAI();
    isUpgrading.value = true;
    await syncWhenOnline();
    expect(mockClient.action).not.toHaveBeenCalled();
  });

  it("syncWhenOnline returns early when no pending upgrades", async () => {
    const { syncWhenOnline } = useReceiptAI();
    mockQueryData.value = [];
    await syncWhenOnline();
    expect(mockClient.action).not.toHaveBeenCalled();
  });

  it("syncWhenOnline processes all pending upgrades", async () => {
    mockQueryData.value = [
      { _id: "expense_1", store: "Store A", date: "2024-01-01", amount: 10 },
      { _id: "expense_2", store: "Store B", date: "2024-01-02", amount: 20 },
    ];
    const { syncWhenOnline, isUpgrading } = useReceiptAI();
    await syncWhenOnline();
    expect(isUpgrading.value).toBe(false);
    expect(mockClient.action).toHaveBeenCalledTimes(2);
    expect(mockClient.action).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ _name: "reprocessReceipt" }),
      { expenseId: "expense_1" },
    );
    expect(mockClient.action).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ _name: "reprocessReceipt" }),
      { expenseId: "expense_2" },
    );
  });

  it("syncWhenOnline sets syncError on partial failure", async () => {
    mockQueryData.value = [
      { _id: "expense_1", store: "Store A", date: "2024-01-01", amount: 10 },
      { _id: "expense_2", store: "Store B", date: "2024-01-02", amount: 20 },
    ];
    mockClient.action
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("Network error"));
    const { syncWhenOnline, syncError } = useReceiptAI();
    await syncWhenOnline();
    expect(syncError.value).toContain("1 receipt couldn't be upgraded");
  });

  it("syncWhenOnline handles multiple failures", async () => {
    mockQueryData.value = [
      { _id: "expense_1", store: "Store A", date: "2024-01-01", amount: 10 },
      { _id: "expense_2", store: "Store B", date: "2024-01-02", amount: 20 },
      { _id: "expense_3", store: "Store C", date: "2024-01-03", amount: 30 },
    ];
    mockClient.action
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("Network error"))
      .mockRejectedValueOnce(new Error("Timeout"));
    const { syncWhenOnline, syncError } = useReceiptAI();
    await syncWhenOnline();
    expect(syncError.value).toContain("2 receipts couldn't be upgraded");
  });

  it("isUpgrading is true during sync and false after", async () => {
    mockQueryData.value = [{ _id: "expense_1", store: "Store A", date: "2024-01-01", amount: 10 }];
    let resolveAction: (value: unknown) => void;
    const actionPromise = new Promise((resolve) => { resolveAction = resolve; });
    mockClient.action.mockReturnValueOnce(actionPromise);

    const { syncWhenOnline, isUpgrading } = useReceiptAI();
    const syncPromise = syncWhenOnline();
    expect(isUpgrading.value).toBe(true);
    resolveAction!(undefined);
    await syncPromise;
    expect(isUpgrading.value).toBe(false);
  });
});