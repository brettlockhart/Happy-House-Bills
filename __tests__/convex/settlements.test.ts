import { describe, it, expect, vi } from "vitest";
import type { UserIdentity } from "convex/server";
import { clerkRequest } from "../../convex/functions/clerk";
import { sendEmail } from "../../convex/functions/email";
import { notifySettlementCreated } from "../../convex/functions/settlements";

vi.mock("../../convex/_generated/server", () => ({
  mutationGeneric: (config: { handler: (ctx: unknown, args: unknown) => Promise<unknown> }) => ({
    ...config,
    handler: config.handler.bind(config),
  }),
  queryGeneric: (config: { handler: (ctx: unknown, args: unknown) => Promise<unknown> }) => ({
    ...config,
    handler: config.handler.bind(config),
  }),
  mutation: (config: { handler: (ctx: unknown, args: unknown) => Promise<unknown> }) => ({
    ...config,
    handler: config.handler.bind(config),
  }),
  query: (config: { handler: (ctx: unknown, args: unknown) => Promise<unknown> }) => ({
    ...config,
    handler: config.handler.bind(config),
  }),
  action: (config: { handler: (ctx: unknown, args: unknown) => Promise<unknown> }) => ({
    ...config,
    handler: config.handler.bind(config),
  }),
  internal: (config: { handler: (ctx: unknown, args: unknown) => Promise<unknown> }) => ({
    ...config,
    handler: config.handler.bind(config),
  }),
}));

vi.mock("../../convex/_generated/api", () => ({
  api: {
    settlements: {
      notifySettlementCreated: {},
    },
  },
  internal: {
    settlements: {
      notifySettlementCreated: {},
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
  },
}));

vi.mock("../../convex/functions/clerk", () => ({
  clerkRequest: vi.fn(),
  CLERK_API_URL: "https://api.clerk.com/v3",
}));

vi.mock("../../convex/functions/email", () => ({
  sendEmail: vi.fn(),
  renderSettlementNotificationEmail: vi.fn((fromName: string, toName: string, amount: number) =>
    `<html><body><h2>Settlement recorded</h2><p>${fromName} paid ${toName} $${amount}</p></body></html>`,
  ),
}));

type MockIdentity = UserIdentity;

interface IndexQueryBuilder {
  field: (name: string) => unknown;
  eq: (field: string, value: unknown) => IndexQueryBuilder;
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
            constraints.every((c) => (doc as Record<string, unknown>)[c.field] === c.value)
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
    order: (_direction: string) => chainable,
    collect: () => filtered,
    first: () => filtered[0] || null,
    unique: () => filtered[0] || null,
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
  };
  scheduler: {
    runAfter: vi.ReturnType<typeof vi.fn>;
  };
  runAction: vi.ReturnType<typeof vi.fn>;
  _patchCalls?: Array<{ id: string; data: Record<string, unknown> }>;
  _insertCalls?: Array<Record<string, unknown>>;
  _settlements?: unknown[];
  _settlementToGet?: unknown;
}

function createMockCtx(
  user: MockIdentity | null,
  options?: {
    settlements?: unknown[];
    settlementToGet?: unknown;
  }
): MockCtx {
  const ctx: MockCtx = {
    auth: {
      getUserIdentity: () => Promise.resolve(user),
    },
    db: {
      query: () => createQueryChain(options?.settlements || []),
      get: () => Promise.resolve(options?.settlementToGet || null),
      patch: (_id: string, _data: Record<string, unknown>) => Promise.resolve(),
      insert: (_table: string, _data: Record<string, unknown>) => Promise.resolve("mock_settlement_id"),
    },
    scheduler: {
      runAfter: vi.fn(),
    },
    runAction: vi.fn(),
    _patchCalls: [],
    _insertCalls: [],
    _settlements: options?.settlements || [],
    _settlementToGet: options?.settlementToGet || null,
  };
  ctx.db.patch = function(_id: string, data: Record<string, unknown>) {
    ctx._patchCalls!.push({ id: _id, data });
    return Promise.resolve();
  };
  ctx.db.insert = function(_table: string, data: Record<string, unknown>) {
    ctx._insertCalls!.push(data);
    return Promise.resolve("mock_settlement_id");
  };
  return ctx;
}

function validIdentity(): MockIdentity {
  return { subject: "user_1", tokenIdentifier: "clerk:org_1|user_1", org_id: "org_1" } as MockIdentity;
}

describe("requireAuthenticatedOrg", () => {
  it("throws when no identity", async () => {
    const { requireAuthenticatedOrg } = await import("../../convex/auth");
    const ctx = createMockCtx(null);
    await expect(requireAuthenticatedOrg(ctx as never)).rejects.toThrow("Unauthenticated");
  });

  it("returns userId and orgId from JWT org_id claim", async () => {
    const { requireAuthenticatedOrg } = await import("../../convex/auth");
    const ctx = createMockCtx(validIdentity());
    const result = await requireAuthenticatedOrg(ctx as never);
    expect(result.userId).toBe("user_1");
    expect(result.orgId).toBe("org_1");
  });

  it("throws when subject present but org_id missing", async () => {
    const { requireAuthenticatedOrg } = await import("../../convex/auth");
    const ctx = createMockCtx({ subject: "user_1" } as MockIdentity);
    await expect(requireAuthenticatedOrg(ctx as never)).rejects.toThrow("Unauthenticated or no organisation");
  });
});

describe("settlements:create", () => {
  it("throws when unauthenticated", async () => {
    const { create } = await import("../../convex/functions/settlements");
    const ctx = createMockCtx(null);
    await expect(
      create.handler(ctx as never, {
        amount: 50,
        fromUser: "user_1",
        toUser: "user_2",
        date: "2024-01-01",
      })
    ).rejects.toThrow("Unauthenticated");
  });

  it("rejects when fromUser != authenticated user", async () => {
    const { create } = await import("../../convex/functions/settlements");
    const ctx = createMockCtx(validIdentity());
    await expect(
      create.handler(ctx as never, {
        amount: 50,
        fromUser: "user_2",
        toUser: "user_1",
        date: "2024-01-01",
      })
    ).rejects.toThrow("Can only record settlement from yourself");
  });

  it("rejects when amount <= 0", async () => {
    const { create } = await import("../../convex/functions/settlements");
    const ctx = createMockCtx(validIdentity());
    await expect(
      create.handler(ctx as never, {
        amount: 0,
        fromUser: "user_1",
        toUser: "user_2",
        date: "2024-01-01",
      })
    ).rejects.toThrow("Settlement amount must be positive");
  });

  it("rejects when amount is negative", async () => {
    const { create } = await import("../../convex/functions/settlements");
    const ctx = createMockCtx(validIdentity());
    await expect(
      create.handler(ctx as never, {
        amount: -50,
        fromUser: "user_1",
        toUser: "user_2",
        date: "2024-01-01",
      })
    ).rejects.toThrow("Settlement amount must be positive");
  });

  it("rejects when fromUser === toUser", async () => {
    const { create } = await import("../../convex/functions/settlements");
    const ctx = createMockCtx(validIdentity());
    await expect(
      create.handler(ctx as never, {
        amount: 50,
        fromUser: "user_1",
        toUser: "user_1",
        date: "2024-01-01",
      })
    ).rejects.toThrow("Cannot record settlement to yourself");
  });

  it("succeeds with valid input and returns { id }", async () => {
    const { create } = await import("../../convex/functions/settlements");
    const ctx = createMockCtx(validIdentity());
    const result = await create.handler(ctx as never, {
      amount: 50,
      fromUser: "user_1",
      toUser: "user_2",
      date: "2024-01-01",
    });
    expect(result).toHaveProperty("id");
    expect(result.id).toBe("mock_settlement_id");
  });

  it("inserts settlement with orgId, createdAt, updatedAt", async () => {
    const { create } = await import("../../convex/functions/settlements");
    const ctx = createMockCtx(validIdentity());
    await create.handler(ctx as never, {
      amount: 100,
      fromUser: "user_1",
      toUser: "user_2",
      date: "2024-01-01",
    });
    expect(ctx._insertCalls).toHaveLength(1);
    const inserted = ctx._insertCalls![0];
    expect(inserted.orgId).toBe("org_1");
    expect(inserted.amount).toBe(100);
    expect(inserted.fromUser).toBe("user_1");
    expect(inserted.toUser).toBe("user_2");
    expect(inserted.date).toBe("2024-01-01");
    expect(typeof inserted.createdAt).toBe("number");
    expect(typeof inserted.updatedAt).toBe("number");
    expect(inserted.deletedAt).toBeUndefined();
  });
});

describe("settlements:list", () => {
  it("throws when unauthenticated", async () => {
    const { list } = await import("../../convex/functions/settlements");
    const ctx = createMockCtx(null);
    await expect(list.handler(ctx as never, {})).rejects.toThrow("Unauthenticated");
  });

  it("returns settlements for authenticated user", async () => {
    const { list } = await import("../../convex/functions/settlements");
    const settlement = { _id: "set1", orgId: "org_1", amount: 50, status: "approved" };
    const ctx = createMockCtx(validIdentity(), { settlements: [settlement] });
    const result = await list.handler(ctx as never, {});
    expect(Array.isArray(result)).toBe(true);
    expect((result as unknown[]).length).toBe(1);
  });

  it("returns settlements ordered by date descending", async () => {
    const { list } = await import("../../convex/functions/settlements");
    const ctx = createMockCtx(validIdentity());
    const result = await list.handler(ctx as never, {});
    expect(Array.isArray(result)).toBe(true);
  });
});

describe("SEC-007: Settlement authz enforcement", () => {
  it("REQUIRES cross-tenant isolation — list returns only org's settlements (SEC-007)", async () => {
    const { list } = await import("../../convex/functions/settlements");
    const otherOrg = { _id: "set2", orgId: "org_other", amount: 999, fromUser: "user_1" };
    const sameOrg = { _id: "set1", orgId: "org_1", amount: 50, fromUser: "user_1" };
    const ctx = createMockCtx(validIdentity(), { settlements: [otherOrg, sameOrg] });
    const result = await list.handler(ctx as never, {}) as unknown[];
    expect(result).toHaveLength(1);
    expect((result[0] as { orgId: string }).orgId).toBe("org_1");
  });

  it("REQUIRES fromUser validation — rejects settlement from non-authenticated user (SEC-008)", async () => {
    const { create } = await import("../../convex/functions/settlements");
    const ctx = createMockCtx(validIdentity());
    await expect(
      create.handler(ctx as never, {
        amount: 50,
        fromUser: "user_2",
        toUser: "user_1",
        date: "2024-01-01",
      })
    ).rejects.toThrow("Can only record settlement from yourself");
  });

  it("REQUIRES positive amount validation — rejects zero amount (SEC-009)", async () => {
    const { create } = await import("../../convex/functions/settlements");
    const ctx = createMockCtx(validIdentity());
    await expect(
      create.handler(ctx as never, {
        amount: 0,
        fromUser: "user_1",
        toUser: "user_2",
        date: "2024-01-01",
      })
    ).rejects.toThrow("Settlement amount must be positive");
  });

  it("REQUIRES soft-delete filtering — excludes deletedAt records from list (SEC-002)", async () => {
    const { list } = await import("../../convex/functions/settlements");
    const active = { _id: "set1", orgId: "org_1", amount: 50, fromUser: "user_1" };
    const deleted = { _id: "set2", orgId: "org_1", amount: 30, fromUser: "user_1", deletedAt: Date.now() };
    const ctx = createMockCtx(validIdentity(), { settlements: [active, deleted] });
    const result = await list.handler(ctx as never, {}) as unknown[];
    expect(result).toHaveLength(1);
    expect((result[0] as { _id: string })._id).toBe("set1");
  });
});

describe("notifySettlementCreated", () => {
  const mockMemberships = {
    data: [
      { user: { id: "user_1", first_name: "Alice", last_name: "Smith", email_addresses: [{ email_address: "alice@example.com" }] } },
      { user: { id: "user_2", first_name: "Bob", last_name: "Jones", email_addresses: [{ email_address: "bob@example.com" }] } },
    ],
  };

  const mockSettlement = {
    _id: "set1",
    orgId: "org_1",
    amount: 25.50,
    fromUser: "user_1",
    toUser: "user_2",
    date: "2024-01-15",
    createdAt: 1234567890,
    updatedAt: 1234567890,
  };

  it("sends settlement notification email successfully", async () => {
    (clerkRequest as ReturnType<typeof vi.fn>).mockResolvedValue(mockMemberships);
    (sendEmail as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "email_123" });

    const ctx = createMockCtx(validIdentity(), { settlementToGet: mockSettlement });
    ctx.db.query = () => {
      const chain = {
        withIndex: () => chain,
        first: () => Promise.resolve({ emailSettings: undefined }),
      };
      return chain as never;
    };

    const result = await notifySettlementCreated.handler(ctx as never, { settlementId: "set1" });
    expect(result).toEqual({ sent: true });
    expect(clerkRequest).toHaveBeenCalledWith("/organizations/org_1/memberships");
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: ["bob@example.com"],
        subject: expect.stringContaining("Settlement recorded"),
        orgId: "org_1",
      }),
      ctx,
    );
  });

  it("returns opted-out when org has settlementNotifications disabled", async () => {
    const ctx = createMockCtx(validIdentity(), { settlementToGet: mockSettlement });
    ctx.db.query = () => {
      const chain = {
        withIndex: () => chain,
        first: () => Promise.resolve({ emailSettings: { settlementNotifications: false } }),
      };
      return chain as never;
    };

    const result = await notifySettlementCreated.handler(ctx as never, { settlementId: "set1" });
    expect(result).toEqual({ sent: false, reason: "User has opted out of settlement notifications" });
    expect(clerkRequest).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("returns no recipient when member not found", async () => {
    (clerkRequest as ReturnType<typeof vi.fn>).mockResolvedValue({ data: [] });

    const ctx = createMockCtx(validIdentity(), { settlementToGet: mockSettlement });
    ctx.db.query = () => {
      const chain = {
        withIndex: () => chain,
        first: () => Promise.resolve({ emailSettings: undefined }),
      };
      return chain as never;
    };

    const result = await notifySettlementCreated.handler(ctx as never, { settlementId: "set1" });
    expect(result).toEqual({ sent: false, reason: "Member not found" });
  });

  it("returns missing email when member has no email", async () => {
    (clerkRequest as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: [
        { user: { id: "user_1", first_name: "Alice", last_name: "Smith", email_addresses: [] } },
        { user: { id: "user_2", first_name: "Bob", last_name: "Jones", email_addresses: [] } },
      ],
    });

    const ctx = createMockCtx(validIdentity(), { settlementToGet: mockSettlement });
    ctx.db.query = () => {
      const chain = {
        withIndex: () => chain,
        first: () => Promise.resolve({ emailSettings: undefined }),
      };
      return chain as never;
    };

    const result = await notifySettlementCreated.handler(ctx as never, { settlementId: "set1" });
    expect(result).toEqual({ sent: false, reason: "Missing email address" });
  });

  it("throws when settlement not found", async () => {
    const ctx = createMockCtx(validIdentity(), { settlementToGet: null });

    await expect(
      notifySettlementCreated.handler(ctx as never, { settlementId: "missing" }),
    ).rejects.toThrow("Settlement not found");
  });
});
