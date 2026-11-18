import { beforeEach, describe, it, expect, vi } from "vitest";
import { computed } from "vue";

const mockMarkReadMutate = vi.fn().mockResolvedValue(undefined);
const mockMarkAllReadMutate = vi.fn().mockResolvedValue(undefined);

vi.mock("convex-vue", () => ({
  useConvexQuery: (_ref: { _name: string }) => ({
    data: { value: [] },
    isPending: { value: false },
  }),
  useConvexMutation: (apiFn: { _name: string }) => ({
    mutate: apiFn._name === "markRead" ? mockMarkReadMutate : mockMarkAllReadMutate,
    isPending: { value: false },
    error: { value: null },
  }),
}));

vi.mock("~~/convex/_generated/api", () => ({
  api: {
    functions: {
      notifications: {
        list: { _name: "list" },
        unreadCount: { _name: "unreadCount" },
        markRead: { _name: "markRead" },
        markAllRead: { _name: "markAllRead" },
      },
    },
  },
}));

vi.mock("~~/convex/_generated/dataModel", () => ({
  Doc: {} as never,
  Id: {} as never,
}));

globalThis.computed = computed;

const { useNotifications } = await import("../../app/composables/useNotifications");

describe("useNotifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns notifications ref and unreadCount ref", () => {
    const result = useNotifications();
    expect(result).toHaveProperty("notifications");
    expect(result).toHaveProperty("unreadCount");
    expect(result).toHaveProperty("markRead");
    expect(result).toHaveProperty("markAllRead");
  });

  it("notifications is reactive data with default empty array", () => {
    const { notifications } = useNotifications();
    expect(notifications.data.value).toEqual([]);
  });

  it("unreadCount is reactive data", () => {
    const { unreadCount } = useNotifications();
    expect(unreadCount).toHaveProperty("data");
    expect(unreadCount.data).toHaveProperty("value");
  });

  it("markRead calls mutate with notificationId", async () => {
    const { markRead } = useNotifications();
    await markRead("notif_1");
    expect(mockMarkReadMutate).toHaveBeenCalledWith({ notificationId: "notif_1" });
  });

  it("markAllRead calls mutate with empty object", async () => {
    const { markAllRead } = useNotifications();
    await markAllRead();
    expect(mockMarkAllReadMutate).toHaveBeenCalledWith({});
  });

  it("exposes functions with correct types", () => {
    const { notifications, markRead, markAllRead } = useNotifications();
    expect(typeof notifications.data.value).toBe("object");
    expect(typeof markRead).toBe("function");
    expect(typeof markAllRead).toBe("function");
  });
});