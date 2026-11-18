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
  internalQuery: (config: { handler: (ctx: unknown, args: unknown) => Promise<unknown> }) => ({
    ...config,
    handler: config.handler.bind(config),
  }),
  internalMutation: (config: { handler: (ctx: unknown, args: unknown) => Promise<unknown> }) => ({
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
    optional: () => ({ _isValidator: true }),
    id: () => ({ _isValidator: true }),
    array: () => ({ _isValidator: true }),
  },
}));

vi.mock("~/convex/auth", () => ({
  requireAuthenticatedUser,
  requireAuthenticatedOrg,
}));

vi.mock("~/convex/functions/teams", async () => {
  const actual = await vi.importActual("~/convex/functions/teams");
  return {
    listMembers: actual.listMembers,
    updateMemberRole: actual.updateMemberRole,
    removeMember: actual.removeMember,
    listAuditLogs: actual.listAuditLogs,
    createInvite: actual.createInvite,
    acceptTeamInvite: actual.acceptTeamInvite,
    checkPermission: actual.checkPermission,
  };
});

vi.mock("~/convex/functions/orgs", async () => {
  const actual = await vi.importActual("~/convex/functions/orgs");
  return {
    create: actual.create,
    invite: actual.invite,
    acceptInvite: actual.acceptInvite,
    listPendingInvites: actual.listPendingInvites,
  };
});

vi.mock("~/convex/functions/email", async () => {
  const actual = await vi.importActual("~/convex/functions/email");
  return {
    sendEmail: actual.sendEmail,
    renderInviteEmail: actual.renderInviteEmail,
  };
});

vi.mock("~/convex/functions/clerk", async () => {
  const actual = await vi.importActual("~/convex/functions/clerk");
  return {
    clerkRequest: actual.clerkRequest,
  };
});

const mockFetch = vi.fn();
(global as Record<string, unknown>).fetch = mockFetch as unknown as typeof fetch;

function makeCtx() {
  const membershipQuery = {
    withIndex: vi.fn().mockReturnValue({
      first: vi.fn().mockResolvedValue({
        _id: "membership_1",
        orgId: "org_test",
        userId: "user_test",
        role: "admin",
        status: "active",
      }),
      collect: vi.fn().mockResolvedValue([
        { _id: "membership_1", orgId: "org_test", userId: "user_test", role: "admin" },
        { _id: "membership_2", orgId: "org_test", userId: "user_member", role: "member" },
      ]),
    }),
  };

  const auditLogsQuery = {
    withIndex: vi.fn().mockReturnValue({
      order: vi.fn().mockReturnValue({
        take: vi.fn().mockResolvedValue([]),
      }),
    }),
  };

  const dbQuery = vi.fn((table: string) => {
    if (table === "memberships") return membershipQuery;
    if (table === "auditLogs") return auditLogsQuery;
    return {
      withIndex: vi.fn().mockReturnValue({
        first: vi.fn().mockResolvedValue(null),
        order: vi.fn().mockReturnValue({
          take: vi.fn().mockResolvedValue([]),
        }),
        collect: vi.fn().mockResolvedValue([]),
      }),
    };
  });

  return {
    auth: { getUserIdentity: async () => null },
    db: {
      insert: vi.fn().mockResolvedValue("membership_id"),
      delete: vi.fn(),
      patch: vi.fn(),
      query: dbQuery,
    },
    runQuery: vi.fn().mockResolvedValue(null),
    runMutation: vi.fn().mockResolvedValue(undefined),
  };
}

describe("teams:listMembers", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://app.test.com");
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ data: [] }) });
  });

  it("returns members for org", async () => {
    requireAuthenticatedOrg.mockResolvedValue({ userId: "user_test", orgId: "org_test" });

    const ctx = makeCtx();
    const { listMembers } = await import("../../convex/functions/teams");
    const result = await listMembers.handler(ctx, {});

    expect(result).toEqual([
      { _id: "membership_1", orgId: "org_test", userId: "user_test", role: "admin" },
      { _id: "membership_2", orgId: "org_test", userId: "user_member", role: "member" },
    ]);
  });

  it("requires org authentication", async () => {
    requireAuthenticatedOrg.mockRejectedValue(new Error("Unauthenticated or no organisation"));

    const ctx = makeCtx();
    const { listMembers } = await import("../../convex/functions/teams");
    await expect(
      listMembers.handler(ctx, {}),
    ).rejects.toThrow("Unauthenticated or no organisation");
  });
});

describe("teams:updateMemberRole", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://app.test.com");
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ data: [] }) });
  });

  it("updates member role", async () => {
    requireAuthenticatedOrg.mockResolvedValue({ userId: "user_test", orgId: "org_test" });

    const ctx = makeCtx();
    ctx.db.query.mockReturnValue({
      withIndex: vi.fn().mockImplementation((indexName: string) => {
        if (indexName === "by_org_user") {
          return {
            first: vi.fn().mockResolvedValue({
              _id: "caller_membership_1",
              orgId: "org_test",
              userId: "user_test",
              role: "admin",
              status: "active",
            }),
          };
        }
        return {
          first: vi.fn().mockResolvedValue({
            _id: "membership_1",
            orgId: "org_test",
            userId: "user_member",
            role: "member",
            status: "active",
          }),
        };
      }),
    });
    const { updateMemberRole } = await import("../../convex/functions/teams");
    await updateMemberRole.handler(ctx, {
      userId: "user_member",
      role: "admin",
    });

    expect(ctx.db.patch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ role: "admin" }),
    );
  });

  it("rejects changing own role", async () => {
    requireAuthenticatedOrg.mockResolvedValue({ userId: "user_test", orgId: "org_test" });

    const ctx = makeCtx();
    const { updateMemberRole } = await import("../../convex/functions/teams");
    await expect(
      updateMemberRole.handler(ctx, {
        userId: "user_test",
        role: "viewer",
      }),
    ).rejects.toThrow("Cannot change your own role");
  });
});

describe("teams:removeMember", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://app.test.com");
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ data: [] }) });
  });

  it("removes member", async () => {
    requireAuthenticatedOrg.mockResolvedValue({ userId: "user_test", orgId: "org_test" });

    const ctx = makeCtx();
    ctx.db.query.mockReturnValue({
      withIndex: vi.fn().mockImplementation((indexName: string) => {
        if (indexName === "by_org_user") {
          return {
            first: vi.fn().mockResolvedValue({
              _id: "caller_membership_1",
              orgId: "org_test",
              userId: "user_test",
              role: "admin",
              status: "active",
            }),
          };
        }
        return {
          first: vi.fn().mockResolvedValue({
            _id: "membership_1",
            orgId: "org_test",
            userId: "user_member",
            status: "active",
          }),
        };
      }),
    });
    const { removeMember } = await import("../../convex/functions/teams");
    await removeMember.handler(ctx, { userId: "user_member" });

    expect(ctx.db.delete).toHaveBeenCalledWith(expect.any(String));
  });

  it("rejects removing yourself", async () => {
    requireAuthenticatedOrg.mockResolvedValue({ userId: "user_test", orgId: "org_test" });

    const ctx = makeCtx();
    const { removeMember } = await import("../../convex/functions/teams");
    await expect(
      removeMember.handler(ctx, { userId: "user_test" }),
    ).rejects.toThrow("Cannot remove yourself");
  });
});

describe("teams:listAuditLogs", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://app.test.com");
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ data: [] }) });
  });

  it("returns audit logs for org", async () => {
    requireAuthenticatedOrg.mockResolvedValue({ userId: "user_test", orgId: "org_test" });

    const ctx = makeCtx();
    const { listAuditLogs } = await import("../../convex/functions/teams");
    const result = await listAuditLogs.handler(ctx, { limit: 20 });

    expect(result).toEqual([]);
  });

  it("requires org authentication", async () => {
    requireAuthenticatedOrg.mockRejectedValue(new Error("Unauthenticated or no organisation"));

    const ctx = makeCtx();
    const { listAuditLogs } = await import("../../convex/functions/teams");
    await expect(
      listAuditLogs.handler(ctx, {}),
    ).rejects.toThrow("Unauthenticated or no organisation");
  });
});

describe("teams:createInvite", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://app.test.com");
    vi.stubEnv("RESEND_API_KEY", "test_key");
    vi.stubEnv("RESEND_FROM_EMAIL", "noreply@test.com");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://app.test.com");
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ data: [] }) });
  });

  it("requires authentication", async () => {
    requireAuthenticatedOrg.mockRejectedValue(new Error("Unauthenticated or no organisation"));

    const { createInvite } = await import("../../convex/functions/teams");
    await expect(
      createInvite.handler({ auth: { getUserIdentity: async () => null } }, {
        email: "test@example.com",
        orgId: "org_test",
        orgName: "Test Org",
        role: "admin",
      }),
    ).rejects.toThrow("Unauthenticated or no organisation");
  });

  it("validates email format", async () => {
    requireAuthenticatedOrg.mockResolvedValue({ userId: "user_test", orgId: "org_test" });

    const { createInvite } = await import("../../convex/functions/teams");
    await expect(
      createInvite.handler({ auth: { getUserIdentity: async () => null } }, {
        email: "invalid-email",
        orgId: "org_test",
        orgName: "Test Org",
        role: "admin",
      }),
    ).rejects.toThrow("Invalid email address");
  });

  it("rejects org ID mismatch", async () => {
    requireAuthenticatedOrg.mockResolvedValue({ userId: "user_test", orgId: "org_attacker" });

    const { createInvite } = await import("../../convex/functions/teams");
    await expect(
      createInvite.handler({ auth: { getUserIdentity: async () => null } }, {
        email: "test@example.com",
        orgId: "org_victim",
        orgName: "Test Org",
        role: "admin",
      }),
    ).rejects.toThrow("Org ID mismatch");
  });
});

describe("teams:acceptTeamInvite", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://app.test.com");
    vi.stubEnv("CLERK_SECRET_KEY", "test_secret_key");
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: [] }),
    });
  });

  it("requires authentication", async () => {
    requireAuthenticatedUser.mockRejectedValue(new Error("Unauthenticated"));

    const { acceptTeamInvite } = await import("../../convex/functions/teams");
    await expect(
      acceptTeamInvite.handler({ auth: { getUserIdentity: async () => null } }, { token: "token_123" }),
    ).rejects.toThrow("Unauthenticated");
  });

  it("rejects expired token", async () => {
    requireAuthenticatedUser.mockResolvedValue({ userId: "user_test" });

    const ctx = makeCtx();
    ctx.db.query.mockReturnValue({
      withIndex: vi.fn().mockReturnValue({
        first: vi.fn().mockResolvedValue({
          _id: "invite_1",
          orgId: "org_test",
          expiresAt: Date.now() - 1000000,
        }),
      }),
    });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: [{ id: "user_test", email_addresses: [{ email_address: "test@example.com" }] }] }),
    });

    const { acceptTeamInvite } = await import("../../convex/functions/teams");
    await expect(
      acceptTeamInvite.handler(ctx, { token: "token_123" }),
    ).rejects.toThrow("Invite has expired");
  });

  it("rejects already a member", async () => {
    requireAuthenticatedUser.mockResolvedValue({ userId: "user_test" });

    const ctx = makeCtx();
    ctx.db.query.mockReturnValue({
      withIndex: vi.fn().mockReturnValue({
        first: vi.fn().mockResolvedValue({
          _id: "membership_1",
          orgId: "org_test",
          userId: "user_test",
        }),
      }),
    });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: [{ id: "user_test", email_addresses: [{ email_address: "test@example.com" }] }] }),
    });

    const { acceptTeamInvite } = await import("../../convex/functions/teams");
    await expect(
      acceptTeamInvite.handler(ctx, { token: "token_123" }),
    ).rejects.toThrow("You are already a member of this organization");
  });

  it("accepts valid invite", async () => {
    requireAuthenticatedUser.mockResolvedValue({ userId: "user_test" });

    const ctx = makeCtx();
    ctx.db.query.mockImplementation((table: string) => {
      if (table === "invites") {
        return {
          withIndex: vi.fn().mockReturnValue({
            first: vi.fn().mockResolvedValue({
              _id: "invite_1",
              orgId: "org_test",
              expiresAt: Date.now() + 86400000,
              orgName: "Test Org",
              role: "member",
              createdBy: "user_creator",
            }),
          }),
        };
      }
      if (table === "memberships") {
        return {
          withIndex: vi.fn().mockReturnValue({
            first: vi.fn().mockResolvedValue(null),
          }),
        };
      }
      return {
        withIndex: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue(null),
        }),
      };
    });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: [{ id: "user_test", email_addresses: [{ email_address: "test@example.com" }] }] }),
    }).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: [] }),
    });

    const { acceptTeamInvite } = await import("../../convex/functions/teams");
    const result = await acceptTeamInvite.handler(ctx, { token: "token_123" });

    expect(result).toHaveProperty("orgId");
    expect(result).toHaveProperty("membershipId");
  });
});