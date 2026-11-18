import { getCurrentScope, onScopeDispose, readonly, ref, type Ref } from "vue";
import {
  createOfflineOutbox,
  isOfflineOutboxRecordReady,
  type EnqueueOfflineExpenseInput,
  type OfflineOutboxRecord,
  type OfflineOutboxStorage,
} from "~/utils/offlineOutbox";

export type CreateOfflineExpenseHandler = (record: OfflineOutboxRecord) => unknown;

export interface OfflineOutboxEventTarget {
  addEventListener(type: "online", listener: () => void): void;
  removeEventListener(type: "online", listener: () => void): void;
}

export interface UseOfflineOutboxOptions {
  /** Receives the complete durable record, including clientRequestId and receiptFrames. */
  createExpense: CreateOfflineExpenseHandler;
  /** Optional for tests or for sharing one store across composable instances. */
  storage?: OfflineOutboxStorage;
  /** Defaults to true. The browser online event triggers a sequential sync. */
  autoSync?: boolean;
  eventTarget?: OfflineOutboxEventTarget | null;
  isOnline?: () => boolean;
  /** A syncing record older than this is considered abandoned and retried. */
  staleSyncingMs?: number;
}

export interface OfflineOutboxSyncResult {
  synced: number;
  failed: number;
  skipped: number;
}

export interface UseOfflineOutboxReturn {
  enqueueExpense(input: EnqueueOfflineExpenseInput): Promise<OfflineOutboxRecord>;
  pendingCount: Readonly<Ref<number>>;
  syncWhenOnline(): Promise<OfflineOutboxSyncResult>;
  lastSyncError: Readonly<Ref<Error | null>>;
  /** Resolves after the persisted pending count has been loaded. */
  ready: Promise<void>;
  /** Unregisters the online listener; also called automatically by Vue scopes. */
  dispose(): void;
}

function asError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

function browserOnline(): boolean {
  return typeof navigator === "undefined" || navigator.onLine !== false;
}

export function useOfflineOutbox(options: UseOfflineOutboxOptions): UseOfflineOutboxReturn {
  const storage = options.storage ?? createOfflineOutbox();
  const pendingCountState = ref(0);
  const lastSyncErrorState = ref<Error | null>(null);
  const isOnline = options.isOnline ?? browserOnline;
  const staleSyncingMs = options.staleSyncingMs ?? 60_000;
  let activeSync: Promise<OfflineOutboxSyncResult> | null = null;

  async function refreshPendingCount(): Promise<void> {
    pendingCountState.value = (await storage.listPending()).length;
  }

  async function enqueueExpense(input: EnqueueOfflineExpenseInput): Promise<OfflineOutboxRecord> {
    const record = await storage.enqueue(input);
    pendingCountState.value += 1;
    return record;
  }

  async function performSync(): Promise<OfflineOutboxSyncResult> {
    if (!isOnline()) {
      return { synced: 0, failed: 0, skipped: pendingCountState.value };
    }

    lastSyncErrorState.value = null;
    const records = await storage.listPending();
    const result: OfflineOutboxSyncResult = { synced: 0, failed: 0, skipped: 0 };

    for (const record of records) {
      if (!isOnline() || !isOfflineOutboxRecordReady(record, Date.now(), staleSyncingMs)) {
        result.skipped += 1;
        continue;
      }

      const syncingRecord = await storage.markSyncing(record.id);
      if (!syncingRecord) {
        result.skipped += 1;
        continue;
      }

      try {
        // Await each callback before starting the next one: no parallel mutations/uploads.
        await options.createExpense(syncingRecord);
        await storage.markDone(record.id);
        pendingCountState.value = Math.max(0, pendingCountState.value - 1);
        result.synced += 1;
      } catch (error) {
        result.failed += 1;
        lastSyncErrorState.value = asError(error);
        await storage.markFailed(record.id, error);
      }
    }

    await refreshPendingCount();
    return result;
  }

  function syncWhenOnline(): Promise<OfflineOutboxSyncResult> {
    if (activeSync) return activeSync;

    activeSync = performSync()
      .catch((error: unknown) => {
        lastSyncErrorState.value = asError(error);
        throw error;
      })
      .finally(() => {
        activeSync = null;
      });
    return activeSync;
  }

  const handleOnline = (): void => {
    // Event handlers cannot surface rejections; syncWhenOnline records the error.
    void syncWhenOnline().catch(() => {});
  };

  const eventTarget = options.eventTarget === undefined
    ? (typeof window !== "undefined" ? window : null)
    : options.eventTarget;
  const shouldListen = options.autoSync !== false && eventTarget !== null;
  if (shouldListen) eventTarget.addEventListener("online", handleOnline);

  function dispose(): void {
    if (shouldListen) eventTarget.removeEventListener("online", handleOnline);
  }

  if (getCurrentScope()) onScopeDispose(dispose);

  const ready = refreshPendingCount().catch((error: unknown) => {
    lastSyncErrorState.value = asError(error);
  });

  return {
    enqueueExpense,
    pendingCount: readonly(pendingCountState),
    syncWhenOnline,
    lastSyncError: readonly(lastSyncErrorState),
    ready,
    dispose,
  };
}
