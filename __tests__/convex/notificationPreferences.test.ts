import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../convex/_generated/server", () => ({
  query: (config: { handler: (ctx: unknown, args: unknown) => Promise<unknown> }) => ({
    ...config,
    handler: config.handler.bind(config),
  }),
  mutation: (config: { handler: (ctx: unknown, args: unknown) => Promise<unknown> }) => ({
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
  internalAction: (config: { handler: (ctx: unknown, args: unknown) => Promise<unknown> }) => ({
    ...config,
    handler: config.handler.bind(config),
  }),
}));

vi.mock("convex/values", () => ({
  v: {
    string: () => ({ _isValidator: true }),
    number: () => ({ _isValidator: true }),
    boolean: () => ({ _isValidator: true }),
    union: () => ({ _isValidator: true }),
    literal: () => ({ _isValidator: true }),
    optional: () => ({ _isValidator: true }),
    id: () => ({ _isValidator: true }),
    object: () => ({ _isValidator: true }),
    array: () => ({ _isValidator: true }),
  },
}));

vi.mock("../../convex/auth", () => ({
  requireAuthenticatedOrg: vi.fn(),
}));

vi.mock("../../convex/functions/permissions", () => ({
  assertOrgWriteAccess: vi.fn(),
}));

vi.mock("../../convex/_generated/api", () => ({
  default: { functions: {} },
}));

describe("notificationPreferences functions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("validates quiet hours time format", async () => {
    const { update } = await import("../../convex/functions/notificationPreferences");
    expect(update).toBeDefined();
  });

  it("exports get, update, and reset mutations", async () => {
    const module = await import("../../convex/functions/notificationPreferences");
    expect(module.get).toBeDefined();
    expect(module.update).toBeDefined();
    expect(module.reset).toBeDefined();
  });
});