import { describe, it, expect, vi } from "vitest";

const RETENTION_DAYS = 90;
const DAY_MS = 24 * 60 * 60 * 1000;
const RETENTION_THRESHOLD_MS = RETENTION_DAYS * DAY_MS;

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

function makeCtx(expired: Array<Record<string, unknown>>) {
  const collect = vi.fn().mockResolvedValue(expired);
  const mockQueryCollection = {
    withIndex: vi.fn().mockReturnValue({
      first: vi.fn().mockResolvedValue(null),
      filter: vi.fn().mockReturnValue({ collect }),
    }),
    filter: vi.fn().mockReturnValue({ collect }),
    order: vi.fn().mockReturnValue({ collect }),
    take: vi.fn().mockReturnValue({ collect }),
    collect,
  };
  return {
    db: {
      query: vi.fn().mockReturnValue(mockQueryCollection),
      delete: vi.fn().mockResolvedValue(true),
    },
    storage: { delete: vi.fn() },
    runQuery: vi.fn().mockResolvedValue(null),
    runMutation: vi.fn().mockResolvedValue(undefined),
    runAction: vi.fn().mockResolvedValue(undefined),
    scheduler: { runAfter: vi.fn().mockResolvedValue(undefined) },
  };
}

describe("retention: purgeExpiredExpenses", () => {
  it("purges expenses older than the retention cutoff", async () => {
    const oldDeletedAt = Date.now() - RETENTION_THRESHOLD_MS - 1000;
    const recentDeletedAt = Date.now() - RETENTION_THRESHOLD_MS + 1000;
    const ctx = makeCtx([
      { _id: "exp1", receiptImageIds: ["img1"], deletedAt: oldDeletedAt },
      { _id: "exp2", receiptImageIds: ["img2", "img3"], deletedAt: recentDeletedAt },
    ]);

    const retention = await import("../../convex/functions/retention");
    const result = await retention.purgeExpiredExpenses.handler(ctx, { orgId: "org-1" });

    expect(result.purgedExpenses).toBe(1);
    expect(ctx.storage.delete).toHaveBeenCalledWith("img1");
  });
});

describe("retention: getExpiredExpensesCount", () => {
  it("returns the number of expenses past the cutoff", async () => {
    const ctx = makeCtx([
      { _id: "exp1", deletedAt: Date.now() - RETENTION_THRESHOLD_MS - 1000 },
      { _id: "exp2", deletedAt: Date.now() - RETENTION_THRESHOLD_MS - 1000 },
      { _id: "exp3", deletedAt: Date.now() - RETENTION_THRESHOLD_MS + 1000 },
    ]);

    const retention = await import("../../convex/functions/retention");
    const result = await retention.getExpiredExpensesCount.handler(ctx, { orgId: "org-1" });

    expect(result.expiredNow).toBe(2);
  });
});

describe("retention: scheduleRetention", () => {
  it("schedules next run and reports ok", async () => {
    const ctx = makeCtx([]);

    const retention = await import("../../convex/functions/retention");
    const result = await retention.scheduleRetention.handler(ctx, {});

    expect(result.ok).toBe(true);
  });
});
