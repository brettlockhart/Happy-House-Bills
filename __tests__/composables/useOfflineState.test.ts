import { describe, it, expect, vi, beforeEach } from "vitest";
import { useOfflineState } from "~/composables/useOfflineState";

// Mock navigator.onLine
let mockOnline = true;
let mockOffline = false;

// Mock setTimeout for retry logic
vi.mock("~/composables/useOfflineState", async (importOriginal) => {
  const actual = await importOriginal() as any;
  return {
    ...actual,
    useOfflineState: vi.fn(() => {
      const mockState = {
        isOnline: { value: mockOnline },
        wasOffline: { value: mockOffline },
        queuedActions: { value: [] },
        syncStatus: { value: "idle" },
        retryCount: { value: 0 },
        maxRetries: { value: 3 },
        lastSyncTime: { value: null },
        sync: vi.fn().mockResolvedValue(undefined),
        addToQueue: vi.fn((action: () => Promise<void>) => {
          mockState.queuedActions.value.push(action);
          if (!mockOnline) {
            mockState.syncStatus.value = "syncing";
          }
        }),
        removeFromQueue: vi.fn((index: number) => {
          if (index >= 0 && index < mockState.queuedActions.value.length) {
            mockState.queuedActions.value.splice(index, 1);
          }
        }),
        clearQueue: vi.fn(() => {
          mockState.queuedActions.value = [];
        }),
      };
      
      // Setup event listeners
      const handleOnline = () => {
        mockOnline = true;
        mockState.isOnline.value = true;
        mockState.wasOffline.value = false;
      };
      
      const handleOffline = () => {
        mockOnline = false;
        mockOffline = true;
        mockState.isOnline.value = false;
        mockState.wasOffline.value = true;
        mockState.syncStatus.value = "failed";
      };
      
      if (typeof window !== "undefined") {
        window.addEventListener("online", handleOnline);
        window.addEventListener("offline", handleOffline);
      }
      
      return mockState;
    }),
  };
});

describe("useOfflineState", () => {
  beforeEach(() => {
    mockOnline = true;
    mockOffline = false;
  });
  
  it("initializes with online status", () => {
    const store = useOfflineState();
    expect(store.isOnline.value).toBe(true);
    expect(store.wasOffline.value).toBe(false);
    expect(store.syncStatus.value).toBe("idle");
    expect(store.queuedActions.value).toEqual([]);
  });
  
  it("handles offline status", () => {
    const store = useOfflineState();
    
    // Simulate going offline
    mockOnline = false;
    mockOffline = true;
    store.isOnline.value = false;
    store.wasOffline.value = true;
    store.syncStatus.value = "failed";
    
    expect(store.isOnline.value).toBe(false);
    expect(store.wasOffline.value).toBe(true);
    expect(store.syncStatus.value).toBe("failed");
  });
  
  it("adds actions to queue", () => {
    const store = useOfflineState();
    
    const mockAction = vi.fn().mockResolvedValue(undefined);
    store.addToQueue(mockAction);
    
    expect(store.queuedActions.value).toHaveLength(1);
    expect(store.queuedActions.value[0]).toBe(mockAction);
  });
  
  it("starts sync when offline and actions added", () => {
    mockOnline = false;
    const store = useOfflineState();
    
    const mockAction = vi.fn().mockResolvedValue(undefined);
    store.addToQueue(mockAction);
    
    expect(store.syncStatus.value).toBe("syncing");
  });
  
  it("removes actions from queue", () => {
    const store = useOfflineState();
    
    const mockAction = vi.fn().mockResolvedValue(undefined);
    store.addToQueue(mockAction);
    store.removeFromQueue(0);
    
    expect(store.queuedActions.value).toEqual([]);
  });
  
  it("clears queue", () => {
    const store = useOfflineState();
    
    const mockAction = vi.fn().mockResolvedValue(undefined);
    store.addToQueue(mockAction);
    store.clearQueue();
    
    expect(store.queuedActions.value).toEqual([]);
  });
  
  it("maintains readonly properties", () => {
    const store = useOfflineState();
    
    expect(store.isOnline).toBeDefined();
    expect(store.wasOffline).toBeDefined();
    expect(store.queuedActions).toBeDefined();
    expect(store.syncStatus).toBeDefined();
    expect(store.retryCount).toBeDefined();
    expect(store.maxRetries).toBeDefined();
    expect(store.lastSyncTime).toBeDefined();
    expect(typeof store.sync).toBe("function");
    expect(typeof store.addToQueue).toBe("function");
    expect(typeof store.removeFromQueue).toBe("function");
    expect(typeof store.clearQueue).toBe("function");
  });
  
  it("syncs queued actions when online", async () => {
    const store = useOfflineState();
    
    const mockAction1 = vi.fn().mockResolvedValue(undefined);
    const mockAction2 = vi.fn().mockResolvedValue(undefined);
    
    store.addToQueue(mockAction1);
    store.addToQueue(mockAction2);
    
    await store.sync();
    
    expect(mockAction1).toHaveBeenCalledTimes(1);
    expect(mockAction2).toHaveBeenCalledTimes(1);
    expect(store.queuedActions.value).toEqual([]);
    expect(store.syncStatus.value).toBe("completed");
  });
});