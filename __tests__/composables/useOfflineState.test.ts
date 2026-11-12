import { describe, it, expect, beforeEach, vi } from "vitest";

let mockOnline = true;
let mockWidth = 375;
let mockHeight = 667;

vi.stubGlobal('navigator', {
  ...globalThis.navigator,
  onLine: mockOnline,
});

vi.mock("~/utils/mobile-utils", async (importOriginal) => {
  const actual = await importOriginal() as unknown;
  return {
    ...actual,
    getViewportConfig: async () => ({
      breakpoint: mockWidth < 640 ? "xs" :
                  mockWidth < 768 ? "sm" :
                  mockWidth < 1024 ? "md" :
                  mockWidth < 1280 ? "lg" : "xl",
      isMobile: mockWidth < 768,
      isTablet: mockWidth >= 768 && mockWidth < 1024,
      isDesktop: mockWidth >= 1024,
      orientation: mockHeight > mockWidth ? "portrait" : "landscape",
      width: mockWidth,
      height: mockHeight,
    }),
  };
});

const { useOfflineState } = await import("~/composables/useOfflineState");

describe("useOfflineState", () => {
  beforeEach(() => {
    mockOnline = true;
    mockWidth = 375;
    mockHeight = 667;
  });

  it("initializes with online status", () => {
    const store = useOfflineState();
    expect(store.isOnline.value).toBe(true);
    expect(store.wasOffline.value).toBe(false);
    expect(store.syncStatus.value).toBe("idle");
    expect(store.queuedActions.value).toEqual([]);
  });

  it("adds actions to queue", () => {
    const store = useOfflineState();

    const mockAction = vi.fn().mockResolvedValue(undefined);
    store.addToQueue(mockAction);

    expect(store.queuedActions.value).toHaveLength(1);
    expect(store.queuedActions.value[0]).toBe(mockAction);
  });

  it("clears queue", () => {
    const store = useOfflineState();

    const mockAction = vi.fn().mockResolvedValue(undefined);
    store.addToQueue(mockAction);
    store.clearQueue();

    expect(store.queuedActions.value).toEqual([]);
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

  it("syncs queued actions when already online", async () => {
    const store = useOfflineState();

    const mockAction = vi.fn().mockResolvedValue(undefined);
    store.addToQueue(mockAction);

    await store.sync();

    expect(mockAction).toHaveBeenCalledTimes(1);
    expect(store.queuedActions.value).toEqual([]);
    expect(store.syncStatus.value).toBe("completed");
  });
});