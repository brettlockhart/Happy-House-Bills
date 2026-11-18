export type OfflineOutboxStatus = "pending" | "syncing" | "failed";

export interface OfflineBase64ReceiptFrame {
  /** Base64 payload without a data-URL prefix. */
  data: string;
  encoding: "base64";
  mimeType?: string;
  fileName?: string;
}

export interface OfflineBinaryReceiptFrame {
  data: Blob | ArrayBuffer | Uint8Array;
  mimeType?: string;
  fileName?: string;
}

/** Binary data is structured-cloned; strings are explicitly marked as base64. */
export type OfflineReceiptFrame =
  | Blob
  | ArrayBuffer
  | Uint8Array
  | OfflineBinaryReceiptFrame
  | OfflineBase64ReceiptFrame;

export type OfflineExpensePayload = Record<string, unknown>;

export interface OfflineOutboxRecord {
  id: string;
  /** Stable across retries so the createExpense integration can deduplicate writes. */
  clientRequestId: string;
  orgId: string;
  userId: string;
  expense: OfflineExpensePayload;
  receiptFrames: OfflineReceiptFrame[];
  /** Epoch milliseconds. */
  createdAt: number;
  /** Epoch milliseconds. */
  updatedAt: number;
  retryCount: number;
  status: OfflineOutboxStatus;
  /** Epoch milliseconds; failed records are not due before this time. */
  nextAttemptAt: number;
  lastError?: string;
}

export interface EnqueueOfflineExpenseInput {
  id?: string;
  clientRequestId?: string;
  orgId: string;
  userId: string;
  expense: OfflineExpensePayload;
  receiptFrames?: OfflineReceiptFrame[];
  createdAt?: number;
}

export interface OfflineRetryBackoffOptions {
  baseDelayMs?: number;
  maxDelayMs?: number;
}

export interface OfflineOutboxOptions extends OfflineRetryBackoffOptions {
  databaseName?: string;
  /** Pass null to force the memory store, or provide an IDBFactory in tests. */
  indexedDB?: IDBFactory | null;
  /** Deterministic hooks, primarily for tests. */
  now?: () => number;
  createId?: () => string;
}

export interface OfflineOutboxStorage {
  enqueue(input: EnqueueOfflineExpenseInput): Promise<OfflineOutboxRecord>;
  /** Returns every unfinished record, including syncing and backoff-waiting records. */
  listPending(): Promise<OfflineOutboxRecord[]>;
  markSyncing(id: string): Promise<OfflineOutboxRecord | null>;
  /** Deletes the record and its receipt data. */
  markDone(id: string): Promise<void>;
  markFailed(id: string, error: unknown): Promise<OfflineOutboxRecord | null>;
  /** Makes a failed record immediately eligible while retaining its retryCount. */
  retry(id: string): Promise<OfflineOutboxRecord | null>;
  clear(): Promise<void>;
}

interface ResolvedOutboxOptions {
  now: () => number;
  createId: () => string;
  baseDelayMs: number;
  maxDelayMs: number;
}

const DATABASE_NAME = "happy-house-bills-offline-outbox";
const DATABASE_VERSION = 1;
const OBJECT_STORE = "expenses";

function defaultCreateId(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  return `outbox-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function resolveOptions(options: OfflineOutboxOptions): ResolvedOutboxOptions {
  return {
    now: options.now ?? Date.now,
    createId: options.createId ?? defaultCreateId,
    baseDelayMs: Math.max(0, options.baseDelayMs ?? 1_000),
    maxDelayMs: Math.max(0, options.maxDelayMs ?? 30_000),
  };
}

function createRecord(
  input: EnqueueOfflineExpenseInput,
  options: ResolvedOutboxOptions,
): OfflineOutboxRecord {
  const id = input.id ?? input.clientRequestId ?? options.createId();
  const createdAt = input.createdAt ?? options.now();
  return {
    id,
    clientRequestId: input.clientRequestId ?? id,
    orgId: input.orgId,
    userId: input.userId,
    expense: input.expense,
    receiptFrames: input.receiptFrames ?? [],
    createdAt,
    updatedAt: createdAt,
    retryCount: 0,
    status: "pending",
    nextAttemptAt: createdAt,
  };
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  try {
    return JSON.stringify(error) || String(error);
  } catch {
    return String(error);
  }
}

async function serializeFrame(frame: OfflineReceiptFrame): Promise<string> {
  // Direct frame types (Blob, ArrayBuffer, Uint8Array) come first
  if (frame instanceof Blob) {
    const arrayBuffer = await frame.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    const base64 = btoa(
      bytes.reduce(
        (str, byte) => str + String.fromCharCode(byte),
        "",
      ),
    );
    return `blob:${frame.type || ""}:${base64}`;
  }
  if (frame instanceof ArrayBuffer) {
    const bytes = new Uint8Array(frame);
    const base64 = btoa(
      bytes.reduce(
        (str, byte) => str + String.fromCharCode(byte),
        "",
      ),
    );
    return `ab:${base64}`;
  }
  if (frame instanceof Uint8Array) {
    const base64 = btoa(
      frame.reduce(
        (str, byte) => str + String.fromCharCode(byte),
        "",
      ),
    );
    return `u8:${base64}`;
  }

  // Wrapper types
  const binaryFrame = frame as OfflineBinaryReceiptFrame;
  if (binaryFrame && "data" in binaryFrame && binaryFrame.data) {
    const data = binaryFrame.data;
    if (data instanceof Blob) {
      const arrayBuffer = await data.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      const base64 = btoa(
        bytes.reduce(
          (str, byte) => str + String.fromCharCode(byte),
          "",
        ),
      );
      return `bin:${base64}`;
    }
    if (data instanceof ArrayBuffer) {
      const bytes = new Uint8Array(data);
      const base64 = btoa(
        bytes.reduce(
          (str, byte) => str + String.fromCharCode(byte),
          "",
        ),
      );
      return `ab:${base64}`;
    }
    if (data instanceof Uint8Array) {
      const base64 = btoa(
        data.reduce(
          (str, byte) => str + String.fromCharCode(byte),
          "",
        ),
      );
      return `u8:${base64}`;
    }
  }

  const base64Frame = frame as OfflineBase64ReceiptFrame;
  if (base64Frame && typeof base64Frame.data === "string" && base64Frame.encoding === "base64") {
    return `b64f:${base64Frame.data}:${base64Frame.mimeType ?? ""}:${base64Frame.fileName ?? ""}`;
  }

  return JSON.stringify(frame);
}

/** Deserialize a receipt frame from a serialized string. Non-strings returned as-is. */
export function deserializeReceiptFrame(serialized: unknown): OfflineReceiptFrame {
  if (typeof serialized !== "string") {
    return serialized as unknown as OfflineReceiptFrame;
  }
  if (serialized.startsWith("blob:")) {
    const colonIdx = serialized.indexOf(":", 5);
    const type = serialized.slice(5, colonIdx || serialized.length);
    const base64 = serialized.slice(colonIdx + 1);
    const binary = atob(base64);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new Blob([bytes], { type });
  }
  if (serialized.startsWith("ab:")) {
    const base64 = serialized.slice(3);
    const binary = atob(base64);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }
  if (serialized.startsWith("u8:")) {
    const base64 = serialized.slice(3);
    const binary = atob(base64);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }
  if (serialized.startsWith("b64f:")) {
    const parts = serialized.slice(5).split(":");
    const data = parts[0];
    const mimeType = parts[1] || undefined;
    const fileName = parts[2] || undefined;
    return { data, encoding: "base64" as const, mimeType, fileName };
  }
  return JSON.parse(serialized as string);
}

/** retryCount is the count after the failure: 1 => base delay, 2 => 2x, etc. */
export function getOfflineOutboxRetryDelay(
  retryCount: number,
  options: OfflineRetryBackoffOptions = {},
): number {
  const baseDelayMs = Math.max(0, options.baseDelayMs ?? 1_000);
  const maxDelayMs = Math.max(0, options.maxDelayMs ?? 30_000);
  const exponent = Math.min(30, Math.max(0, Math.floor(retryCount) - 1));
  return Math.min(maxDelayMs, baseDelayMs * 2 ** exponent);
}

function failedRecord(
  record: OfflineOutboxRecord,
  error: unknown,
  options: ResolvedOutboxOptions,
): OfflineOutboxRecord {
  const retryCount = record.retryCount + 1;
  const delayMs = getOfflineOutboxRetryDelay(retryCount, options);
  const updatedAt = options.now();
  return {
    ...record,
    status: "failed",
    retryCount,
    updatedAt,
    nextAttemptAt: updatedAt + delayMs,
    lastError: errorMessage(error),
  };
}

/**
 * A syncing record becomes eligible again after staleSyncingMs, recovering work
 * left behind by a reload or crashed tab. Other records respect nextAttemptAt.
 */
export function isOfflineOutboxRecordReady(
  record: OfflineOutboxRecord,
  now = Date.now(),
  staleSyncingMs = 60_000,
): boolean {
  if (record.nextAttemptAt > now) return false;
  if (record.status !== "syncing") return true;
  return record.updatedAt + Math.max(0, staleSyncingMs) <= now;
}

function compareRecords(a: OfflineOutboxRecord, b: OfflineOutboxRecord): number {
  return a.createdAt - b.createdAt || a.id.localeCompare(b.id);
}

function cloneForMemory<T>(value: T): T {
  // Do not JSON-serialize: receipt Blobs and buffers must retain their bytes.
  return typeof globalThis.structuredClone === "function"
    ? globalThis.structuredClone(value)
    : value;
}

class InMemoryOfflineOutbox implements OfflineOutboxStorage {
  private readonly records = new Map<string, OfflineOutboxRecord>();

  constructor(private readonly options: ResolvedOutboxOptions) {}

  async enqueue(input: EnqueueOfflineExpenseInput): Promise<OfflineOutboxRecord> {
    const record = createRecord(input, this.options);
    if (this.records.has(record.id)) {
      throw new Error(`Offline outbox record already exists: ${record.id}`);
    }
    const serializedFrames: string[] = await Promise.all(
      (record.receiptFrames || []).map(serializeFrame)
    );
    const storedRecord: OfflineOutboxRecord = {
      ...record,
      receiptFrames: serializedFrames as unknown as OfflineReceiptFrame[],
    };
    this.records.set(record.id, cloneForMemory(storedRecord));
    const deserializedFrames: OfflineReceiptFrame[] = await Promise.all(
      serializedFrames.map(deserializeReceiptFrame)
    );
    return {
      ...record,
      receiptFrames: deserializedFrames,
    };
  }

  async listPending(): Promise<OfflineOutboxRecord[]> {
    return [...this.records.values()]
      .sort(compareRecords)
      .map((record) => {
        const deserializedFrames: OfflineReceiptFrame[] = Array.isArray(record.receiptFrames)
          ? record.receiptFrames.map(deserializeReceiptFrame)
          : [];
        return cloneForMemory({
          ...record,
          receiptFrames: deserializedFrames,
        });
      });
  }

  private update(
    id: string,
    updater: (record: OfflineOutboxRecord) => OfflineOutboxRecord,
  ): OfflineOutboxRecord | null {
    const existing = this.records.get(id);
    if (!existing) return null;
    const updated = updater(cloneForMemory(existing));
    this.records.set(id, cloneForMemory(updated));
    return cloneForMemory(updated);
  }

  async markSyncing(id: string): Promise<OfflineOutboxRecord | null> {
    return this.update(id, (record) => ({
      ...record,
      status: "syncing",
      updatedAt: this.options.now(),
    }));
  }

  async markDone(id: string): Promise<void> {
    this.records.delete(id);
  }

  async markFailed(id: string, error: unknown): Promise<OfflineOutboxRecord | null> {
    return this.update(id, (record) => failedRecord(record, error, this.options));
  }

  async retry(id: string): Promise<OfflineOutboxRecord | null> {
    const now = this.options.now();
    return this.update(id, (record) => ({
      ...record,
      status: "pending",
      updatedAt: now,
      nextAttemptAt: now,
    }));
  }

  async clear(): Promise<void> {
    this.records.clear();
  }
}

function openDatabase(indexedDB: IDBFactory, databaseName: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(OBJECT_STORE)) {
        database.createObjectStore(OBJECT_STORE, { keyPath: "id" });
      }
    };
    request.onsuccess = () => {
      const database = request.result;
      database.onversionchange = () => database.close();
      resolve(database);
    };
    request.onerror = () => reject(request.error ?? new Error("Unable to open offline outbox"));
  });
}

function readRequest<T>(database: IDBDatabase, operation: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(OBJECT_STORE, "readonly");
    const request = operation(transaction.objectStore(OBJECT_STORE));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Offline outbox read failed"));
  });
}

function writeRequest<T>(
  database: IDBDatabase,
  operation: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return new Promise((resolve, reject) => {
    let result: T;
    const transaction = database.transaction(OBJECT_STORE, "readwrite");
    transaction.oncomplete = () => resolve(result);
    transaction.onerror = () => reject(transaction.error ?? new Error("Offline outbox write failed"));
    transaction.onabort = () => reject(transaction.error ?? new Error("Offline outbox write aborted"));
    const request = operation(transaction.objectStore(OBJECT_STORE));
    request.onsuccess = () => {
      result = request.result;
    };
    request.onerror = () => reject(request.error ?? new Error("Offline outbox write failed"));
  });
}

function updateRecord(
  database: IDBDatabase,
  id: string,
  updater: (record: OfflineOutboxRecord) => OfflineOutboxRecord,
): Promise<OfflineOutboxRecord | null> {
  return new Promise((resolve, reject) => {
    let updated: OfflineOutboxRecord | null = null;
    const transaction = database.transaction(OBJECT_STORE, "readwrite");
    const store = transaction.objectStore(OBJECT_STORE);
    transaction.oncomplete = () => resolve(updated);
    transaction.onerror = () => reject(transaction.error ?? new Error("Offline outbox update failed"));
    transaction.onabort = () => reject(transaction.error ?? new Error("Offline outbox update aborted"));
    const request = store.get(id);
    request.onsuccess = () => {
      const existing = request.result as OfflineOutboxRecord | undefined;
      if (!existing) return;
      try {
        updated = updater(existing);
        store.put(updated);
      } catch (error) {
        transaction.abort();
        reject(error);
      }
    };
    request.onerror = () => reject(request.error ?? new Error("Offline outbox update failed"));
  });
}

class IndexedDBOfflineOutbox implements OfflineOutboxStorage {
  private databasePromise: Promise<IDBDatabase> | undefined;
  private useFallback = false;
  private readonly fallback: InMemoryOfflineOutbox;

  constructor(
    private readonly indexedDB: IDBFactory,
    private readonly databaseName: string,
    private readonly options: ResolvedOutboxOptions,
  ) {
    this.fallback = new InMemoryOfflineOutbox(options);
  }

  private async database(): Promise<IDBDatabase | null> {
    if (this.useFallback) return null;
    try {
      this.databasePromise ??= openDatabase(this.indexedDB, this.databaseName);
      return await this.databasePromise;
    } catch {
      // Privacy modes and denied storage access must not break offline capture.
      this.useFallback = true;
      this.databasePromise = undefined;
      return null;
    }
  }

  async enqueue(input: EnqueueOfflineExpenseInput): Promise<OfflineOutboxRecord> {
    const database = await this.database();
    if (!database) return this.fallback.enqueue(input);
    const record = createRecord(input, this.options);
    const serializedFrames: string[] = await Promise.all(
      (record.receiptFrames || []).map(serializeFrame)
    );
    const storedRecord: OfflineOutboxRecord = {
      ...record,
      receiptFrames: serializedFrames as unknown as OfflineReceiptFrame[],
    };
    await writeRequest(database, (store) => store.add(storedRecord));
    const deserializedFrames: OfflineReceiptFrame[] = await Promise.all(
      serializedFrames.map(deserializeReceiptFrame)
    );
    return {
      ...record,
      receiptFrames: deserializedFrames,
    };
  }

  async listPending(): Promise<OfflineOutboxRecord[]> {
    const database = await this.database();
    if (!database) return this.fallback.listPending();
    const records = await readRequest(database, (store) => store.getAll());
    return (records as OfflineOutboxRecord[])
      .map((record) => ({
        ...record,
        receiptFrames: Array.isArray(record.receiptFrames)
          ? record.receiptFrames.map(deserializeReceiptFrame)
          : [],
      }))
      .sort(compareRecords);
  }

  async markSyncing(id: string): Promise<OfflineOutboxRecord | null> {
    const database = await this.database();
    if (!database) return this.fallback.markSyncing(id);
    return updateRecord(database, id, (record) => ({
      ...record,
      status: "syncing",
      updatedAt: this.options.now(),
    }));
  }

  async markDone(id: string): Promise<void> {
    const database = await this.database();
    if (!database) return this.fallback.markDone(id);
    await writeRequest(database, (store) => store.delete(id));
  }

  async markFailed(id: string, error: unknown): Promise<OfflineOutboxRecord | null> {
    const database = await this.database();
    if (!database) return this.fallback.markFailed(id, error);
    return updateRecord(database, id, (record) => failedRecord(record, error, this.options));
  }

  async retry(id: string): Promise<OfflineOutboxRecord | null> {
    const database = await this.database();
    if (!database) return this.fallback.retry(id);
    const now = this.options.now();
    return updateRecord(database, id, (record) => ({
      ...record,
      status: "pending",
      updatedAt: now,
      nextAttemptAt: now,
    }));
  }

  async clear(): Promise<void> {
    const database = await this.database();
    if (!database) return this.fallback.clear();
    await writeRequest(database, (store) => store.clear());
  }
}

/**
 * Creates an IndexedDB-backed store in browsers. SSR, tests, and browsers where
 * IndexedDB cannot be opened use an isolated in-memory store for that instance.
 */
export function createOfflineOutbox(options: OfflineOutboxOptions = {}): OfflineOutboxStorage {
  const resolved = resolveOptions(options);
  const indexedDB = options.indexedDB === undefined ? globalThis.indexedDB : options.indexedDB;
  if (!indexedDB) return new InMemoryOfflineOutbox(resolved);
  return new IndexedDBOfflineOutbox(indexedDB, options.databaseName ?? DATABASE_NAME, resolved);
}
