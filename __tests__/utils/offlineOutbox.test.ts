import { IDBFactory } from "fake-indexeddb";
import { describe, expect, it, vi } from "vitest";
import {
  createOfflineOutbox,
  getOfflineOutboxRetryDelay,
  type EnqueueOfflineExpenseInput,
  type OfflineBase64ReceiptFrame,
} from "../../app/utils/offlineOutbox";

let databaseSequence = 0;

function expenseInput(id = "expense-1"): EnqueueOfflineExpenseInput {
  return {
    id,
    clientRequestId: `request-${id}`,
    orgId: "org-1",
    userId: "user-1",
    expense: { amount: 42.5, description: "Weekly shop", category: "groceries" },
    createdAt: 1_000,
  };
}

describe("offlineOutbox IndexedDB persistence", () => {
  it("persists expense and receipt frames across storage instances", async () => {
    const indexedDB = new IDBFactory();
    const databaseName = `offline-outbox-${++databaseSequence}`;
    const first = createOfflineOutbox({ indexedDB, databaseName });
    const base64Frame: OfflineBase64ReceiptFrame = {
      data: "cmVjZWlwdA==",
      encoding: "base64",
      mimeType: "image/jpeg",
      fileName: "receipt.jpg",
    };

    await first.enqueue({
      ...expenseInput(),
      receiptFrames: [
        new Blob(["receipt bytes"], { type: "image/jpeg" }),
        Uint8Array.from([1, 2, 3]).buffer,
        Uint8Array.from([4, 5, 6]),
        base64Frame,
      ],
    });

    // A new store over the same factory simulates an application reload.
    const reopened = createOfflineOutbox({ indexedDB, databaseName });
    const pending = await reopened.listPending();

    expect(pending).toHaveLength(1);
    expect(pending[0]).toMatchObject({
      id: "expense-1",
      clientRequestId: "request-expense-1",
      orgId: "org-1",
      userId: "user-1",
      expense: { amount: 42.5, description: "Weekly shop", category: "groceries" },
      createdAt: 1_000,
      retryCount: 0,
      status: "pending",
    });
    expect(pending[0]?.receiptFrames).toHaveLength(4);
    expect(await (pending[0]?.receiptFrames[0] as Blob).text()).toBe("receipt bytes");
    expect([...new Uint8Array(pending[0]?.receiptFrames[1] as ArrayBuffer)]).toEqual([1, 2, 3]);
    expect([...(pending[0]?.receiptFrames[2] as Uint8Array)]).toEqual([4, 5, 6]);
    expect(pending[0]?.receiptFrames[3]).toEqual(base64Frame);

    await reopened.markDone("expense-1");
    expect(await first.listPending()).toEqual([]);
  });

  it("keeps records ordered by creation time", async () => {
    const storage = createOfflineOutbox({
      indexedDB: new IDBFactory(),
      databaseName: `offline-outbox-${++databaseSequence}`,
    });
    await storage.enqueue({ ...expenseInput("later"), createdAt: 2_000 });
    await storage.enqueue({ ...expenseInput("earlier"), createdAt: 1_000 });

    expect((await storage.listPending()).map((record) => record.id)).toEqual(["earlier", "later"]);
  });
});

describe("offlineOutbox state and retry handling", () => {
  it("tracks syncing, exponential failure backoff, manual retry, done, and clear", async () => {
    let now = 5_000;
    const storage = createOfflineOutbox({
      indexedDB: null,
      now: () => now,
      baseDelayMs: 100,
      maxDelayMs: 250,
    });
    await storage.enqueue(expenseInput("one"));
    await storage.enqueue(expenseInput("two"));

    expect((await storage.markSyncing("one"))).toMatchObject({
      status: "syncing",
      retryCount: 0,
      updatedAt: 5_000,
    });
    expect((await storage.markFailed("one", new Error("Network unavailable")))).toMatchObject({
      status: "failed",
      retryCount: 1,
      nextAttemptAt: 5_100,
      lastError: "Network unavailable",
    });

    now = 5_100;
    expect((await storage.markFailed("one", "Still unavailable"))).toMatchObject({
      status: "failed",
      retryCount: 2,
      nextAttemptAt: 5_300,
      lastError: "Still unavailable",
    });

    const retried = await storage.retry("one");
    expect(retried).toMatchObject({
      status: "pending",
      retryCount: 2,
      nextAttemptAt: 5_100,
      lastError: "Still unavailable",
    });
    expect(await storage.retry("missing")).toBeNull();

    await storage.markDone("one");
    expect((await storage.listPending()).map((record) => record.id)).toEqual(["two"]);
    await storage.clear();
    expect(await storage.listPending()).toEqual([]);
  });

  it("caps exponential delays", () => {
    expect(getOfflineOutboxRetryDelay(1, { baseDelayMs: 100, maxDelayMs: 250 })).toBe(100);
    expect(getOfflineOutboxRetryDelay(2, { baseDelayMs: 100, maxDelayMs: 250 })).toBe(200);
    expect(getOfflineOutboxRetryDelay(3, { baseDelayMs: 100, maxDelayMs: 250 })).toBe(250);
  });
});

describe("offlineOutbox memory fallback", () => {
  it("works without IndexedDB and never writes receipt data to localStorage", async () => {
    const setItem = vi.spyOn(window.localStorage, "setItem");
    const storage = createOfflineOutbox({ indexedDB: null, createId: () => "memory-1" });

    const record = await storage.enqueue({
      ...expenseInput(),
      id: undefined,
      clientRequestId: undefined,
      receiptFrames: [new Blob(["memory receipt"]), { data: "AAEC", encoding: "base64" }],
    });

    expect(record).toMatchObject({ id: "memory-1", clientRequestId: "memory-1", status: "pending" });
    expect(await storage.listPending()).toHaveLength(1);
    expect(await (record.receiptFrames[0] as Blob).text()).toBe("memory receipt");
    expect(setItem).not.toHaveBeenCalled();
    setItem.mockRestore();
  });

  it("falls back when IndexedDB cannot be opened", async () => {
    const indexedDB = {
      open: vi.fn(() => {
        throw new Error("Storage access denied");
      }),
    } as unknown as IDBFactory;
    const storage = createOfflineOutbox({ indexedDB });

    await storage.enqueue(expenseInput("denied"));
    expect(await storage.listPending()).toHaveLength(1);
    expect((await storage.markSyncing("denied"))?.status).toBe("syncing");
    await storage.clear();
    expect(await storage.listPending()).toEqual([]);
  });
});
