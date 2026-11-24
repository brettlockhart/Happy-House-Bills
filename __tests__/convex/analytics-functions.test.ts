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
    functions: {
      analytics: {
        summary: {},
      },
      predictions: {
        forecast: {},
      },
      insights: {
        insights: {},
      },
    },
  },
  internal: {
    functions: {
      analytics: {
        summary: "internal.functions.analytics.summary",
      },
      predictions: {
        forecast: "internal.functions.predictions.forecast",
      },
      insights: {
        insights: "internal.functions.insights.insights",
      },
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

type MockIdentity = UserIdentity;

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

interface IndexQueryBuilder {
  field: (name: string) => unknown;
  eq: (field: string, value: unknown) => IndexQueryBuilder;
  neq: (field: string, value: unknown) => IndexQueryBuilder;
}

interface QueryChain {
  withIndex: (name: string, fn?: (q: IndexQueryBuilder) => IndexQueryBuilder) => QueryChain;
  filter: (fn: (q: FilterQueryBuilder) => boolean) => QueryChain;
  order: (direction: string) => QueryChain;
  take: (n: number) => unknown[];
  collect: () => unknown[];
  first: () => unknown | null;
  unique: () => unknown | null;
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
    take: (n: number) => {
      filtered = filtered.slice(0, n);
      return filtered;
    },
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
    runAfter: ReturnType<typeof vi.fn>;
  };
  runAction: ReturnType<typeof vi.fn>;
}

function createMockCtx(
  user: MockIdentity | null,
  options?: {
    expenses?: unknown[];
    memberships?: unknown[];
    subscriptions?: unknown[];
  }
): MockCtx {
  const expenseResults = options?.expenses || [];
  const membershipResults = options?.memberships || [];
  const subscriptionResults = options?.subscriptions || [];

  const ctx: MockCtx = {
    auth: {
      getUserIdentity: () => Promise.resolve(user),
    },
    db: {
      query: (table: string) => {
        if (table === "memberships") {
          return createQueryChain(membershipResults);
        }
        if (table === "subscriptions") {
          return createQueryChain(subscriptionResults);
        }
        return createQueryChain(expenseResults);
      },
      get: () => Promise.resolve(null),
      patch: () => Promise.resolve(),
      insert: () => Promise.resolve("mock_id"),
    },
    scheduler: {
      runAfter: vi.fn(),
    },
    runAction: vi.fn(),
  };
  return ctx;
}

function validIdentity(): MockIdentity {
  return { subject: "user_1", tokenIdentifier: "clerk:org_1|user_1", org_id: "org_1" } as MockIdentity;
}

function createExpense(overrides: Partial<Record<string, unknown>> = {}) {
  const now = Date.now();
  return {
    _id: "exp_1",
    orgId: "org_1",
    userId: "user_1",
    amount: 50,
    category: "groceries",
    status: "approved",
    deletedAt: undefined,
    date: new Date(now - 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    createdAt: now - 24 * 60 * 60 * 1000,
    ...overrides,
  };
}

describe("analytics:summary", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("throws when unauthenticated", async () => {
    const { summary } = await import("../../convex/functions/analytics");
    const ctx = createMockCtx(null);
    await expect(summary.handler(ctx as never, { period: "month" })).rejects.toThrow("Unauthenticated");
  });

  it("returns summary with correct period", async () => {
    const { summary } = await import("../../convex/functions/analytics");
    const now = Date.now();
    const expenses = [
      createExpense({ _id: "exp_1", amount: 50, category: "groceries", createdAt: now - 2 * 24 * 60 * 60 * 1000, date: new Date(now - 2 * 24 * 60 * 60 * 1000).toISOString().split("T")[0] }),
      createExpense({ _id: "exp_2", amount: 30, category: "groceries", createdAt: now - 3 * 24 * 60 * 60 * 1000, date: new Date(now - 3 * 24 * 60 * 60 * 1000).toISOString().split("T")[0] }),
      createExpense({ _id: "exp_3", amount: 100, category: "utilities", createdAt: now - 5 * 24 * 60 * 60 * 1000, date: new Date(now - 5 * 24 * 60 * 60 * 1000).toISOString().split("T")[0] }),
    ];
    const ctx = createMockCtx(validIdentity(), { expenses });
    const result = await summary.handler(ctx as never, { period: "week" });

    expect(result).toEqual(expect.objectContaining({
      period: "week",
      totalSpent: expect.any(Number),
      averagePerExpense: expect.any(Number),
      expenseCount: expect.any(Number),
      categories: expect.arrayContaining([
        expect.objectContaining({ category: "groceries", amount: expect.any(Number) }),
        expect.objectContaining({ category: "utilities", amount: expect.any(Number) }),
      ]),
      topCategory: expect.objectContaining({ category: expect.any(String), amount: expect.any(Number) }),
      dailyTotals: expect.arrayContaining([
        expect.objectContaining({ date: expect.any(String), amount: expect.any(Number) }),
      ]),
    }));
    expect(result.expenseCount).toBe(3);
    expect(result.totalSpent).toBe(180);
  });

  it("filters by period correctly (week vs month)", async () => {
    const { summary } = await import("../../convex/functions/analytics");
    const now = Date.now();
    const expenses = [
      createExpense({ _id: "exp_recent", amount: 50, category: "groceries", createdAt: now - 2 * 24 * 60 * 60 * 1000 }),
      createExpense({ _id: "exp_old", amount: 100, category: "utilities", createdAt: now - 60 * 24 * 60 * 60 * 1000 }),
    ];
    const ctx = createMockCtx(validIdentity(), { expenses });

    const weekResult = await summary.handler(ctx as never, { period: "week" });
    const monthResult = await summary.handler(ctx as never, { period: "month" });

    expect(weekResult.expenseCount).toBe(1);
    expect(monthResult.expenseCount).toBe(1);
    expect(weekResult.totalSpent).toBe(50);
  });

  it("excludes deleted expenses", async () => {
    const { summary } = await import("../../convex/functions/analytics");
    const now = Date.now();
    const expenses = [
      createExpense({ _id: "exp_active", amount: 50, category: "groceries", deletedAt: undefined, createdAt: now - 2 * 24 * 60 * 60 * 1000 }),
      createExpense({ _id: "exp_deleted", amount: 100, category: "utilities", deletedAt: now - 1000, createdAt: now - 5 * 24 * 60 * 60 * 1000 }),
    ];
    const ctx = createMockCtx(validIdentity(), { expenses });
    const result = await summary.handler(ctx as never, { period: "month" });

    expect(result.expenseCount).toBe(1);
    expect(result.totalSpent).toBe(50);
  });

  it("excludes non-approved expenses", async () => {
    const { summary } = await import("../../convex/functions/analytics");
    const now = Date.now();
    const expenses = [
      createExpense({ _id: "exp_approved", amount: 50, category: "groceries", status: "approved", createdAt: now - 2 * 24 * 60 * 60 * 1000 }),
      createExpense({ _id: "exp_pending", amount: 100, category: "utilities", status: "pending", createdAt: now - 3 * 24 * 60 * 60 * 1000 }),
      createExpense({ _id: "exp_rejected", amount: 200, category: "transport", status: "rejected", createdAt: now - 5 * 24 * 60 * 60 * 1000 }),
    ];
    const ctx = createMockCtx(validIdentity(), { expenses });
    const result = await summary.handler(ctx as never, { period: "month" });

    expect(result.expenseCount).toBe(1);
    expect(result.totalSpent).toBe(50);
  });

  it("handles empty expenses list", async () => {
    const { summary } = await import("../../convex/functions/analytics");
    const ctx = createMockCtx(validIdentity(), { expenses: [] });
    const result = await summary.handler(ctx as never, { period: "month" });

    expect(result).toEqual(expect.objectContaining({
      period: "month",
      totalSpent: 0,
      averagePerExpense: 0,
      expenseCount: 0,
      categories: [],
      topCategory: null,
      dailyTotals: [],
    }));
  });

  it("groups by category correctly", async () => {
    const { summary } = await import("../../convex/functions/analytics");
    const now = Date.now();
    const expenses = [
      createExpense({ _id: "exp_1", amount: 50, category: "groceries", createdAt: now - 2 * 24 * 60 * 60 * 1000 }),
      createExpense({ _id: "exp_2", amount: 30, category: "groceries", createdAt: now - 3 * 24 * 60 * 60 * 1000 }),
      createExpense({ _id: "exp_3", amount: 100, category: "utilities", createdAt: now - 5 * 24 * 60 * 60 * 1000 }),
    ];
    const ctx = createMockCtx(validIdentity(), { expenses });
    const result = await summary.handler(ctx as never, { period: "month" });

    const groceries = result.categories.find((c) => c.category === "groceries");
    const utilities = result.categories.find((c) => c.category === "utilities");
    expect(groceries?.amount).toBe(80);
    expect(utilities?.amount).toBe(100);
    expect(result.topCategory?.category).toBe("utilities");
  });

  it("generates daily totals sorted by date", async () => {
    const { summary } = await import("../../convex/functions/analytics");
    const now = Date.now();
    const expenses = [
      createExpense({ _id: "exp_1", amount: 50, date: new Date(now - 3 * 24 * 60 * 60 * 1000).toISOString().split("T")[0], createdAt: now - 3 * 24 * 60 * 60 * 1000 }),
      createExpense({ _id: "exp_2", amount: 30, date: new Date(now - 1 * 24 * 60 * 60 * 1000).toISOString().split("T")[0], createdAt: now - 1 * 24 * 60 * 60 * 1000 }),
    ];
    const ctx = createMockCtx(validIdentity(), { expenses });
    const result = await summary.handler(ctx as never, { period: "week" });

    expect(result.dailyTotals.length).toBeGreaterThan(0);
    const dates = result.dailyTotals.map((d) => d.date);
    const sortedDates = [...dates].sort((a, b) => a.localeCompare(b));
    expect(dates).toEqual(sortedDates);
  });
});

describe("predictions:forecast", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("throws when unauthenticated", async () => {
    const { forecast } = await import("../../convex/functions/predictions");
    const ctx = createMockCtx(null);
    await expect(forecast.handler(ctx as never, { period: "month" })).rejects.toThrow("Unauthenticated");
  });

  it("returns zero forecast for empty expenses", async () => {
    const { forecast } = await import("../../convex/functions/predictions");
    const ctx = createMockCtx(validIdentity(), { expenses: [] });
    const result = await forecast.handler(ctx as never, { period: "month" });

    expect(result).toEqual(expect.objectContaining({
      forecast: 0,
      confidence: "low",
      period: "month",
      historicalTotal: 0,
      dataPoints: 0,
    }));
  });

  it("calculates forecast from historical data", async () => {
    const { forecast } = await import("../../convex/functions/predictions");
    const now = Date.now();
    const expenses = [
      createExpense({ _id: "exp_1", amount: 100, createdAt: now - 10 * 24 * 60 * 60 * 1000 }),
      createExpense({ _id: "exp_2", amount: 200, createdAt: now - 5 * 24 * 60 * 60 * 1000 }),
    ];
    const ctx = createMockCtx(validIdentity(), { expenses });
    const result = await forecast.handler(ctx as never, { period: "month" });

    expect(result.historicalTotal).toBe(300);
    expect(result.dataPoints).toBe(2);
    expect(result.forecast).toBeGreaterThan(0);
    expect(result.confidence).toBe("low");
  });

  it("returns medium confidence with 3+ data points", async () => {
    const { forecast } = await import("../../convex/functions/predictions");
    const now = Date.now();
    const expenses = [
      createExpense({ _id: "exp_1", amount: 100, createdAt: now - 10 * 24 * 60 * 60 * 1000 }),
      createExpense({ _id: "exp_2", amount: 200, createdAt: now - 5 * 24 * 60 * 60 * 1000 }),
      createExpense({ _id: "exp_3", amount: 150, createdAt: now - 2 * 24 * 60 * 60 * 1000 }),
    ];
    const ctx = createMockCtx(validIdentity(), { expenses });
    const result = await forecast.handler(ctx as never, { period: "month" });

    expect(result.confidence).toBe("medium");
  });

  it("handles different periods (month, quarter, year)", async () => {
    const { forecast } = await import("../../convex/functions/predictions");
    const now = Date.now();
    const expenses = [
      createExpense({ _id: "exp_1", amount: 300, createdAt: now - 10 * 24 * 60 * 60 * 1000 }),
    ];
    const ctx = createMockCtx(validIdentity(), { expenses });

    const monthResult = await forecast.handler(ctx as never, { period: "month" });
    const quarterResult = await forecast.handler(ctx as never, { period: "quarter" });
    const yearResult = await forecast.handler(ctx as never, { period: "year" });

    expect(monthResult.period).toBe("month");
    expect(quarterResult.period).toBe("quarter");
    expect(yearResult.period).toBe("year");
    expect(quarterResult.forecast).toBeLessThan(monthResult.forecast);
    expect(yearResult.forecast).toBeLessThan(quarterResult.forecast);
  });

  it("excludes deleted and non-approved expenses", async () => {
    const { forecast } = await import("../../convex/functions/predictions");
    const now = Date.now();
    const expenses = [
      createExpense({ _id: "exp_approved", amount: 100, status: "approved", deletedAt: undefined, createdAt: now - 10 * 24 * 60 * 60 * 1000 }),
      createExpense({ _id: "exp_pending", amount: 200, status: "pending", deletedAt: undefined, createdAt: now - 5 * 24 * 60 * 60 * 1000 }),
      createExpense({ _id: "exp_deleted", amount: 300, status: "approved", deletedAt: now - 1000, createdAt: now - 2 * 24 * 60 * 60 * 1000 }),
    ];
    const ctx = createMockCtx(validIdentity(), { expenses });
    const result = await forecast.handler(ctx as never, { period: "month" });

    expect(result.dataPoints).toBe(1);
    expect(result.historicalTotal).toBe(100);
  });
});

describe("insights:insights", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("throws when unauthenticated", async () => {
    const { insights } = await import("../../convex/functions/insights");
    const ctx = createMockCtx(null);
    await expect(insights.handler(ctx as never, {})).rejects.toThrow("Unauthenticated");
  });

  it("returns positive insight when no anomalies", async () => {
    const { insights } = await import("../../convex/functions/insights");
    const now = Date.now();
    const expenses = [
      createExpense({ _id: "exp_1", amount: 40, category: "groceries", createdAt: now - 2 * 24 * 60 * 60 * 1000 }),
      createExpense({ _id: "exp_2", amount: 30, category: "groceries", createdAt: now - 5 * 24 * 60 * 60 * 1000 }),
      createExpense({ _id: "exp_3", amount: 50, category: "utilities", createdAt: now - 8 * 24 * 60 * 60 * 1000 }),
      createExpense({ _id: "exp_4", amount: 20, category: "transport", createdAt: now - 10 * 24 * 60 * 60 * 1000 }),
    ];
    const ctx = createMockCtx(validIdentity(), { expenses });
    const result = await insights.handler(ctx as never, {});

    expect(result.insights).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: "positive",
        severity: "info",
        message: expect.stringContaining("No anomalies detected"),
      }),
    ]));
  });

  it("detects top category spending pattern (>50% share)", async () => {
    const { insights } = await import("../../convex/functions/insights");
    const now = Date.now();
    const expenses = [
      createExpense({ _id: "exp_1", amount: 80, category: "groceries", createdAt: now - 2 * 24 * 60 * 60 * 1000 }),
      createExpense({ _id: "exp_2", amount: 70, category: "groceries", createdAt: now - 5 * 24 * 60 * 60 * 1000 }),
      createExpense({ _id: "exp_3", amount: 20, category: "utilities", createdAt: now - 8 * 24 * 60 * 60 * 1000 }),
      createExpense({ _id: "exp_4", amount: 10, category: "transport", createdAt: now - 10 * 24 * 60 * 60 * 1000 }),
    ];
    const ctx = createMockCtx(validIdentity(), { expenses });
    const result = await insights.handler(ctx as never, {});

    const patternInsight = result.insights.find((i) => i.type === "spending_pattern");
    expect(patternInsight).toBeDefined();
    expect(patternInsight?.message).toContain("groceries");
    expect(patternInsight?.message).toContain("%");
  });

  it("detects spending spike (>2x daily average)", async () => {
    const { insights } = await import("../../convex/functions/insights");
    const now = Date.now();
    const spikeDate = new Date(now - 3 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    const normalDate1 = new Date(now - 1 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    const normalDate2 = new Date(now - 2 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    const normalDate3 = new Date(now - 4 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    const expenses = [
      createExpense({ _id: "exp_1", amount: 20, date: normalDate1, createdAt: now - 1 * 24 * 60 * 60 * 1000 }),
      createExpense({ _id: "exp_2", amount: 20, date: normalDate2, createdAt: now - 2 * 24 * 60 * 60 * 1000 }),
      createExpense({ _id: "exp_3", amount: 20, date: normalDate3, createdAt: now - 4 * 24 * 60 * 60 * 1000 }),
      createExpense({ _id: "exp_4", amount: 200, date: spikeDate, createdAt: now - 3 * 24 * 60 * 60 * 1000 }),
    ];
    const ctx = createMockCtx(validIdentity(), { expenses });
    const result = await insights.handler(ctx as never, {});

    const spikeInsight = result.insights.find((i) => i.type === "spike");
    expect(spikeInsight).toBeDefined();
    expect(spikeInsight?.severity).toBe("warning");
    expect(spikeInsight?.message).toContain("Spending spike");
    expect(spikeInsight?.message).toContain("2x daily average");
  });

  it("excludes deleted and non-approved expenses", async () => {
    const { insights } = await import("../../convex/functions/insights");
    const now = Date.now();
    const expenses = [
      createExpense({ _id: "exp_approved", amount: 30, category: "groceries", status: "approved", deletedAt: undefined, createdAt: now - 2 * 24 * 60 * 60 * 1000 }),
      createExpense({ _id: "exp_approved2", amount: 30, category: "utilities", status: "approved", deletedAt: undefined, createdAt: now - 5 * 24 * 60 * 60 * 1000 }),
      createExpense({ _id: "exp_approved3", amount: 30, category: "transport", status: "approved", deletedAt: undefined, createdAt: now - 8 * 24 * 60 * 60 * 1000 }),
      createExpense({ _id: "exp_pending", amount: 100, category: "luxury", status: "pending", deletedAt: undefined, createdAt: now - 10 * 24 * 60 * 60 * 1000 }),
      createExpense({ _id: "exp_deleted", amount: 200, category: "luxury", status: "approved", deletedAt: now - 1000, createdAt: now - 12 * 24 * 60 * 60 * 1000 }),
    ];
    const ctx = createMockCtx(validIdentity(), { expenses });
    const result = await insights.handler(ctx as never, {});

    const patternInsight = result.insights.find((i) => i.type === "spending_pattern");
    expect(patternInsight).not.toBeDefined();
    expect(result.insights[0]?.type).toBe("positive");
  });
});

describe("analytics: groupSpendingByRole", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });
  it("throws when unauthenticated", async () => {
    const { groupSpendingByRole } = await import("../../convex/functions/analytics");
    const ctx = createMockCtx(null);
    await expect(groupSpendingByRole.handler(ctx as never, {})).rejects.toThrow("Unauthenticated");
  });

  it("returns role counts and totals for paid members", async () => {
    const now = Date.now();
    const expenses = [
      createExpense({ _id: "exp_1", enteredBy: "user_1", amount: 50, category: "groceries", createdAt: now - 2 * 24 * 60 * 60 * 1000, date: new Date(now - 2 * 24 * 60 * 60 * 1000).toISOString().split("T")[0] }),
      createExpense({ _id: "exp_2", enteredBy: "user_1", amount: 30, category: "utilities", createdAt: now - 3 * 24 * 60 * 60 * 1000, date: new Date(now - 3 * 24 * 60 * 60 * 1000).toISOString().split("T")[0] }),
    ];
    const memberships = [
      { orgId: "org_1", userId: "user_1", subscriptionRole: "paying", status: "active", deletedAt: undefined },
      { orgId: "org_1", userId: "user_2", subscriptionRole: "free", status: "active", deletedAt: undefined },
    ];
    const ctx = createMockCtx(validIdentity(), { expenses, memberships });
    const { groupSpendingByRole } = await import("../../convex/functions/analytics");
    const result = await groupSpendingByRole.handler(ctx as never, {});
    expect(result.orgId).toBe("org_1");
    expect(result.byRole.paying).toBe(80);
    expect(result.byRole.free).toBe(0);
    expect(result.totalAmount).toBe(80);
  });

  it("throws when caller is not a paying member", async () => {
    const now = Date.now();
    const expenses = [
      createExpense({ _id: "exp_1", enteredBy: "user_1", amount: 50, category: "groceries", status: "approved", deletedAt: undefined, createdAt: now - 2 * 24 * 60 * 60 * 1000, date: new Date(now - 2 * 24 * 60 * 60 * 1000).toISOString().split("T")[0] }),
    ];
    const memberships = [{ orgId: "org_1", userId: "user_1", subscriptionRole: "free", status: "active", deletedAt: undefined }];
    const ctx = createMockCtx(validIdentity(), { expenses, memberships });
    const { groupSpendingByRole } = await import("../../convex/functions/analytics");
    await expect(groupSpendingByRole.handler(ctx as never, {})).rejects.toThrow(
      "Group analytics requires a paid subscription"
    );
  });
});

describe("analytics: shareEfficiency", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });
  it("throws when unauthenticated", async () => {
    const { shareEfficiency } = await import("../../convex/functions/analytics");
    const ctx = createMockCtx(null);
    await expect(shareEfficiency.handler(ctx as never, {})).rejects.toThrow("Unauthenticated");
  });

  it("returns efficiency for admin who has all spending", async () => {
    const now = Date.now();
    const expenses = [
      createExpense({ _id: "exp_1", enteredBy: "user_1", amount: 50, category: "groceries", status: "approved", deletedAt: undefined, createdAt: now - 2 * 24 * 60 * 60 * 1000, date: new Date(now - 2 * 24 * 60 * 60 * 1000).toISOString().split("T")[0], share: 50 }),
      createExpense({ _id: "exp_2", enteredBy: "user_1", amount: 30, category: "utilities", status: "approved", deletedAt: undefined, createdAt: now - 3 * 24 * 60 * 60 * 1000, date: new Date(now - 3 * 24 * 60 * 60 * 1000).toISOString().split("T")[0], share: 30 }),
    ];
    const memberships = [{ orgId: "org_1", userId: "user_1", subscriptionRole: "admin", status: "active", deletedAt: undefined }];
    const ctx = createMockCtx(validIdentity(), { expenses, memberships });
    const { shareEfficiency } = await import("../../convex/functions/analytics");
    const result = await shareEfficiency.handler(ctx as never, {});
    expect(result.efficiency.admin.count).toBe(2);
    expect(result.efficiency.admin.total).toBe(80);
    expect(result.efficiency.admin.avg).toBe(40);
    expect(result.efficiency.admin.shareTotal).toBe(80);
    expect(result.efficiency.admin.coverage).toBe(1);
  });

  it("throws when caller is free but expenses exist", async () => {
    const now = Date.now();
    const expenses = [
      createExpense({ _id: "exp_1", enteredBy: "user_1", amount: 50, category: "groceries", status: "approved", deletedAt: undefined, createdAt: now - 2 * 24 * 60 * 60 * 1000, date: new Date(now - 2 * 24 * 60 * 60 * 1000).toISOString().split("T")[0] }),
    ];
    const memberships = [{ orgId: "org_1", userId: "user_1", subscriptionRole: "free", status: "active", deletedAt: undefined }];
    const ctx = createMockCtx(validIdentity(), { expenses, memberships });
    const { shareEfficiency } = await import("../../convex/functions/analytics");
    await expect(shareEfficiency.handler(ctx as never, {})).rejects.toThrow(
      "Group analytics requires a paid subscription"
    );
  });
});

describe("analytics: memberBalances", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });
  it("throws when unauthenticated", async () => {
    const { memberBalances } = await import("../../convex/functions/analytics");
    const ctx = createMockCtx(null);
    await expect(memberBalances.handler(ctx as never, {})).rejects.toThrow("Unauthenticated");
  });

  it("returns balances for admin across all members", async () => {
    const now = Date.now();
    const expenses = [
      createExpense({ _id: "exp_1", enteredBy: "user_1", amount: 50, category: "groceries", status: "approved", deletedAt: undefined, createdAt: now - 2 * 24 * 60 * 60 * 1000, date: new Date(now - 2 * 24 * 60 * 60 * 1000).toISOString().split("T")[0], share: 50 }),
      createExpense({ _id: "exp_2", enteredBy: "user_2", amount: 30, category: "utilities", status: "approved", deletedAt: undefined, createdAt: now - 3 * 24 * 60 * 60 * 1000, date: new Date(now - 3 * 24 * 60 * 60 * 1000).toISOString().split("T")[0], share: 30 }),
    ];
    const memberships = [
      { orgId: "org_1", userId: "user_1", subscriptionRole: "admin", status: "active", deletedAt: undefined },
      { orgId: "org_1", userId: "user_2", subscriptionRole: "free", status: "active", deletedAt: undefined },
    ];
    const ctx = createMockCtx(validIdentity(), { expenses, memberships });
    const { memberBalances } = await import("../../convex/functions/analytics");
    const result = await memberBalances.handler(ctx as never, {});
    expect(result.orgId).toBe("org_1");
    expect(result.callerRole).toBe("admin");
    expect(result.balances).toHaveLength(2);
    const user1 = result.balances.find((b) => b.userId === "user_1");
    expect(user1?.totalSpent).toBe(50);
    expect(user1?.shareTotal).toBe(50);
    expect(user1?.balance).toBe(0);
    expect(user1?.expenseCount).toBe(1);
    const user2 = result.balances.find((b) => b.userId === "user_2");
    expect(user2?.totalSpent).toBe(30);
    expect(user2?.shareTotal).toBe(30);
    expect(user2?.balance).toBe(0);
  });

  it("returns only own balance for non-admin member", async () => {
    const now = Date.now();
    const expenses = [
      createExpense({ _id: "exp_1", enteredBy: "user_1", amount: 50, category: "groceries", status: "approved", deletedAt: undefined, createdAt: now - 2 * 24 * 60 * 60 * 1000, date: new Date(now - 2 * 24 * 60 * 60 * 1000).toISOString().split("T")[0], share: 50 }),
      createExpense({ _id: "exp_2", enteredBy: "user_2", amount: 30, category: "utilities", status: "approved", deletedAt: undefined, createdAt: now - 3 * 24 * 60 * 60 * 1000, date: new Date(now - 3 * 24 * 60 * 60 * 1000).toISOString().split("T")[0], share: 30 }),
    ];
    const memberships = [
      { orgId: "org_1", userId: "user_1", subscriptionRole: "paying", status: "active", deletedAt: undefined },
      { orgId: "org_1", userId: "user_2", subscriptionRole: "paying", status: "active", deletedAt: undefined },
    ];
    const ctx = createMockCtx(validIdentity(), { expenses, memberships });
    const { memberBalances } = await import("../../convex/functions/analytics");
    const result = await memberBalances.handler(ctx as never, {});
    expect(result.callerRole).toBe("paying");
    expect(result.balances).toHaveLength(1);
    expect(result.balances[0]?.userId).toBe("user_1");
    expect(result.balances[0]?.totalSpent).toBe(50);
    expect(result.balances[0]?.shareTotal).toBe(50);
    expect(result.balances[0]?.balance).toBe(0);
  });
});

describe("analytics: edge-cases", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });
  it("groupSpendingByRole: throws when caller is not a member", async () => {
    const { groupSpendingByRole } = await import("../../convex/functions/analytics");
    const ctx = createMockCtx(validIdentity());
    await expect(groupSpendingByRole.handler(ctx as never, {})).rejects.toThrow(
      "You are not a member of this organization"
    );
  });

  it("groupSpendingByRole: empty expenses", async () => {
    const memberships = [
      { orgId: "org_1", userId: "user_1", subscriptionRole: "paying", status: "active", deletedAt: undefined },
      { orgId: "org_1", userId: "user_2", subscriptionRole: "free", status: "active", deletedAt: undefined },
    ];
    const ctx = createMockCtx(validIdentity(), { expenses: [], memberships });
    const { groupSpendingByRole } = await import("../../convex/functions/analytics");
    const result = await groupSpendingByRole.handler(ctx as never, {});
    expect(result.orgId).toBe("org_1");
    expect(result.byRole).toEqual({ admin: 0, paying: 0, free: 0 });
    expect(result.roleCounts).toEqual({ paying: 1, free: 1 });
    expect(result.totalExpenses).toBe(0);
    expect(result.totalAmount).toBe(0);
  });

  it("shareEfficiency: throws when caller is not a member", async () => {
    const { shareEfficiency } = await import("../../convex/functions/analytics");
    const ctx = createMockCtx(validIdentity());
    await expect(shareEfficiency.handler(ctx as never, {})).rejects.toThrow(
      "You are not a member of this organization"
    );
  });

  it("shareEfficiency: empty expenses", async () => {
    const memberships = [{ orgId: "org_1", userId: "user_1", subscriptionRole: "admin", status: "active", deletedAt: undefined }];
    const ctx = createMockCtx(validIdentity(), { expenses: [], memberships });
    const { shareEfficiency } = await import("../../convex/functions/analytics");
    const result = await shareEfficiency.handler(ctx as never, {});
    expect(result.efficiency.admin.count).toBe(0);
    expect(result.efficiency.admin.total).toBe(0);
    expect(result.efficiency.admin.avg).toBe(0);
    expect(result.efficiency.admin.shareTotal).toBe(0);
    expect(result.efficiency.admin.coverage).toBe(0);
    expect(result.shareCoverage).toBe(0);
  });

  it("memberBalances: throws when caller is not a member", async () => {
    const { memberBalances } = await import("../../convex/functions/analytics");
    const ctx = createMockCtx(validIdentity());
    await expect(memberBalances.handler(ctx as never, {})).rejects.toThrow(
      "You are not a member of this organization"
    );
  });

  it("memberBalances: throws when free member tries without upgrade (paid gate)", async () => {
    const now = Date.now();
    const expenses = [
      createExpense({ _id: "exp_1", enteredBy: "user_1", amount: 50, category: "groceries", status: "approved", deletedAt: undefined, createdAt: now - 2 * 24 * 60 * 60 * 1000, date: new Date(now - 2 * 24 * 60 * 60 * 1000).toISOString().split("T")[0] }),
    ];
    const memberships = [
      { orgId: "org_1", userId: "user_1", subscriptionRole: "free", status: "active", deletedAt: undefined },
    ];
    const ctx = createMockCtx(validIdentity(), { expenses, memberships });
    const { memberBalances } = await import("../../convex/functions/analytics");
    await expect(memberBalances.handler(ctx as never, {})).rejects.toThrow(
      "Group analytics requires a paid subscription"
    );
  });

  it("memberBalances: empty expenses", async () => {
    const memberships = [
      { orgId: "org_1", userId: "user_1", subscriptionRole: "paying", status: "active", deletedAt: undefined },
    ];
    const ctx = createMockCtx(validIdentity(), { expenses: [], memberships });
    const { memberBalances } = await import("../../convex/functions/analytics");
    const result = await memberBalances.handler(ctx as never, {});
    expect(result.callerRole).toBe("paying");
    expect(result.balances).toHaveLength(1);
    expect(result.balances[0]?.totalSpent).toBe(0);
    expect(result.balances[0]?.shareTotal).toBe(0);
    expect(result.balances[0]?.balance).toBe(0);
    expect(result.balances[0]?.expenseCount).toBe(0);
  });

  it("groupSpendingByRole: excludes deleted and pending expenses", async () => {
    const now = Date.now();
    const expenses = [
      createExpense({ _id: "exp_1", enteredBy: "user_1", amount: 50, category: "groceries", status: "approved", deletedAt: undefined, createdAt: now - 2 * 24 * 60 * 60 * 1000 }),
      createExpense({ _id: "exp_2", enteredBy: "user_1", amount: 30, category: "utilities", status: "pending", deletedAt: undefined, createdAt: now - 3 * 24 * 60 * 60 * 1000 }),
      createExpense({ _id: "exp_3", enteredBy: "user_1", amount: 100, category: "transport", status: "approved", deletedAt: now - 1000, createdAt: now - 4 * 24 * 60 * 60 * 1000 }),
    ];
    const memberships = [{ orgId: "org_1", userId: "user_1", subscriptionRole: "paying", status: "active", deletedAt: undefined }];
    const ctx = createMockCtx(validIdentity(), { expenses, memberships });
    const { groupSpendingByRole } = await import("../../convex/functions/analytics");
    const result = await groupSpendingByRole.handler(ctx as never, {});
    expect(result.byRole.paying).toBe(50);
    expect(result.totalExpenses).toBe(1);
    expect(result.totalAmount).toBe(50);
  });

  it("shareEfficiency: excludes deleted and pending expenses", async () => {
    const now = Date.now();
    const expenses = [
      createExpense({ _id: "exp_1", enteredBy: "user_1", amount: 50, category: "groceries", status: "approved", deletedAt: undefined, createdAt: now - 2 * 24 * 60 * 60 * 1000, share: 50 }),
      createExpense({ _id: "exp_2", enteredBy: "user_1", amount: 30, category: "utilities", status: "pending", deletedAt: undefined, createdAt: now - 3 * 24 * 60 * 60 * 1000, share: 30 }),
      createExpense({ _id: "exp_3", enteredBy: "user_1", amount: 100, category: "transport", status: "approved", deletedAt: now - 1000, createdAt: now - 4 * 24 * 60 * 60 * 1000, share: 100 }),
    ];
    const memberships = [{ orgId: "org_1", userId: "user_1", subscriptionRole: "admin", status: "active", deletedAt: undefined }];
    const ctx = createMockCtx(validIdentity(), { expenses, memberships });
    const { shareEfficiency } = await import("../../convex/functions/analytics");
    const result = await shareEfficiency.handler(ctx as never, {});
    expect(result.efficiency.admin.count).toBe(1);
    expect(result.efficiency.admin.total).toBe(50);
    expect(result.efficiency.admin.shareTotal).toBe(50);
    expect(result.efficiency.admin.coverage).toBe(1);
    expect(result.totalExpenses).toBe(1);
  });

  it("memberBalances: excludes deleted and pending expenses", async () => {
    const now = Date.now();
    const expenses = [
      createExpense({ _id: "exp_1", enteredBy: "user_1", amount: 50, category: "groceries", status: "approved", deletedAt: undefined, createdAt: now - 2 * 24 * 60 * 60 * 1000, share: 50 }),
      createExpense({ _id: "exp_2", enteredBy: "user_1", amount: 30, category: "utilities", status: "pending", deletedAt: undefined, createdAt: now - 3 * 24 * 60 * 60 * 1000, share: 30 }),
      createExpense({ _id: "exp_3", enteredBy: "user_1", amount: 100, category: "transport", status: "approved", deletedAt: now - 1000, createdAt: now - 4 * 24 * 60 * 60 * 1000, share: 100 }),
    ];
    const memberships = [{ orgId: "org_1", userId: "user_1", subscriptionRole: "paying", status: "active", deletedAt: undefined }];
    const ctx = createMockCtx(validIdentity(), { expenses, memberships });
    const { memberBalances } = await import("../../convex/functions/analytics");
    const result = await memberBalances.handler(ctx as never, {});
    expect(result.balances).toHaveLength(1);
    expect(result.balances[0]?.totalSpent).toBe(50);
    expect(result.balances[0]?.shareTotal).toBe(50);
    expect(result.balances[0]?.balance).toBe(0);
    expect(result.balances[0]?.expenseCount).toBe(1);
  });

  it("groupSpendingByRole: throws when membership is pending (not active)", async () => {
    const memberships = [{ orgId: "org_1", userId: "user_1", subscriptionRole: "paying", status: "pending", deletedAt: undefined }];
    const ctx = createMockCtx(validIdentity(), { memberships });
    const { groupSpendingByRole } = await import("../../convex/functions/analytics");
    await expect(groupSpendingByRole.handler(ctx as never, {})).rejects.toThrow(
      "You are not a member of this organization"
    );
  });

  it("shareEfficiency: throws when membership is pending (not active)", async () => {
    const memberships = [{ orgId: "org_1", userId: "user_1", subscriptionRole: "admin", status: "suspended", deletedAt: undefined }];
    const ctx = createMockCtx(validIdentity(), { memberships });
    const { shareEfficiency } = await import("../../convex/functions/analytics");
    await expect(shareEfficiency.handler(ctx as never, {})).rejects.toThrow(
      "You are not a member of this organization"
    );
  });

  it("memberBalances: throws when org subscription is canceled", async () => {
    const memberships = [{ orgId: "org_1", userId: "user_1", subscriptionRole: "paying", status: "active", deletedAt: undefined }];
    const subscriptions = [{ orgId: "org_1", plan: "pro", status: "canceled" }];
    const ctx = createMockCtx(validIdentity(), { memberships, subscriptions });
    const { memberBalances } = await import("../../convex/functions/analytics");
    await expect(memberBalances.handler(ctx as never, {})).rejects.toThrow(
      "Group analytics requires a paid subscription"
    );
  });

  it("memberBalances: throws when org subscription is past_due", async () => {
    const memberships = [{ orgId: "org_1", userId: "user_1", subscriptionRole: "paying", status: "active", deletedAt: undefined }];
    const subscriptions = [{ orgId: "org_1", plan: "pro", status: "past_due" }];
    const ctx = createMockCtx(validIdentity(), { memberships, subscriptions });
    const { memberBalances } = await import("../../convex/functions/analytics");
    await expect(memberBalances.handler(ctx as never, {})).rejects.toThrow(
      "Group analytics requires a paid subscription"
    );
  });

  it("memberBalances: allows org subscription trialing/local_test/active", async () => {
    const memberships = [{ orgId: "org_1", userId: "user_1", subscriptionRole: "paying", status: "active", deletedAt: undefined }];
    for (const status of ["trialing", "local_test", "active"]) {
      const subscriptions = [{ orgId: "org_1", plan: "pro", status }];
      const ctx = createMockCtx(validIdentity(), { memberships, subscriptions });
      const { memberBalances } = await import("../../convex/functions/analytics");
      const result = await memberBalances.handler(ctx as never, {});
      expect(result.callerRole).toBe("paying");
    }
  });
});