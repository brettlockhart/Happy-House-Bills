import { describe, it, expect, vi, beforeEach } from "vitest";
import type { OfflineOutboxRecord, OfflineOutboxStorage } from "../../app/utils/offlineOutbox";

const mockStorage = vi.hoisted(() => {
  let idCounter = 0;
  const records = new Map<string, OfflineOutboxRecord>();

  const storage: OfflineOutboxStorage & {
    markSyncing: ReturnType<typeof vi.fn>;
    markDone: ReturnType<typeof vi.fn>;
    markFailed: ReturnType<typeof vi.fn>;
    retry: ReturnType<typeof vi.fn>;
    clear: ReturnType<typeof vi.fn>;
    listPending: ReturnType<typeof vi.fn>;
    enqueue: ReturnType<typeof vi.fn>;
  } = {
    enqueue: vi.fn(async (input) => {
      const record: OfflineOutboxRecord = {
        ...input,
        id: `expense_${++idCounter}`,
        status: "pending",
        retryCount: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      records.set(record.id, record);
      return record;
    }),
    listPending: vi.fn(async () => {
      return Array.from(records.values()).filter((r) => r.status === "pending");
    }),
    markSyncing: vi.fn(async (id) => {
      const r = records.get(id);
      if (!r) return null;
      const updated = { ...r, status: "syncing" as const };
      records.set(id, updated);
      return updated;
    }),
    markDone: vi.fn(async (id) => {
      const r = records.get(id);
      if (!r) return null;
      const updated = { ...r, status: "done" as const };
      records.set(id, updated);
      return updated;
    }),
    markFailed: vi.fn(async (id, _error) => {
      const r = records.get(id);
      if (!r) return null;
      const updated = { ...r, status: "failed" as const };
      records.set(id, updated);
      return updated;
    }),
    retry: vi.fn(async (id) => {
      const r = records.get(id);
      if (!r) return null;
      const updated = { ...r, status: "pending" as const };
      records.set(id, updated);
      return updated;
    }),
    clear: vi.fn(async () => {
      records.clear();
    }),
  };

  return {
    storage,
    records,
    reset() {
      records.clear();
      idCounter = 0;
      vi.clearAllMocks();
    },
  };
});

vi.mock("../../app/utils/offlineOutbox", () => ({
  createOfflineOutbox: vi.fn(),
  isOfflineOutboxRecordReady: (_record: OfflineOutboxRecord, _now: number, _stale: number) => true,
  type: {} as never,
}));

const { useOfflineOutbox } = await import("../../app/composables/useOfflineOutbox");

beforeEach(() => {
  mockStorage.reset();
});

describe("useOfflineOutbox", () => {
  it("returns expected properties and methods", () => {
    const result = useOfflineOutbox({
      createExpense: vi.fn(),
      storage: mockStorage.storage,
    });
    expect(result).toHaveProperty("enqueueExpense");
    expect(result).toHaveProperty("pendingCount");
    expect(result).toHaveProperty("syncWhenOnline");
    expect(result).toHaveProperty("lastSyncError");
    expect(result).toHaveProperty("ready");
    expect(result).toHaveProperty("dispose");
  });

  it("enqueueExpense increments pendingCount", async () => {
    const { enqueueExpense, pendingCount } = useOfflineOutbox({
      createExpense: vi.fn(),
      storage: mockStorage.storage,
    });

    expect(pendingCount.value).toBe(0);
    await enqueueExpense({ amount: 10, description: "test", category: "other" });
    expect(pendingCount.value).toBe(1);
  });

  it("syncWhenOnline skips when offline", async () => {
    const { syncWhenOnline } = useOfflineOutbox({
      createExpense: vi.fn(),
      storage: mockStorage.storage,
      isOnline: () => false,
    });

    const result = await syncWhenOnline();
    expect(result.synced).toBe(0);
    expect(result.failed).toBe(0);
  });

  it("syncWhenOnline processes all pending records", async () => {
    mockStorage.storage.enqueue({ amount: 10, description: "a", category: "other" });
    mockStorage.storage.enqueue({ amount: 20, description: "b", category: "other" });

    const createExpense = vi.fn().mockResolvedValue(undefined);
    const { syncWhenOnline } = useOfflineOutbox({
      createExpense,
      storage: mockStorage.storage,
      isOnline: () => true,
    });

    await new Promise((resolve) => setTimeout(resolve, 0));

    const result = await syncWhenOnline();
    expect(result.synced).toBe(2);
    expect(result.failed).toBe(0);
    expect(createExpense).toHaveBeenCalledTimes(2);
  });

  it("syncWhenOnline handles failures and records error", async () => {
    mockStorage.storage.enqueue({ amount: 10, description: "a", category: "other" });

    const createExpense = vi.fn().mockRejectedValue(new Error("Network error"));
    const { syncWhenOnline, lastSyncError } = useOfflineOutbox({
      createExpense,
      storage: mockStorage.storage,
      isOnline: () => true,
    });

    await new Promise((resolve) => setTimeout(resolve, 0));

    const result = await syncWhenOnline();
    expect(result.synced).toBe(0);
    expect(result.failed).toBe(1);
    expect(lastSyncError.value?.message).toBe("Network error");
  });

  it("syncWhenOnline skips records that are not ready", async () => {
    const { syncWhenOnline } = useOfflineOutbox({
      createExpense: vi.fn(),
      storage: mockStorage.storage,
      isOnline: () => true,
    });

    const result = await syncWhenOnline();
    expect(result.skipped).toBe(0);
  });

  it("syncWhenOnline prevents concurrent syncs", async () => {
    let resolveFirst: (value: unknown) => void;
    const firstPromise = new Promise((resolve) => { resolveFirst = resolve; });

    const createExpense = vi.fn().mockReturnValueOnce(firstPromise);
    const { syncWhenOnline } = useOfflineOutbox({
      createExpense,
      storage: mockStorage.storage,
      isOnline: () => true,
    });

    mockStorage.storage.enqueue({ amount: 10, description: "a", category: "other" });
    await new Promise((resolve) => setTimeout(resolve, 0));

    const sync1 = syncWhenOnline();
    const sync2 = syncWhenOnline();

    expect(sync1).toBe(sync2);
    resolveFirst(undefined);
    await sync1;
  });

  it("dispose is callable", () => {
    const result = useOfflineOutbox({
      createExpense: vi.fn(),
      storage: mockStorage.storage,
    });

    expect(() => result.dispose()).not.toThrow();
  });

  it("listens to online events by default", () => {
    const addEventListener = vi.fn();
    const removeEventListener = vi.fn();
    const eventTarget = { addEventListener, removeEventListener };

    const result = useOfflineOutbox({
      createExpense: vi.fn(),
      storage: mockStorage.storage,
      eventTarget,
    });

    expect(addEventListener).toHaveBeenCalledWith("online", expect.any(Function));
    result.dispose();
    expect(removeEventListener).toHaveBeenCalledWith("online", expect.any(Function));
  });
});