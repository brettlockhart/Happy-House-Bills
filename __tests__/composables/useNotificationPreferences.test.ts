import { describe, it, expect, vi, beforeEach } from "vitest";
import { useConvexQuery } from "convex-vue";

vi.mock("convex-vue", () => ({
  useConvexQuery: vi.fn((_api: unknown, _args: unknown) => ({
    data: { value: null },
    isPending: { value: false },
    error: { value: null },
  })),
  useConvexMutation: vi.fn(() => ({
    mutate: vi.fn(),
    isPending: { value: false },
    error: { value: null },
  })),
}));

vi.mock("~~/convex/_generated/api", () => ({
  api: {
    functions: {
      notificationPreferences: {
        get: {},
        update: {},
        reset: {},
      },
    },
  },
}));

describe("useNotificationPreferences", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns default preferences when query is null", async () => {
    const { useNotificationPreferences } = await import("../../app/composables/useNotificationPreferences");
    const result = useNotificationPreferences();

    expect(result.preferences.value.expensePending).toBe(true);
    expect(result.preferences.value.expenseApproved).toBe(true);
    expect(result.preferences.value.expenseRejected).toBe(true);
    expect(result.preferences.value.settlementCreated).toBe(true);
    expect(result.preferences.value.inviteSent).toBe(true);
    expect(result.preferences.value.quietHoursStart).toBe("22:00");
    expect(result.preferences.value.quietHoursEnd).toBe("08:00");
    expect(result.preferences.value.batchWindowMs).toBe(2000);
    expect(result.preferences.value.emailFallback).toBe(true);
  });

  it("returns fetched preferences when query has data", async () => {
    const { useNotificationPreferences } = await import("../../app/composables/useNotificationPreferences");
    vi.mocked(useConvexQuery).mockReturnValueOnce({
      data: {
        value: {
          _id: "pref_1",
          _creationTime: 100,
          orgId: "org_1",
          userId: "user_1",
          expensePending: false,
          expenseApproved: true,
          expenseRejected: true,
          settlementCreated: true,
          inviteSent: true,
          quietHoursStart: "22:00",
          quietHoursEnd: "08:00",
          batchWindowMs: 2000,
          emailFallback: true,
          updatedAt: 100,
        },
      },
      isPending: { value: false },
      error: { value: null },
    } as never);

    const result = useNotificationPreferences();

    expect(result.preferences.value.expensePending).toBe(false);
  });

  it("returns loading state correctly", async () => {
    const { useNotificationPreferences } = await import("../../app/composables/useNotificationPreferences");
    const result = useNotificationPreferences();

    expect(result.isLoading).toBeDefined();
  });

  it("defaults to true for typeEnabled when preference is undefined", async () => {
    const { useNotificationPreferences } = await import("../../app/composables/useNotificationPreferences");
    const result = useNotificationPreferences();

    const preferences = result.preferences.value;
    expect(preferences.expensePending !== false).toBe(true);
  });
});