import { describe, it, expect, vi, beforeEach } from "vitest";

const { requireAuthenticatedUser } = vi.hoisted(() => ({
  requireAuthenticatedUser: vi.fn(),
}));

vi.mock("../../convex/_generated/server", () => ({
  query: (config: { handler: (ctx: unknown, args: unknown) => Promise<unknown> }) => ({
    ...config,
    handler: config.handler.bind(config),
  }),
}));

vi.mock("../../convex/auth", () => ({
  requireAuthenticatedUser,
}));

interface QueryChain {
  withIndex: (name: string, fn?: unknown) => QueryChain;
  filter: (fn: unknown) => QueryChain;
  collect: () => Promise<unknown[]>;
}

function createQueryChain(results: unknown[] = []): QueryChain {
  const filtered = results.slice();
  const chainable: QueryChain = {
    withIndex: () => chainable,
    filter: () => chainable,
    collect: () => Promise.resolve(filtered),
  };
  return chainable;
}

interface MockCtx {
  auth: { getUserIdentity: () => Promise<unknown> };
  db: { query: (table: string) => QueryChain };
}

function makeCtx(options?: {
  userId?: string;
  memberships?: unknown[];
}): MockCtx {
  const userId = options?.userId || "user_1";
  const memberships = options?.memberships || [];
  return {
    auth: { getUserIdentity: () => Promise.resolve({ subject: userId }) },
    db: { query: () => createQueryChain(memberships) },
  };
}

describe("groups:listMine", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("throws when unauthenticated", async () => {
    requireAuthenticatedUser.mockRejectedValue(new Error("Unauthenticated"));

    const { listMine } = await import("../../convex/functions/groups");
    const ctx = makeCtx({ memberships: [] });
    await expect(listMine.handler(ctx as never, {})).rejects.toThrow("Unauthenticated");
  });

  it("returns empty array when no memberships", async () => {
    requireAuthenticatedUser.mockResolvedValue({ subject: "user_1" });

    const { listMine } = await import("../../convex/functions/groups");
    const ctx = makeCtx({ memberships: [] });
    const result = await listMine.handler(ctx as never, {});

    expect(result).toEqual([]);
  });

  it("returns only active memberships without deletedAt", async () => {
    requireAuthenticatedUser.mockResolvedValue({ subject: "user_1" });

    const memberships = [
      { orgId: "org_1", userId: "user_1", role: "admin", status: "active", deletedAt: undefined },
      { orgId: "org_2", userId: "user_1", role: "member", status: "suspended", deletedAt: undefined },
      { orgId: "org_3", userId: "user_1", role: "admin", status: "active", deletedAt: Date.now() },
      { orgId: "org_4", userId: "user_1", role: "member", status: "pending", deletedAt: undefined },
      { orgId: undefined, userId: "user_1", role: "admin", status: "active", deletedAt: undefined },
    ];

    const { listMine } = await import("../../convex/functions/groups");
    const ctx = makeCtx({ userId: "user_1", memberships });
    const result = await listMine.handler(ctx as never, {});

    expect(result).toEqual([
      { orgId: "org_1", role: "admin", status: "active" },
    ]);
  });

  it("deduplicates groups by orgId, returning first membership only", async () => {
    requireAuthenticatedUser.mockResolvedValue({ subject: "user_1" });

    const memberships = [
      { orgId: "org_1", userId: "user_1", role: "member", status: "active", deletedAt: undefined },
      { orgId: "org_1", userId: "user_1", role: "admin", status: "active", deletedAt: undefined },
      { orgId: "org_2", userId: "user_1", role: "admin", status: "active", deletedAt: undefined },
    ];

    const { listMine } = await import("../../convex/functions/groups");
    const ctx = makeCtx({ userId: "user_1", memberships });
    const result = await listMine.handler(ctx as never, {});

    expect(result).toEqual([
      { orgId: "org_1", role: "member", status: "active" },
      { orgId: "org_2", role: "admin", status: "active" },
    ]);
  });

  it("skips memberships without orgId", async () => {
    requireAuthenticatedUser.mockResolvedValue({ subject: "user_1" });

    const memberships = [
      { orgId: undefined, userId: "user_1", role: "admin", status: "active", deletedAt: undefined },
      { orgId: null, userId: "user_1", role: "member", status: "active", deletedAt: undefined },
      { orgId: "org_1", userId: "user_1", role: "admin", status: "active", deletedAt: undefined },
    ];

    const { listMine } = await import("../../convex/functions/groups");
    const ctx = makeCtx({ userId: "user_1", memberships });
    const result = await listMine.handler(ctx as never, {});

    expect(result).toEqual([
      { orgId: "org_1", role: "admin", status: "active" },
    ]);
  });

  it("skips inactive memberships", async () => {
    requireAuthenticatedUser.mockResolvedValue({ subject: "user_1" });

    const memberships = [
      { orgId: "org_1", userId: "user_1", role: "admin", status: "active", deletedAt: undefined },
      { orgId: "org_2", userId: "user_1", role: "admin", status: "pending", deletedAt: undefined },
      { orgId: "org_3", userId: "user_1", role: "member", status: "suspended", deletedAt: undefined },
    ];

    const { listMine } = await import("../../convex/functions/groups");
    const ctx = makeCtx({ userId: "user_1", memberships });
    const result = await listMine.handler(ctx as never, {});

    expect(result).toEqual([
      { orgId: "org_1", role: "admin", status: "active" },
    ]);
  });
});