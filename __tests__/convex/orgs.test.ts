import { describe, it, expect, vi, beforeEach } from "vitest";

const { requireAuthenticatedUser, requireAuthenticatedOrg } = vi.hoisted(() => ({
  requireAuthenticatedUser: vi.fn(),
  requireAuthenticatedOrg: vi.fn(),
}));

vi.mock("../../convex/_generated/server", () => ({
  action: (config: { handler: (ctx: unknown, args: unknown) => Promise<unknown> }) => ({
    ...config,
    handler: config.handler.bind(config),
  }),
  query: (config: { handler: (ctx: unknown, args: unknown) => Promise<unknown> }) => ({
    ...config,
    handler: config.handler.bind(config),
  }),
  mutation: (config: { handler: (ctx: unknown, args: unknown) => Promise<unknown> }) => ({
    ...config,
    handler: config.handler.bind(config),
  }),
  internalAction: (config: { handler: (ctx: unknown, args: unknown) => Promise<unknown> }) => ({
    ...config,
    handler: config.handler.bind(config),
  }),
  internalMutation: (config: { handler: (ctx: unknown, args: unknown) => Promise<unknown> }) => ({
    ...config,
    handler: config.handler.bind(config),
  }),
  internalQuery: (config: { handler: (ctx: unknown, args: unknown) => Promise<unknown> }) => ({
    ...config,
    handler: config.handler.bind(config),
  }),
  internal: (config: { handler: (ctx: unknown, args: unknown) => Promise<unknown> }) => ({
    ...config,
    handler: config.handler.bind(config),
  }),
}));

vi.mock("convex/values", () => ({
  v: {
    object: () => ({ _isValidator: true }),
    string: () => ({ _isValidator: true }),
    number: () => ({ _isValidator: true }),
    union: () => ({ _isValidator: true }),
    literal: () => ({ _isValidator: true }),
    boolean: () => ({ _isValidator: true }),
    optional: () => ({ _isValidator: true }),
    id: () => ({ _isValidator: true }),
    array: () => ({ _isValidator: true }),
  },
}));

vi.mock("../../convex/auth", () => ({
  requireAuthenticatedUser,
  requireAuthenticatedOrg,
}));

const mockFetch = vi.fn();
global.fetch = mockFetch as unknown as typeof fetch;

function makeCtx() {
  const mockQuery = vi.fn().mockReturnValue({
    withIndex: vi.fn().mockReturnValue({
      first: vi.fn().mockResolvedValue(null),
      filter: vi.fn().mockReturnValue({
        order: vi.fn().mockReturnValue({
          collect: vi.fn().mockResolvedValue([]),
        }),
        collect: vi.fn().mockResolvedValue([]),
      }),
    }),
    filter: vi.fn().mockReturnValue({
      order: vi.fn().mockReturnValue({
        collect: vi.fn().mockResolvedValue([]),
      }),
      collect: vi.fn().mockResolvedValue([]),
    }),
    order: vi.fn().mockReturnValue({
      collect: vi.fn().mockResolvedValue([]),
    }),
    take: vi.fn().mockReturnValue({
      collect: vi.fn().mockResolvedValue([]),
    }),
    collect: vi.fn().mockResolvedValue([]),
  });

  return {
    auth: { getUserIdentity: async () => null },
    db: {
      insert: vi.fn().mockResolvedValue("invite_id"),
      query: mockQuery,
      withIndex: vi.fn(),
      filter: vi.fn(),
      first: vi.fn(),
      order: vi.fn(),
      collect: vi.fn(),
      patch: vi.fn(),
      get: vi.fn(),
    },
    runQuery: vi.fn().mockResolvedValue(null),
    runMutation: vi.fn().mockResolvedValue(undefined),
    runAction: vi.fn().mockResolvedValue(undefined),
  };
}

describe("orgs:create", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubEnv("CLERK_SECRET_KEY", "test_secret_key");
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: [] }),
    });
  });

  it("requires userId in args", async () => {
    const { create } = await import("../../convex/functions/orgs");
    await expect(
      create.handler({ auth: { getUserIdentity: async () => null } }, { name: "Test" }),
    ).rejects.toThrow();
  });

  it("creates an org", async () => {
    const ctx = makeCtx();
    ctx.db.insert
      .mockResolvedValueOnce("org_id")
      .mockResolvedValueOnce("membership_id");
    const { create } = await import("../../convex/functions/orgs");
    const result = await create.handler(ctx, { name: "Test", userId: "user_test" });

    expect(result).toEqual({ orgId: "org_id" });
  });
});

describe("orgs:invite", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubEnv("CLERK_SECRET_KEY", "test_secret_key");
    vi.stubEnv("RESEND_API_KEY", "test_resend_key");
    vi.stubEnv("RESEND_FROM_EMAIL", "noreply@test.com");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://app.test.com");
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: [] }),
    });
  });

  it("requires authentication", async () => {
    requireAuthenticatedOrg.mockRejectedValue(new Error("Unauthenticated or no organisation"));

    const { invite } = await import("../../convex/functions/orgs");
    await expect(
      invite.handler({ auth: { getUserIdentity: async () => null } }, { email: "test@example.com", orgId: "org_test" }),
    ).rejects.toThrow("Unauthenticated or no organisation");
  });

  it("rejects cross-tenant org mismatch (SEC-007)", async () => {
    requireAuthenticatedOrg.mockResolvedValue({ userId: "user_test", orgId: "org_attacker" });

    const { invite } = await import("../../convex/functions/orgs");
    await expect(
      invite.handler({ auth: { getUserIdentity: async () => null } }, { email: "victim@example.com", orgId: "org_victim" }),
    ).rejects.toThrow("Org ID mismatch");
  });

  it("validates email format (SEC-008)", async () => {
    requireAuthenticatedOrg.mockResolvedValue({ userId: "user_test", orgId: "org_test" });

    const { invite } = await import("../../convex/functions/orgs");
    await expect(
      invite.handler({ auth: { getUserIdentity: async () => null } }, { email: "invalid-email", orgId: "org_test" }),
    ).rejects.toThrow("Invalid email address");
  });

  it("creates an invite", async () => {
    requireAuthenticatedOrg.mockResolvedValue({ userId: "user_test", orgId: "org_test" });

    const ctx = makeCtx();
    ctx.runQuery.mockResolvedValueOnce({
      _id: "membership_1",
      orgId: "org_test",
      userId: "user_test",
      role: "admin",
    });

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: "user_test",
          email_addresses: [{ email_address: "alice@example.com" }],
        }),
      });

    const { invite } = await import("../../convex/functions/orgs");
    const result = await invite.handler(ctx, { email: "test@example.com", orgId: "org_test" });

    expect(result).toHaveProperty("token");
    expect(typeof result.token).toBe("string");
    expect(result.token).toHaveLength(36);
  });
});

describe("orgs:acceptInvite", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubEnv("CLERK_SECRET_KEY", "test_secret_key");
  });

  it("requires authentication", async () => {
    requireAuthenticatedUser.mockRejectedValue(new Error("Unauthenticated"));

    const { acceptInvite } = await import("../../convex/functions/orgs");
    await expect(
      acceptInvite.handler({ auth: { getUserIdentity: async () => null } }, { token: "token_123" }),
    ).rejects.toThrow("Unauthenticated");
  });

  it("rejects invalid token (SEC-008)", async () => {
    requireAuthenticatedUser.mockResolvedValue({ userId: "user_test" });

    const ctx = makeCtx();
    ctx.runQuery.mockResolvedValue(null);

    const { acceptInvite } = await import("../../convex/functions/orgs");
    await expect(
      acceptInvite.handler(ctx, { token: "invalid_token" }),
    ).rejects.toThrow("Invalid invite token");
  });

  it("rejects expired invite (SEC-008)", async () => {
    requireAuthenticatedUser.mockResolvedValue({ userId: "user_test" });

    const ctx = makeCtx();
    ctx.runQuery.mockResolvedValueOnce({
      _id: "invite_123",
      token: "expired_token",
      orgId: "org_test",
      orgName: "Test",
      email: "test@example.com",
      expiresAt: Date.now() - 1000,
      createdAt: 0,
      updatedAt: 0,
      createdBy: "user_a",
    });

    const { acceptInvite } = await import("../../convex/functions/orgs");
    await expect(
      acceptInvite.handler(ctx, { token: "expired_token" }),
    ).rejects.toThrow("Invite has expired");
  });

  it("accepts invite when household has existing members (cap removed)", async () => {
    requireAuthenticatedUser.mockResolvedValue({ userId: "user_test" });

    const ctx = makeCtx();
    ctx.runQuery.mockResolvedValueOnce({
      _id: "invite_123",
      token: "valid_token",
      orgId: "org_test",
      orgName: "Test",
      email: "newuser@example.com",
      expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
      createdAt: 0,
      updatedAt: 0,
      createdBy: "user_a",
      inviteeUserId: undefined,
    });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ user_id: "user_test", id: "membership_1" }),
    });

    const { acceptInvite } = await import("../../convex/functions/orgs");
    const result = await acceptInvite.handler(ctx, { token: "valid_token" }) as Record<string, unknown>;
    expect(result.orgId).toBe("org_test");
    expect(result.orgName).toBe("Test");
    expect(result.role).toBe("member");
    expect(result.membershipId).toBe("membership_1");
  });
});

describe("orgs:listPendingInvites", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubEnv("CLERK_SECRET_KEY", "test_secret_key");
  });

  it("requires authentication", async () => {
    requireAuthenticatedOrg.mockRejectedValue(new Error("Unauthenticated or no organisation"));

    const { listPendingInvites } = await import("../../convex/functions/orgs");
    await expect(
      listPendingInvites.handler({ auth: { getUserIdentity: async () => null } }),
    ).rejects.toThrow("Unauthenticated or no organisation");
  });

  it("lists pending invites for current org", async () => {
    requireAuthenticatedOrg.mockResolvedValue({ userId: "user_test", orgId: "org_test" });

    const ctx = makeCtx();
    ctx.db.query.mockReturnValue({
      withIndex: vi.fn().mockReturnValue({
        filter: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            collect: vi.fn().mockResolvedValue([
              { token: "token_1", email: "a@test.com", orgId: "org_test" },
              { token: "token_2", email: "b@test.com", orgId: "org_test" },
            ]),
          }),
        }),
      }),
    });

    const { listPendingInvites } = await import("../../convex/functions/orgs");
    const result = await listPendingInvites.handler(ctx);

    expect(result).toEqual([
      { token: "token_1", email: "a@test.com", orgId: "org_test" },
      { token: "token_2", email: "b@test.com", orgId: "org_test" },
    ]);
  });
});
