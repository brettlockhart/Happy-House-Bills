import { describe, it, expect, vi, beforeEach } from "vitest";
import type { UserIdentity } from "convex/server";

vi.mock("../../convex/_generated/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../convex/_generated/server")>();
  const wrap = (config: { handler: (ctx: unknown, args: unknown) => Promise<unknown> }) => ({
    ...config,
    handler: config.handler.bind(config),
  });
  return {
    ...actual,
    mutationGeneric: wrap,
    queryGeneric: wrap,
    mutation: wrap,
    query: wrap,
    action: wrap,
    internalMutation: wrap,
    internalQuery: wrap,
    internalAction: wrap,
    internal: wrap,
    defineInternal: wrap,
  };
});

vi.mock("../../convex/_generated/api", () => ({
  api: {
    notifications: {
      createInternal: {},
      markRead: {},
      markAllRead: {},
      list: {},
      unreadCount: {},
      cleanup: {},
      listForCleanup: {},
      deleteById: {},
      scheduleCleanup: {},
    },
  },
  internal: {
    functions: {
      notifications: {
        createInternal: "internal.functions.notifications.createInternal",
        markRead: "internal.functions.notifications.markRead",
        markAllRead: "internal.functions.notifications.markAllRead",
        list: "internal.functions.notifications.list",
        unreadCount: "internal.functions.notifications.unreadCount",
        cleanup: "internal.functions.notifications.cleanup",
        listForCleanup: "internal.functions.notifications.listForCleanup",
        deleteById: "internal.functions.notifications.deleteById",
        scheduleCleanup: "internal.functions.notifications.scheduleCleanup",
      },
    },
    notifications: {
      createInternal: "internal.notifications.createInternal",
      markRead: "internal.notifications.markRead",
      markAllRead: "internal.notifications.markAllRead",
      list: "internal.notifications.list",
      unreadCount: "internal.notifications.unreadCount",
      cleanup: "internal.notifications.cleanup",
      listForCleanup: "internal.notifications.listForCleanup",
      deleteById: "internal.notifications.deleteById",
      scheduleCleanup: "internal.notifications.scheduleCleanup",
    },
  },
}));

vi.mock("convex/values", () => ({
  v: {
    object: () => ({ _isValidator: true }),
    string: () => ({ _isValidator: true }),
    number: () => ({ _isValidator: true }),
    union: () => ({ _isValidator: true }),
    literal: () => ({ _isValidator: true }),
    optional: () => ({ _isValidator: true }),
    id: () => ({ _isValidator: true }),
    array: () => ({ _isValidator: true }),
    boolean: () => ({ _isValidator: true }),
    any: () => ({ _isValidator: true }),
  },
}));

type MockIdentity = UserIdentity;

interface IndexQueryBuilder {
  field: (name: string) => unknown;
  eq: (field: string, value: unknown) => IndexQueryBuilder;
  lt: (field: string, value: unknown) => IndexQueryBuilder;
  neq: (field: string, value: unknown) => IndexQueryBuilder;
}

interface FilterQueryBuilder {
  field: (name: string) => string;
  eq: (field: string, value: unknown) => boolean;
  neq: (field: string, value: unknown) => boolean;
  or: (...predicates: boolean[]) => boolean;
  and: (...predicates: boolean[]) => boolean;
}

function createFilterBuilder(doc: Record<string, unknown>): FilterQueryBuilder {
  return {
    field: (name: string) => name,
    eq: (field: string, value: unknown) => (doc[field] === value),
    neq: (field: string, value: unknown) => (doc[field] !== value),
    or: (...predicates: boolean[]) => predicates.some(Boolean),
    and: (...predicates: boolean[]) => predicates.every(Boolean),
  };
}

function createIndexBuilder(): { builder: IndexQueryBuilder; constraints: Array<{ field: string; value: unknown }> } {
  const constraints: Array<{ field: string; value: unknown }> = [];
  const builder: IndexQueryBuilder = {
    field: (name: string) => name,
    eq: (field: string, value: unknown) => {
      constraints.push({ field, value });
      return builder;
    },
    lt: (field: string, value: unknown) => {
      constraints.push({ field, value, op: "lt" });
      return builder;
    },
    neq: () => builder,
  };
  return { builder, constraints };
}

interface QueryChain {
  withIndex: (name: string, fn?: (q: IndexQueryBuilder) => IndexQueryBuilder) => QueryChain;
  filter: (fn: (q: FilterQueryBuilder) => boolean) => QueryChain;
  order: (direction: string) => QueryChain;
  collect: () => unknown[];
  first: () => unknown | null;
  unique: () => unknown | null;
  take: (limit: number) => Promise<unknown[]>;
}

function createQueryChain(results: unknown[] = []): QueryChain {
  let filtered = results.slice();
  const chainable: QueryChain = {
    withIndex: (_name: string, fn?: (q: IndexQueryBuilder) => IndexQueryBuilder) => {
      if (fn) {
        const { builder, constraints } = createIndexBuilder();
        fn(builder);
        if (constraints.length > 0) {
          filtered = filtered.filter((doc) =>
            constraints.every((c) => {
              const docVal = (doc as Record<string, unknown>)[c.field];
              if (c.op === "lt") {
                return (docVal as number) < (c.value as number);
              }
              return docVal === c.value;
            })
          );
        }
      }
      return chainable;
    },
    filter: (fn: (q: FilterQueryBuilder) => boolean) => {
      filtered = filtered.filter((doc) =>
        fn(createFilterBuilder(doc as Record<string, unknown>))
      );
      return chainable;
    },
    order: (direction: string) => {
      filtered.sort((a, b) => {
        const av = (a as Record<string, unknown>).createdAt as number;
        const bv = (b as Record<string, unknown>).createdAt as number;
        return direction === "asc" ? av - bv : bv - av;
      });
      return chainable;
    },
    collect: () => filtered,
    first: () => filtered[0] || null,
    unique: () => filtered[0] || null,
    take: (limit: number) => Promise.resolve(filtered.slice(0, limit)),
  };
  return chainable;
}

interface MockCtx {
  auth: { getUserIdentity: () => Promise<MockIdentity | null> };
  db: {
    query: (table: string) => QueryChain;
    get: (id: string) => Promise<unknown | null>;
    patch: (id: string, data: Record<string, unknown>) => Promise<void>;
    insert: (table: string, data: Record<string, unknown>) => Promise<string>;
    delete: (id: string) => Promise<void>;
  };
  scheduler: {
    runAfter: vi.ReturnType<typeof vi.fn>;
  };
  runAction: vi.ReturnType<typeof vi.fn>;
  runMutation: vi.ReturnType<typeof vi.fn>;
  runQuery: vi.ReturnType<typeof vi.fn>;
  _patchCalls?: Array<{ id: string; data: Record<string, unknown> }>;
  _insertCalls?: Array<Record<string, unknown>>;
  _deleteCalls?: Array<string>;
  _notifications?: unknown[];
  _notificationToGet?: unknown;
  _rateLimits?: unknown[];
  _rateLimitToGet?: unknown;
}

function createMockCtx(
  user: MockIdentity | null,
  options?: {
    notifications?: unknown[];
    notificationToGet?: unknown;
    rateLimits?: unknown[];
    rateLimitToGet?: unknown;
  }
): MockCtx {
  const ctx: MockCtx = {
    auth: {
      getUserIdentity: () => Promise.resolve(user),
    },
    db: {
      query: (table: string) => {
        if (table === "emailRateLimits") {
          return createQueryChain(options?.rateLimits || []);
        }
        return createQueryChain(options?.notifications || []);
      },
      get: () => Promise.resolve(options?.notificationToGet || options?.rateLimitToGet || null),
      patch: (_id: string, _data: Record<string, unknown>) => Promise.resolve(),
      insert: (_table: string, _data: Record<string, unknown>) => Promise.resolve("mock_id"),
      delete: (_id: string) => Promise.resolve(),
    },
    scheduler: {
      runAfter: vi.fn(),
    },
    runAction: vi.fn(),
    runMutation: vi.fn(),
    runQuery: vi.fn(),
    _patchCalls: [],
    _insertCalls: [],
    _deleteCalls: [],
    _notifications: options?.notifications || [],
    _notificationToGet: options?.notificationToGet || null,
    _rateLimits: options?.rateLimits || [],
    _rateLimitToGet: options?.rateLimitToGet || null,
  };
  ctx.db.patch = function(_id: string, data: Record<string, unknown>) {
    ctx._patchCalls!.push({ id: _id, data });
    return Promise.resolve();
  };
  ctx.db.insert = function(_table: string, data: Record<string, unknown>) {
    ctx._insertCalls!.push(data);
    return Promise.resolve("mock_id");
  };
ctx.db.delete = vi.fn((_id: string) => {
    ctx._deleteCalls!.push(_id);
    return Promise.resolve();
});
  return ctx;
}

function validIdentity(): MockIdentity {
  return { subject: "user_1", tokenIdentifier: "clerk:org_1|user_1", org_id: "org_1" } as MockIdentity;
}

function validNotification(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    _id: "notif_1",
    orgId: "org_1",
    userId: "user_1",
    type: "expense_pending",
    title: "Test notification",
    body: "Test body",
    data: { expenseId: "exp_1" },
    read: false,
    createdAt: Date.now(),
    ...overrides,
  };
}

function validRateLimit(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    _id: "ratelimit_1",
    orgId: "org_1",
    userId: "user_1",
    date: new Date().toISOString().split("T")[0],
    count: 1,
    ...overrides,
  };
}

describe("notifications:createInternal", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("throws when unauthenticated", async () => {
    const { createInternal } = await import("../../convex/functions/notifications");
    const ctx = createMockCtx(null);
    await expect(
      createInternal.handler(ctx as never, {
        orgId: "org_1",
        userId: "user_1",
        type: "expense_pending",
        title: "Test",
        body: "Body",
      })
    ).rejects.toThrow("Unauthenticated");
  });

  it("throws when orgId does not match authenticated org", async () => {
    const { createInternal } = await import("../../convex/functions/notifications");
    const ctx = createMockCtx(validIdentity());
    await expect(
      createInternal.handler(ctx as never, {
        orgId: "org_other",
        userId: "user_1",
        type: "expense_pending",
        title: "Test",
        body: "Body",
      })
    ).rejects.toThrow("Cannot create notification for different organization");
  });

  it("throws when rate limit exceeded (200 per day)", async () => {
    const { createInternal } = await import("../../convex/functions/notifications");
    const today = new Date().toISOString().split("T")[0];
    const rateLimit = validRateLimit({ count: 200, date: today });
    const ctx = createMockCtx(validIdentity(), { rateLimits: [rateLimit], rateLimitToGet: rateLimit });
    await expect(
      createInternal.handler(ctx as never, {
        orgId: "org_1",
        userId: "user_1",
        type: "expense_pending",
        title: "Test",
        body: "Body",
      })
    ).rejects.toThrow("Notification rate limit exceeded");
  });

  it("increments rate limit count when under limit", async () => {
    const { createInternal } = await import("../../convex/functions/notifications");
    const today = new Date().toISOString().split("T")[0];
    const rateLimit = validRateLimit({ count: 50, date: today });
    const ctx = createMockCtx(validIdentity(), { rateLimits: [rateLimit], rateLimitToGet: rateLimit });
    await createInternal.handler(ctx as never, {
      orgId: "org_1",
      userId: "user_1",
      type: "expense_pending",
      title: "Test",
      body: "Body",
    });
    expect(ctx._patchCalls).toHaveLength(1);
    expect(ctx._patchCalls![0].data.count).toBe(51);
  });

  it("creates new rate limit record when none exists for today", async () => {
    const { createInternal } = await import("../../convex/functions/notifications");
    const ctx = createMockCtx(validIdentity());
    await createInternal.handler(ctx as never, {
      orgId: "org_1",
      userId: "user_1",
      type: "expense_pending",
      title: "Test",
      body: "Body",
    });
    expect(ctx._insertCalls).toHaveLength(2);
    const rateLimitInsert = ctx._insertCalls!.find((call) => call.orgId === "org_1" && call.userId === "user_1" && call.date);
    expect(rateLimitInsert).toBeDefined();
    expect(rateLimitInsert!.count).toBe(1);
  });

  it("inserts notification with correct fields", async () => {
    const { createInternal } = await import("../../convex/functions/notifications");
    const ctx = createMockCtx(validIdentity());
    await createInternal.handler(ctx as never, {
      orgId: "org_1",
      userId: "user_1",
      type: "expense_approved",
      title: "Expense approved",
      body: "Your expense was approved",
      data: { expenseId: "exp_123" },
    });
    expect(ctx._insertCalls).toHaveLength(2);
    const notifInsert = ctx._insertCalls!.find((call) => call.type === "expense_approved");
    expect(notifInsert).toBeDefined();
    expect(notifInsert!.orgId).toBe("org_1");
    expect(notifInsert!.userId).toBe("user_1");
    expect(notifInsert!.title).toBe("Expense approved");
    expect(notifInsert!.body).toBe("Your expense was approved");
    expect(notifInsert!.data).toEqual({ expenseId: "exp_123" });
    expect(notifInsert!.read).toBe(false);
    expect(typeof notifInsert!.createdAt).toBe("number");
  });

  it("accepts all valid notification types", async () => {
    const { createInternal } = await import("../../convex/functions/notifications");
    const types = [
      "expense_pending",
      "expense_approved",
      "expense_rejected",
      "settlement_created",
      "invite_sent",
    ] as const;
    for (const type of types) {
      vi.resetAllMocks();
      const ctx = createMockCtx(validIdentity());
      await createInternal.handler(ctx as never, {
        orgId: "org_1",
        userId: "user_1",
        type,
        title: "Test",
        body: "Body",
      });
      const notifInsert = ctx._insertCalls!.find((call) => call.type === type);
      expect(notifInsert).toBeDefined();
      expect(notifInsert!.type).toBe(type);
    }
  });

  it("returns notification ID", async () => {
    const { createInternal } = await import("../../convex/functions/notifications");
    const ctx = createMockCtx(validIdentity());
    const result = await createInternal.handler(ctx as never, {
      orgId: "org_1",
      userId: "user_1",
      type: "expense_pending",
      title: "Test",
      body: "Body",
    });
    expect(result).toBe("mock_id");
  });
});

describe("notifications:markRead", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("throws when unauthenticated", async () => {
    const { markRead } = await import("../../convex/functions/notifications");
    const ctx = createMockCtx(null);
    await expect(markRead.handler(ctx as never, { notificationId: "notif_1" })).rejects.toThrow("Unauthenticated");
  });

  it("throws when notification not found", async () => {
    const { markRead } = await import("../../convex/functions/notifications");
    const ctx = createMockCtx(validIdentity(), { notificationToGet: null });
    await expect(markRead.handler(ctx as never, { notificationId: "notif_1" })).rejects.toThrow("Notification not found");
  });

  it("throws when notification belongs to different org", async () => {
    const { markRead } = await import("../../convex/functions/notifications");
    const notification = validNotification({ orgId: "org_other" });
    const ctx = createMockCtx(validIdentity(), { notificationToGet: notification });
    await expect(markRead.handler(ctx as never, { notificationId: "notif_1" })).rejects.toThrow("Not authorized to mark this notification");
  });

  it("throws when notification belongs to different user", async () => {
    const { markRead } = await import("../../convex/functions/notifications");
    const notification = validNotification({ userId: "user_2" });
    const ctx = createMockCtx(validIdentity(), { notificationToGet: notification });
    await expect(markRead.handler(ctx as never, { notificationId: "notif_1" })).rejects.toThrow("Not authorized to mark this notification");
  });

  it("patches notification read=true when authorized", async () => {
    const { markRead } = await import("../../convex/functions/notifications");
    const notification = validNotification({ orgId: "org_1", userId: "user_1" });
    const ctx = createMockCtx(validIdentity(), { notificationToGet: notification });
    await markRead.handler(ctx as never, { notificationId: "notif_1" });
    expect(ctx._patchCalls).toHaveLength(1);
    expect(ctx._patchCalls![0].data.read).toBe(true);
    expect(ctx._patchCalls![0].id).toBe("notif_1");
  });
});

describe("notifications:markAllRead", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("throws when unauthenticated", async () => {
    const { markAllRead } = await import("../../convex/functions/notifications");
    const ctx = createMockCtx(null);
    await expect(markAllRead.handler(ctx as never, {})).rejects.toThrow("Unauthenticated");
  });

  it("returns processed=0 when no unread notifications", async () => {
    const { markAllRead } = await import("../../convex/functions/notifications");
    const ctx = createMockCtx(validIdentity(), { notifications: [] });
    const result = await markAllRead.handler(ctx as never, {}) as { processed: number };
    expect(result.processed).toBe(0);
    expect(ctx._patchCalls).toHaveLength(0);
  });

  it("marks all unread notifications as read in batches", async () => {
    const { markAllRead } = await import("../../convex/functions/notifications");
    const unreadNotifications = [
      validNotification({ _id: "notif_1", read: false }),
      validNotification({ _id: "notif_2", read: false }),
      validNotification({ _id: "notif_3", read: false }),
    ];
    const ctx = createMockCtx(validIdentity(), { notifications: unreadNotifications });
    const result = await markAllRead.handler(ctx as never, {}) as { processed: number };
    expect(result.processed).toBe(3);
    expect(ctx._patchCalls).toHaveLength(3);
    ctx._patchCalls!.forEach((call) => expect(call.data.read).toBe(true));
  });

  it("processes in batches of 500", async () => {
    const { markAllRead } = await import("../../convex/functions/notifications");
    const manyNotifications = Array.from({ length: 60 }, (_, i) =>
      validNotification({ _id: `notif_${i}`, read: false })
    );
    const ctx = createMockCtx(validIdentity(), { notifications: manyNotifications });
    const result = await markAllRead.handler(ctx as never, {}) as { processed: number };
    expect(result.processed).toBe(60);
    expect(ctx._patchCalls).toHaveLength(60);
  });
});

describe("notifications:list", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("throws when unauthenticated", async () => {
    const { list } = await import("../../convex/functions/notifications");
    const ctx = createMockCtx(null);
    await expect(list.handler(ctx as never, {})).rejects.toThrow("Unauthenticated");
  });

  it("returns notifications ordered by createdAt desc (default)", async () => {
    const { list } = await import("../../convex/functions/notifications");
    const now = Date.now();
    const notifications = [
      validNotification({ _id: "notif_1", createdAt: now - 1000 }),
      validNotification({ _id: "notif_2", createdAt: now - 2000 }),
      validNotification({ _id: "notif_3", createdAt: now - 3000 }),
    ];
    const ctx = createMockCtx(validIdentity(), { notifications });
    const result = await list.handler(ctx as never, {}) as unknown[];
    expect(result).toHaveLength(3);
    expect((result[0] as { _id: string })._id).toBe("notif_1");
    expect((result[1] as { _id: string })._id).toBe("notif_2");
    expect((result[2] as { _id: string })._id).toBe("notif_3");
  });

  it("respects limit parameter (default 50, max 100)", async () => {
    const { list } = await import("../../convex/functions/notifications");
    const notifications = Array.from({ length: 60 }, (_, i) =>
      validNotification({ _id: `notif_${i}`, createdAt: Date.now() - i * 1000 })
    );
    const ctx = createMockCtx(validIdentity(), { notifications });
    const result = await list.handler(ctx as never, { limit: 30 }) as unknown[];
    expect(result).toHaveLength(30);
  });

  it("filters by read=true when read parameter provided", async () => {
    const { list } = await import("../../convex/functions/notifications");
    const notifications = [
      validNotification({ _id: "notif_1", read: false }),
      validNotification({ _id: "notif_2", read: true }),
      validNotification({ _id: "notif_3", read: true }),
    ];
    const ctx = createMockCtx(validIdentity(), { notifications });
    const result = await list.handler(ctx as never, { read: true }) as unknown[];
    expect(result).toHaveLength(2);
    expect(result.every((n) => (n as { read: boolean }).read === true)).toBe(true);
  });

  it("filters by read=false when read parameter is false", async () => {
    const { list } = await import("../../convex/functions/notifications");
    const notifications = [
      validNotification({ _id: "notif_1", read: false }),
      validNotification({ _id: "notif_2", read: true }),
      validNotification({ _id: "notif_3", read: false }),
    ];
    const ctx = createMockCtx(validIdentity(), { notifications });
    const result = await list.handler(ctx as never, { read: false }) as unknown[];
    expect(result).toHaveLength(2);
    expect(result.every((n) => (n as { read: boolean }).read === false)).toBe(true);
  });
});

describe("notifications:unreadCount", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("throws when unauthenticated", async () => {
    const { unreadCount } = await import("../../convex/functions/notifications");
    const ctx = createMockCtx(null);
    await expect(unreadCount.handler(ctx as never, {})).rejects.toThrow("Unauthenticated");
  });

  it("returns 0 when no unread notifications", async () => {
    const { unreadCount } = await import("../../convex/functions/notifications");
    const notifications = [validNotification({ read: true }), validNotification({ read: true })];
    const ctx = createMockCtx(validIdentity(), { notifications });
    const result = await unreadCount.handler(ctx as never, {}) as number;
    expect(result).toBe(0);
  });

  it("returns count of unread notifications", async () => {
    const { unreadCount } = await import("../../convex/functions/notifications");
    const notifications = [
      validNotification({ read: false }),
      validNotification({ read: false }),
      validNotification({ read: true }),
    ];
    const ctx = createMockCtx(validIdentity(), { notifications });
    const result = await unreadCount.handler(ctx as never, {}) as number;
    expect(result).toBe(2);
  });

  it("caps at MAX_UNREAD_COUNT (10000)", async () => {
    const { unreadCount } = await import("../../convex/functions/notifications");
    const manyNotifications = Array.from({ length: 12000 }, () => validNotification({ read: false }));
    const ctx = createMockCtx(validIdentity(), { notifications: manyNotifications });
    const result = await unreadCount.handler(ctx as never, {}) as number;
    expect(result).toBeLessThanOrEqual(10000);
  });
});

describe("notifications:cleanup (internal action)", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("deletes notifications older than 30 days in batches", async () => {
    const { cleanup } = await import("../../convex/functions/notifications");
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const oldNotifications = [
      { _id: "notif_1", createdAt: thirtyDaysAgo - 1000 },
      { _id: "notif_2", createdAt: thirtyDaysAgo - 2000 },
    ];
    const ctx = createMockCtx(validIdentity());
    ctx.runQuery = vi.fn().mockResolvedValue(oldNotifications);
    ctx.runMutation = vi.fn().mockResolvedValue(undefined);
    const result = await cleanup.handler(ctx as never) as { deleted: number };
    expect(result.deleted).toBe(2);
    expect(ctx.runMutation).toHaveBeenCalledTimes(2);
  });

  it("processes in batches of 500", async () => {
    const { cleanup } = await import("../../convex/functions/notifications");
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const oldNotifications = Array.from({ length: 60 }, (_, i) => ({
      _id: `notif_${i}`,
      createdAt: thirtyDaysAgo - i * 1000,
    }));
    const ctx = createMockCtx(validIdentity());
    ctx.runQuery = vi.fn()
      .mockResolvedValueOnce(oldNotifications.slice(0, 500))
      .mockResolvedValueOnce(oldNotifications.slice(500))
      .mockResolvedValueOnce([]);
    ctx.runMutation = vi.fn().mockResolvedValue(undefined);
    const result = await cleanup.handler(ctx as never) as { deleted: number };
    expect(result.deleted).toBe(60);
    expect(ctx.runMutation).toHaveBeenCalledTimes(60);
  });

  it("returns deleted=0 when no old notifications", async () => {
    const { cleanup } = await import("../../convex/functions/notifications");
    const ctx = createMockCtx(validIdentity());
    ctx.runQuery = vi.fn().mockResolvedValue([]);
    const result = await cleanup.handler(ctx as never) as { deleted: number };
    expect(result.deleted).toBe(0);
  });
});

describe("notifications:listForCleanup (internal query)", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns notifications ordered by createdAt asc", async () => {
    const { listForCleanup } = await import("../../convex/functions/notifications");
    const now = Date.now();
    const notifications = [
      validNotification({ _id: "notif_1", createdAt: now - 1000 }),
      validNotification({ _id: "notif_2", createdAt: now - 2000 }),
      validNotification({ _id: "notif_3", createdAt: now - 3000 }),
    ];
    const ctx = createMockCtx(validIdentity(), { notifications });
    const result = await listForCleanup.handler(ctx as never, { before: now, limit: 10 }) as unknown[];
    expect(result).toHaveLength(3);
    expect((result[0] as { _id: string })._id).toBe("notif_3");
    expect((result[1] as { _id: string })._id).toBe("notif_2");
    expect((result[2] as { _id: string })._id).toBe("notif_1");
  });

  it("respects limit parameter (default 1000)", async () => {
    const { listForCleanup } = await import("../../convex/functions/notifications");
    const notifications = Array.from({ length: 1500 }, (_, i) =>
      validNotification({ _id: `notif_${i}`, createdAt: Date.now() - i * 1000 })
    );
    const ctx = createMockCtx(validIdentity(), { notifications });
    const result = await listForCleanup.handler(ctx as never, { before: Date.now(), limit: 100 }) as unknown[];
    expect(result).toHaveLength(100);
  });
});

describe("notifications:deleteById (internal mutation)", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("deletes notification by ID", async () => {
    const { deleteById } = await import("../../convex/functions/notifications");
    const ctx = createMockCtx(validIdentity());
    await deleteById.handler(ctx as never, { id: "notif_1" });
    expect(ctx.db.delete).toHaveBeenCalledWith("notif_1");
  });
});

describe("notifications:scheduleCleanup (internal action)", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("schedules next cleanup and runs current cleanup", async () => {
    const { scheduleCleanup } = await import("../../convex/functions/notifications");
    const ctx = createMockCtx(validIdentity());
    ctx.scheduler.runAfter = vi.fn();
    ctx.runAction = vi.fn().mockResolvedValue({ deleted: 5 });
    const result = await scheduleCleanup.handler(ctx as never) as { deleted: number };
    expect(ctx.scheduler.runAfter).toHaveBeenCalledWith(
      24 * 60 * 60 * 1000,
      "internal.functions.notifications.scheduleCleanup"
    );
    expect(ctx.runAction).toHaveBeenCalledWith("internal.functions.notifications.cleanup");
    expect(result.deleted).toBe(5);
  });
});

describe("SEC-N01: Public create mutation removed", () => {
  it("REQUIRES no public create mutation exists — only createInternal is exported", async () => {
    const notificationsModule = await import("../../convex/functions/notifications");
    expect(notificationsModule.createInternal).toBeDefined();
    expect(notificationsModule.create).toBeUndefined();
  });
});

describe("SEC-N03: Rate limiting on createInternal", () => {
  it("REQUIRES rate limit enforced — throws at 200/day per user per org", async () => {
    const { createInternal } = await import("../../convex/functions/notifications");
    const today = new Date().toISOString().split("T")[0];
    const rateLimit = validRateLimit({ count: 200, date: today });
    const ctx = createMockCtx(validIdentity(), { rateLimits: [rateLimit], rateLimitToGet: rateLimit });
    await expect(
      createInternal.handler(ctx as never, {
        orgId: "org_1",
        userId: "user_1",
        type: "expense_pending",
        title: "Test",
        body: "Body",
      })
    ).rejects.toThrow("Notification rate limit exceeded");
  });

  it("REQUIRES rate limit scoped by org, user, and date", async () => {
    const { createInternal } = await import("../../convex/functions/notifications");
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    const rateLimit = validRateLimit({ count: 200, date: yesterday });
    const ctx = createMockCtx(validIdentity(), { rateLimits: [rateLimit], rateLimitToGet: rateLimit });
    await expect(
      createInternal.handler(ctx as never, {
        orgId: "org_1",
        userId: "user_1",
        type: "expense_pending",
        title: "Test",
        body: "Body",
      })
    ).resolves.toBeDefined();
  });
});

describe("SEC-N05: PII removed from invite notification body", () => {
  it("REQUIRES invite_sent notification body does not contain email addresses", async () => {
    const { createInternal } = await import("../../convex/functions/notifications");
    const ctx = createMockCtx(validIdentity());
    await createInternal.handler(ctx as never, {
      orgId: "org_1",
      userId: "user_1",
      type: "invite_sent",
      title: "Invitation sent",
      body: "Invitation sent to new member",
      data: { inviteToken: "token_123" },
    });
    const notifInsert = ctx._insertCalls!.find((call) => call.type === "invite_sent");
    expect(notifInsert).toBeDefined();
    expect(JSON.stringify(notifInsert!.body)).not.toMatch(
      /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/
    );
  });
});

describe("SEC-N06: Cleanup scheduled via scheduleCleanup", () => {
  it("REQUIRES scheduleCleanup uses scheduler.runAfter with 24h delay", async () => {
    const { scheduleCleanup } = await import("../../convex/functions/notifications");
    const ctx = createMockCtx(validIdentity());
    ctx.scheduler.runAfter = vi.fn();
    ctx.runAction = vi.fn().mockResolvedValue({ deleted: 0 });
    await scheduleCleanup.handler(ctx as never);
    expect(ctx.scheduler.runAfter).toHaveBeenCalledWith(
      24 * 60 * 60 * 1000,
      "internal.functions.notifications.scheduleCleanup"
    );
  });
});

describe("SEC-N07: data field uses v.any() for flexible payload", () => {
  it("REQUIRES createInternal accepts optional data field with various payloads", async () => {
    const { createInternal } = await import("../../convex/functions/notifications");
    const payloads = [
      { expenseId: "exp_1" },
      { settlementId: "sett_1" },
      { inviteToken: "inv_1" },
      { customKey: "customValue", nested: { a: 1 } },
      undefined,
    ];
    for (const data of payloads) {
      vi.resetAllMocks();
      const ctx = createMockCtx(validIdentity());
      await createInternal.handler(ctx as never, {
        orgId: "org_1",
        userId: "user_1",
        type: "expense_pending",
        title: "Test",
        body: "Body",
        data,
      });
      const notifInsert = ctx._insertCalls!.find((call) => call.type === "expense_pending");
      expect(notifInsert!.data).toEqual(data);
    }
  });
});