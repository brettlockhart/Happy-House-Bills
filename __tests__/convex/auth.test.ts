import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../convex/_generated/server", () => ({
  action: (config: { handler: (ctx: unknown, args: unknown) => Promise<unknown> }) => ({
    ...config,
    handler: config.handler.bind(config),
  }),
  query: (config: { handler: (ctx: unknown, args: unknown) => Promise<unknown> }) => ({
    ...config,
    handler: config.handler.bind(config),
  }),
  mutationGeneric: (config: { handler: (ctx: unknown, args: unknown) => Promise<unknown> }) => ({
    ...config,
    handler: config.handler.bind(config),
  }),
  queryGeneric: (config: { handler: (ctx: unknown, args: unknown) => Promise<unknown> }) => ({
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
  },
}));

function makeIdentity(subject: string, orgId?: string): Record<string, unknown> {
  const identity: Record<string, unknown> = { subject };
  if (orgId !== undefined) {
    identity.org_id = orgId;
  }
  return identity;
}

describe("auth:requireAuthenticatedUser (SEC-001)", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("throws when identity is null", async () => {
    const { requireAuthenticatedUser } = await import("../../convex/auth");
    await expect(
      requireAuthenticatedUser({ auth: { getUserIdentity: async () => null } }),
    ).rejects.toThrow("Unauthenticated");
  });

  it("returns userId when identity is present", async () => {
    const { requireAuthenticatedUser } = await import("../../convex/auth");
    const result = await requireAuthenticatedUser({
      auth: { getUserIdentity: async () => makeIdentity("user_test") },
    });
    expect(result).toEqual({ userId: "user_test" });
  });

  it("throws when userId is empty (SEC-004)", async () => {
    const { requireAuthenticatedUser } = await import("../../convex/auth");
    await expect(
      requireAuthenticatedUser({ auth: { getUserIdentity: async () => makeIdentity("") } }),
    ).rejects.toThrow("Unauthenticated");
  });
});

describe("auth:requireAuthenticatedOrg (SEC-001)", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("throws when identity is null", async () => {
    const { requireAuthenticatedOrg } = await import("../../convex/auth");
    await expect(
      requireAuthenticatedOrg({ auth: { getUserIdentity: async () => null } }),
    ).rejects.toThrow("Unauthenticated");
  });

  it("returns userId and orgId when identity is present", async () => {
    const { requireAuthenticatedOrg } = await import("../../convex/auth");
    const result = await requireAuthenticatedOrg({
      auth: { getUserIdentity: async () => makeIdentity("user_test", "org_test") },
    });
    expect(result).toEqual({ userId: "user_test", orgId: "org_test" });
  });

  it("throws when userId is empty (SEC-004)", async () => {
    const { requireAuthenticatedOrg } = await import("../../convex/auth");
    await expect(
      requireAuthenticatedOrg({ auth: { getUserIdentity: async () => makeIdentity("", "org_test") } }),
    ).rejects.toThrow("Unauthenticated");
  });

  it("throws when orgId is missing (SEC-004)", async () => {
    const { requireAuthenticatedOrg } = await import("../../convex/auth");
    await expect(
      requireAuthenticatedOrg({ auth: { getUserIdentity: async () => makeIdentity("user_test") } }),
    ).rejects.toThrow("Unauthenticated or no organisation");
  });

  it("throws when orgId is empty string (SEC-004)", async () => {
    const { requireAuthenticatedOrg } = await import("../../convex/auth");
    await expect(
      requireAuthenticatedOrg({ auth: { getUserIdentity: async () => makeIdentity("user_test", "") } }),
    ).rejects.toThrow("Unauthenticated or no organisation");
  });
});
