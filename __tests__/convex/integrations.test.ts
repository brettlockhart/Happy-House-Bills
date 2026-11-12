import { describe, it, expect, vi, beforeEach } from "vitest";

const { requireAuthenticatedOrg, requireAuthenticatedUser } = vi.hoisted(() => ({
  requireAuthenticatedOrg: vi.fn(),
  requireAuthenticatedUser: vi.fn(),
}));

vi.mock("../../convex/auth", () => ({
  requireAuthenticatedUser,
  requireAuthenticatedOrg,
}));

vi.mock("convex/values", () => ({
  v: {
    string: () => ({ _isValidator: true }),
    any: () => ({ _isValidator: true }),
    number: () => ({ _isValidator: true }),
    union: () => ({ _isValidator: true }),
    literal: () => ({ _isValidator: true }),
    optional: () => ({ _isValidator: true }),
    id: () => ({ _isValidator: true }),
  },
}));

vi.mock("../../convex/_generated/server", () => ({
  mutation: (config: { handler: (ctx: unknown, args: unknown) => Promise<unknown> }) => ({
    ...config,
    handler: config.handler.bind(config),
  }),
  query: (config: { handler: (ctx: unknown, args: unknown) => Promise<unknown> }) => ({
    ...config,
    handler: config.handler.bind(config),
  }),
  internalMutation: (config: { handler: (ctx: unknown, args: unknown) => Promise<unknown> }) => ({
    ...config,
    handler: config.handler.bind(config),
  }),
  internalAction: (config: { handler: (ctx: unknown, args: unknown) => Promise<unknown> }) => ({
    ...config,
    handler: config.handler.bind(config),
  }),
  action: (config: { handler: (ctx: unknown, args: unknown) => Promise<unknown> }) => ({
    ...config,
    handler: config.handler.bind(config),
  }),
  internal: {},
}));

vi.mock("../../convex/functions/shared_constants", () => ({
  checkPermission: vi.fn(() => true),
}));

function makeCtx(overrides: Record<string, unknown> = {}) {
  const db = {
    insert: vi.fn().mockResolvedValue("integration_id"),
    delete: vi.fn(),
    patch: vi.fn(),
    query: vi.fn().mockReturnValue({
      withIndex: vi.fn().mockReturnValue({
        first: vi.fn().mockResolvedValue(null),
        collect: vi.fn().mockResolvedValue([]),
        order: vi.fn().mockReturnValue({
          take: vi.fn().mockResolvedValue([]),
        }),
      }),
      filter: vi.fn().mockReturnValue({
        first: vi.fn().mockResolvedValue(null),
        collect: vi.fn().mockResolvedValue([]),
        order: vi.fn().mockReturnValue({
          take: vi.fn().mockResolvedValue([]),
        }),
      }),
    }),
    get: vi.fn().mockResolvedValue(null),
    ...overrides.db,
  };

  return {
    auth: { getUserIdentity: async () => null },
    db,
    ...overrides,
  };
}

describe("integrations", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe("listIntegrations", () => {
    it("requires auth", async () => {
      requireAuthenticatedOrg.mockRejectedValue(new Error("Unauthenticated or no organisation"));
      const { listIntegrations } = await import("../../convex/functions/integrations");
      await expect(
        listIntegrations.handler({ auth: { getUserIdentity: async () => null } }, {}),
      ).rejects.toThrow("Unauthenticated or no organisation");
    });

    it("lists integrations for org", async () => {
      requireAuthenticatedOrg.mockResolvedValue({ userId: "user_test", orgId: "org_test" });
      const ctx = makeCtx();
      const { listIntegrations } = await import("../../convex/functions/integrations");
      const result = await listIntegrations.handler(ctx, {});
      expect(result).toEqual([]);
    });

    it("rejects without integration:read permission", async () => {
      requireAuthenticatedOrg.mockResolvedValue({ userId: "user_test", orgId: "org_test" });
      const { checkPermission } = await import("../../convex/functions/shared_constants");
      (checkPermission as ReturnType<typeof vi.fn>).mockReturnValue(false);
      const { listIntegrations } = await import("../../convex/functions/integrations");
      await expect(
        listIntegrations.handler({ auth: { getUserIdentity: async () => null } }, {}),
      ).rejects.toThrow("Insufficient permissions");
    });
  });

  describe("createIntegration", () => {
    it("requires auth", async () => {
      requireAuthenticatedOrg.mockRejectedValue(new Error("Unauthenticated or no organisation"));
      const { createIntegration } = await import("../../convex/functions/integrations");
      await expect(
        createIntegration.handler({ auth: { getUserIdentity: async () => null } }, {
          type: "bank",
          provider: "plaid",
          name: "Plaid",
        }),
      ).rejects.toThrow("Unauthenticated or no organisation");
    });

    it("creates integration", async () => {
      requireAuthenticatedOrg.mockResolvedValue({ userId: "user_test", orgId: "org_test" });
      const ctx = makeCtx();
      const { createIntegration } = await import("../../convex/functions/integrations");
      const result = await createIntegration.handler(
        ctx,
        { type: "bank", provider: "plaid", name: "Plaid" },
      );
      expect(result).toHaveProperty("integrationId");
    });

    it("rejects duplicate provider", async () => {
      requireAuthenticatedOrg.mockResolvedValue({ userId: "user_test", orgId: "org_test" });
      const ctx = makeCtx();
      ctx.db.query.mockReturnValue({
        withIndex: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue({ _id: "existing" }),
        }),
      });
      const { createIntegration } = await import("../../convex/functions/integrations");
      await expect(
        createIntegration.handler(ctx, {
          type: "bank",
          provider: "plaid",
          name: "Plaid",
        }),
      ).rejects.toThrow("already exists");
    });
  });

  describe("deleteIntegration", () => {
    it("requires auth", async () => {
      requireAuthenticatedOrg.mockRejectedValue(new Error("Unauthenticated or no organisation"));
      const { deleteIntegration } = await import("../../convex/functions/integrations");
      await expect(
        deleteIntegration.handler({ auth: { getUserIdentity: async () => null } }, {
          integrationId: "abc",
        }),
      ).rejects.toThrow("Unauthenticated or no organisation");
    });

    it("deletes integration", async () => {
      requireAuthenticatedOrg.mockResolvedValue({ userId: "user_test", orgId: "org_test" });
      const ctx = makeCtx();
      ctx.db.get.mockResolvedValue({ _id: "abc", orgId: "org_test" });
      const { deleteIntegration } = await import("../../convex/functions/integrations");
      const result = await deleteIntegration.handler(
        ctx,
        { integrationId: "abc" },
      );
      expect(result).toHaveProperty("integrationId");
    });
  });
});