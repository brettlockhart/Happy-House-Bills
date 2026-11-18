import { describe, it, expect, vi, beforeEach } from "vitest";

const WRITE_PERMISSION_ERROR = "You do not have permission to write in this organisation";
const ADMIN_PERMISSION_ERROR = "Only active organisation admins can perform this action";

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
  defineInternal: (config: { handler: (ctx: unknown, args: unknown) => Promise<unknown> }) => ({
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
    boolean: () => ({ _isValidator: true }),
  },
}));

vi.mock("../../convex/auth", () => ({
  requireAuthenticatedUser: vi.fn(),
  requireAuthenticatedOrg: vi.fn(),
}));

const { assertOrgWriteAccess, assertOrgAdminAccess } = await import(
  "../../convex/functions/permissions"
);

const makeCtx = () => ({
  db: {
    query: vi.fn().mockReturnValue({
      withIndex: vi.fn().mockReturnValue({
        first: vi.fn().mockResolvedValue(null),
        filter: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            collect: vi.fn().mockResolvedValue([]),
          }),
        }),
      }),
    }),
    runQuery: vi.fn().mockResolvedValue(null),
    runMutation: vi.fn().mockResolvedValue(undefined),
    runAction: vi.fn().mockResolvedValue(undefined),
  },
});

describe("permissions: assertOrgWriteAccess / assertOrgAdminAccess", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("throws WRITE_PERMISSION_ERROR when no membership record exists", async () => {
    const ctx = makeCtx();
    await expect(assertOrgWriteAccess(ctx, "org-1", "user-1")).rejects.toThrow(WRITE_PERMISSION_ERROR);
  });

  it("throws WRITE_PERMISSION_ERROR when membership is deleted", async () => {
    const ctx = makeCtx();
    ctx.db.query.mockImplementation(() => ({
      withIndex: vi.fn().mockReturnValue({
        first: vi.fn().mockResolvedValue({ deletedAt: Date.now() - 86400000, status: "pending", role: "viewer" }),
        filter: vi.fn().mockReturnValue({ order: vi.fn().mockReturnValue({ collect: vi.fn().mockResolvedValue([]) }) }),
      }),
      filter: vi.fn().mockReturnValue({ order: vi.fn().mockReturnValue({ collect: vi.fn().mockResolvedValue([]) }) }),
    }));
    await expect(assertOrgWriteAccess(ctx, "org-1", "user-1")).rejects.toThrow(WRITE_PERMISSION_ERROR);
  });

  it("throws WRITE_PERMISSION_ERROR when membership status is not active", async () => {
    const ctx = makeCtx();
    ctx.db.query.mockImplementation(() => ({
      withIndex: vi.fn().mockReturnValue({
        first: vi.fn().mockResolvedValue({ deletedAt: undefined, status: "invited", role: "viewer" }),
        filter: vi.fn().mockReturnValue({ order: vi.fn().mockReturnValue({ collect: vi.fn().mockResolvedValue([]) }) }),
      }),
      filter: vi.fn().mockReturnValue({ order: vi.fn().mockReturnValue({ collect: vi.fn().mockResolvedValue([]) }) }),
    }));
    await expect(assertOrgWriteAccess(ctx, "org-1", "user-1")).rejects.toThrow(WRITE_PERMISSION_ERROR);
  });

  it("throws ADMIN_PERMISSION_ERROR when only members can write (adminOnly)", async () => {
    const ctx = makeCtx();
    ctx.db.query.mockImplementation(() => ({
      withIndex: vi.fn().mockReturnValue({
        first: vi.fn().mockResolvedValue({ deletedAt: undefined, status: "active", role: "member" }),
        filter: vi.fn().mockReturnValue({ order: vi.fn().mockReturnValue({ collect: vi.fn().mockResolvedValue([]) }) }),
      }),
      filter: vi.fn().mockReturnValue({ order: vi.fn().mockReturnValue({ collect: vi.fn().mockResolvedValue([]) }) }),
    }));
    await expect(assertOrgAdminAccess(ctx, "org-1", "user-1")).rejects.toThrow(ADMIN_PERMISSION_ERROR);
  });

  it("passes for active admin", async () => {
    const ctx = makeCtx();
    ctx.db.query.mockImplementation(() => ({
      withIndex: vi.fn().mockReturnValue({
        first: vi.fn().mockResolvedValue({ deletedAt: undefined, status: "active", role: "admin" }),
        filter: vi.fn().mockReturnValue({ order: vi.fn().mockReturnValue({ collect: vi.fn().mockResolvedValue([]) }) }),
      }),
      filter: vi.fn().mockReturnValue({ order: vi.fn().mockReturnValue({ collect: vi.fn().mockResolvedValue([]) }) }),
    }));
    await assertOrgWriteAccess(ctx, "org-1", "user-admin");
  });
});