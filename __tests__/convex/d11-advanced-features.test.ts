import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../convex/_generated/server", () => {
  const internalFn = (config: { handler: (ctx: unknown, args: unknown) => Promise<unknown> }) => ({
    ...config,
    handler: config.handler.bind(config),
  });
  return {
    mutationGeneric: (config: { handler: (ctx: unknown, args: unknown) => Promise<unknown> }) => ({
      ...config,
      handler: config.handler.bind(config),
    }),
    queryGeneric: (config: { handler: (ctx: unknown, args: unknown) => Promise<unknown> }) => ({
      ...config,
      handler: config.handler.bind(config),
    }),
    internalMutationGeneric: internalFn,
    internalQueryGeneric: internalFn,
    internalMutation: internalFn,
    internalQuery: internalFn,
    internalAction: internalFn,
    internal: internalFn,
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
    defineInternal: (config: { handler: (ctx: unknown, args: unknown) => Promise<unknown> }) => ({
      ...config,
      handler: config.handler.bind(config),
    }),
  };
});

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
    record: () => ({ _isValidator: true }),
    any: () => ({ _isValidator: true }),
    unknown: () => ({ _isValidator: true }),
  },
}));

function createFilterBuilder(doc: Record<string, unknown>): { field: (name: string) => unknown; eq: (field: string, value: unknown) => boolean; gte: (field: string, value: unknown) => boolean; neq: (field: string, value: unknown) => boolean } {
  return {
    field: (name: string) => name,
    eq: (field: string, value: unknown) => (doc[field] === value),
    gte: (field: string, value: unknown) => (doc[field] !== undefined && doc[field] >= value),
    neq: (field: string, value: unknown) => (doc[field] !== value),
  };
}

interface QueryChain {
  withIndex: (name: string, fn?: (q: { eq: (field: string, value: unknown) => unknown }) => unknown) => QueryChain;
  filter: (fn: (q: { eq: (field: string, value: unknown) => boolean; gte: (field: string, value: unknown) => boolean; lte: (field: string, value: unknown) => boolean; field: (name: string) => unknown }) => boolean) => QueryChain;
  order: (order: "asc" | "desc") => QueryChain;
  take: (limit: number) => Promise<unknown[]>;
  collect: () => unknown[];
  first: () => unknown | null;
}

function createQueryChain(results: unknown[] = []): QueryChain {
  let filtered = results.slice();
  const constraints: Array<{ field: string; value: unknown }> = [];
  const chainable: QueryChain = {
    withIndex: (_name: string, fn?: (q: { eq: (field: string, value: unknown) => unknown }) => unknown) => {
      if (fn) {
        const builder = {
          eq: (field: string, value: unknown) => {
            constraints.push({ field, value });
            return builder;
          },
        };
        fn(builder);
        if (constraints.length > 0) {
          filtered = filtered.filter((doc) =>
            constraints.every((c) => (doc as Record<string, unknown>)[c.field] === c.value)
          );
        }
      }
      return chainable;
    },
    filter: (fn: (q: { eq: (field: string, value: unknown) => boolean; gte: (field: string, value: unknown) => boolean; lte: (field: string, value: unknown) => boolean; field: (name: string) => unknown }) => boolean) => {
      filtered = filtered.filter((doc) =>
        fn(createFilterBuilder(doc as Record<string, unknown>))
      );
      return chainable;
    },
    order: () => chainable,
    take: async (_limit: number) => filtered,
    collect: () => filtered,
    first: () => filtered[0] || null,
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
    delete: (id: string) => Promise<void>;
  };
  scheduler: {
    runAfter: vi.ReturnType<typeof vi.fn>;
  };
  _patchCalls?: Array<{ id: string; data: Record<string, unknown> }>;
  _insertCalls?: Array<Record<string, unknown>>;
  _deleteCalls?: Array<string>;
}

function createMockCtx(
  user: MockIdentity | null,
  options?: {
    categories?: unknown[];
    budgets?: unknown[];
    expenses?: unknown[];
    categoryToGet?: unknown;
    budgetToGet?: unknown;
  }
): MockCtx {
  const ctx: MockCtx = {
    auth: {
      getUserIdentity: () => Promise.resolve(user),
    },
    db: {
      query: (table: string) => {
        if (table === "memberships") {
          return createQueryChain([{
            orgId: user?.org_id || "org_1",
            userId: user?.subject || "user_1",
            role: "admin",
            status: "active",
          }]);
        }
        const tableData: Record<string, unknown[]> = {
          categories: options?.categories ?? [],
          budgets: options?.budgets ?? [],
          expenses: options?.expenses ?? [],
        };
        return createQueryChain(tableData[table] ?? []);
      },
      get: () => Promise.resolve(options?.categoryToGet ?? options?.budgetToGet ?? null),
      patch: (_id: string, _data: Record<string, unknown>) => Promise.resolve(),
      insert: (_table: string, _data: Record<string, unknown>) => Promise.resolve("mock_id"),
      delete: (_id: string) => Promise.resolve(),
    },
    scheduler: {
      runAfter: vi.fn(),
    },
    _patchCalls: [],
    _insertCalls: [],
    _deleteCalls: [],
  };
  ctx.db.patch = function(_id: string, data: Record<string, unknown>) {
    ctx._patchCalls!.push({ id: _id, data });
    return Promise.resolve();
  };
  ctx.db.insert = function(_table: string, data: Record<string, unknown>) {
    ctx._insertCalls!.push(data);
    return Promise.resolve("mock_id");
  };
  ctx.db.delete = function(_id: string) {
    ctx._deleteCalls!.push(_id);
    return Promise.resolve();
  };
  return ctx;
}

function validIdentity(): MockIdentity {
  return { subject: "user_1", org_id: "org_1", tokenIdentifier: "clerk:org_1|user_1" };
}

describe("categories:create", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("throws when unauthenticated", async () => {
    const { create } = await import("../../convex/categories");
    const ctx = createMockCtx(null);
    await expect(create.handler(ctx as never, { name: "Food", color: "#10b981" }))
      .rejects.toThrow("Unauthenticated");
  });

  it("creates category with orgId from auth", async () => {
    const { create } = await import("../../convex/categories");
    const ctx = createMockCtx(validIdentity());
    const result = await create.handler(ctx as never, { name: "Food", color: "#10b981" });
    expect(typeof result).toBe("string");
    expect(ctx._insertCalls![0]).toMatchObject({
      orgId: "org_1",
      name: "Food",
      color: "#10b981",
      createdBy: "user_1",
    });
  });

  it("rejects duplicate category name", async () => {
    const { create } = await import("../../convex/categories");
    const existing = [{ _id: "cat1", orgId: "org_1", name: "Food", color: "#10b981" }];
    const ctx = createMockCtx(validIdentity(), { categories: existing });
    await expect(create.handler(ctx as never, { name: "Food", color: "#ff0000" }))
      .rejects.toThrow("already exists");
  });
});

describe("categories:list", () => {
  it("throws when unauthenticated", async () => {
    const { list } = await import("../../convex/categories");
    const ctx = createMockCtx(null);
    await expect(list.handler(ctx as never, {})).rejects.toThrow("Unauthenticated");
  });

  it("returns categories for orgId from auth", async () => {
    const { list } = await import("../../convex/categories");
    const cats = [
      { _id: "cat1", orgId: "org_1", name: "Food", color: "#10b981" },
      { _id: "cat2", orgId: "org_1", name: "Transport", color: "#ff0000" },
    ];
    const ctx = createMockCtx(validIdentity(), { categories: cats });
    const result = await list.handler(ctx as never, {});
    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(2);
  });

  it("filters out other orgs' categories", async () => {
    const { list } = await import("../../convex/categories");
    const cats = [
      { _id: "cat1", orgId: "org_other", name: "Other Food", color: "#10b981" },
      { _id: "cat2", orgId: "org_1", name: "Food", color: "#ff0000" },
    ];
    const ctx = createMockCtx(validIdentity(), { categories: cats });
    const result = await list.handler(ctx as never, {});
    expect(result).toHaveLength(1);
  });
});

describe("categories:update", () => {
  it("throws when unauthenticated", async () => {
    const { update } = await import("../../convex/categories");
    const ctx = createMockCtx(null);
    await expect(update.handler(ctx as never, { id: "cat1", name: "New" }))
      .rejects.toThrow("Unauthenticated");
  });

  it("throws when category belongs to different org", async () => {
    const { update } = await import("../../convex/categories");
    const cat = { _id: "cat1", orgId: "org_other", name: "Food" };
    const ctx = createMockCtx(validIdentity(), { categoryToGet: cat });
    await expect(update.handler(ctx as never, { id: "cat1", name: "New" }))
      .rejects.toThrow("Access denied");
  });

  it("updates category and patches", async () => {
    const { update } = await import("../../convex/categories");
    const cat = { _id: "cat1", orgId: "org_1", name: "Food", color: "#10b981" };
    const ctx = createMockCtx(validIdentity(), { categoryToGet: cat });
    await update.handler(ctx as never, { id: "cat1", name: "Groceries" });
    expect(ctx._patchCalls![0].data.name).toBe("Groceries");
  });
});

describe("categories:delete", () => {
  it("throws when unauthenticated", async () => {
    const { deleteCategory } = await import("../../convex/categories");
    const ctx = createMockCtx(null);
    await expect(deleteCategory.handler(ctx as never, { id: "cat1" }))
      .rejects.toThrow("Unauthenticated");
  });

  it("throws when category belongs to different org", async () => {
    const { deleteCategory } = await import("../../convex/categories");
    const cat = { _id: "cat1", orgId: "org_other", name: "Food" };
    const ctx = createMockCtx(validIdentity(), { categoryToGet: cat });
    await expect(deleteCategory.handler(ctx as never, { id: "cat1" }))
      .rejects.toThrow("Access denied");
  });

  it("deletes category and patches expenses", async () => {
    const { deleteCategory } = await import("../../convex/categories");
    const cat = { _id: "cat1", orgId: "org_1", name: "Food" };
    const ctx = createMockCtx(validIdentity(), {
      categoryToGet: cat,
      expenses: [{ _id: "exp1", orgId: "org_1", category: "Food", deletedAt: undefined }],
    });
    await deleteCategory.handler(ctx as never, { id: "cat1" });
    expect(ctx._deleteCalls![0]).toBe("cat1");
    expect(ctx._patchCalls![0].data.category).toBe("Other");
  });
});

describe("budgets:create", () => {
  it("throws when unauthenticated", async () => {
    const { createBudget } = await import("../../convex/budgets");
    const ctx = createMockCtx(null);
    await expect(createBudget.handler(ctx as never, { category: "Food", amount: 50000, period: "monthly", alertThreshold: 80 }))
      .rejects.toThrow("Unauthenticated");
  });

  it("creates budget with orgId from auth", async () => {
    const { createBudget } = await import("../../convex/budgets");
    const ctx = createMockCtx(validIdentity());
    const result = await createBudget.handler(ctx as never, { category: "Food", amount: 50000, period: "monthly", alertThreshold: 80 });
    expect(typeof result).toBe("string");
    expect(ctx._insertCalls![0]).toMatchObject({
      orgId: "org_1",
      category: "Food",
      amount: 50000,
      period: "monthly",
      alertThreshold: 80,
      alertSent: false,
      createdBy: "user_1",
    });
  });

  it("triggers checkBudget scheduler", async () => {
    const { createBudget } = await import("../../convex/budgets");
    const ctx = createMockCtx(validIdentity());
    await createBudget.handler(ctx as never, { category: "Food", amount: 50000, period: "monthly", alertThreshold: 80 });
    expect(ctx.scheduler.runAfter).toHaveBeenCalled();
  });
});

describe("budgets:list", () => {
  it("throws when unauthenticated", async () => {
    const { list } = await import("../../convex/budgets");
    const ctx = createMockCtx(null);
    await expect(list.handler(ctx as never, {})).rejects.toThrow("Unauthenticated");
  });

  it("returns budgets for orgId from auth", async () => {
    const { list } = await import("../../convex/budgets");
    const budgets = [
      { _id: "bud1", orgId: "org_1", category: "Food", amount: 50000 },
      { _id: "bud2", orgId: "org_1", category: "Transport", amount: 30000 },
    ];
    const ctx = createMockCtx(validIdentity(), { budgets });
    const result = await list.handler(ctx as never, {});
    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(2);
  });
});

describe("budgets:update", () => {
  it("throws when unauthenticated", async () => {
    const { updateBudget } = await import("../../convex/budgets");
    const ctx = createMockCtx(null);
    await expect(updateBudget.handler(ctx as never, { id: "bud1", amount: 60000 }))
      .rejects.toThrow("Unauthenticated");
  });

  it("throws when budget belongs to different org", async () => {
    const { updateBudget } = await import("../../convex/budgets");
    const budget = { _id: "bud1", orgId: "org_other", category: "Food", amount: 50000 };
    const ctx = createMockCtx(validIdentity(), { budgetToGet: budget });
    await expect(updateBudget.handler(ctx as never, { id: "bud1", amount: 60000 }))
      .rejects.toThrow("Access denied");
  });

  it("resets alertSent flag on update", async () => {
    const { updateBudget } = await import("../../convex/budgets");
    const budget = { _id: "bud1", orgId: "org_1", category: "Food", amount: 50000, alertSent: true };
    const ctx = createMockCtx(validIdentity(), { budgetToGet: budget });
    await updateBudget.handler(ctx as never, { id: "bud1", amount: 60000 });
    expect(ctx._patchCalls![0].data.alertSent).toBe(false);
  });
});

describe("budgets:delete", () => {
  it("throws when unauthenticated", async () => {
    const { deleteBudget } = await import("../../convex/budgets");
    const ctx = createMockCtx(null);
    await expect(deleteBudget.handler(ctx as never, { id: "bud1" }))
      .rejects.toThrow("Unauthenticated");
  });

  it("throws when budget belongs to different org", async () => {
    const { deleteBudget } = await import("../../convex/budgets");
    const budget = { _id: "bud1", orgId: "org_other", category: "Food", amount: 50000 };
    const ctx = createMockCtx(validIdentity(), { budgetToGet: budget });
    await expect(deleteBudget.handler(ctx as never, { id: "bud1" }))
      .rejects.toThrow("Access denied");
  });
});

describe("budgets:checkBudget (SEC-007)", () => {
  it("is internal mutation", async () => {
    const { checkBudget } = await import("../../convex/budgets");
    expect(checkBudget).toBeDefined();
  });

  it("throws when unauthenticated", async () => {
    const { checkBudget } = await import("../../convex/budgets");
    const ctx = createMockCtx(null);
    await expect(checkBudget.handler(ctx as never, { budgetId: "bud1" }))
      .rejects.toThrow("Unauthenticated");
  });

  it("calculates spending and sends alert when threshold exceeded", async () => {
    const { checkBudget } = await import("../../convex/budgets");
    const budget = {
      _id: "bud1",
      orgId: "org_1",
      category: "Food",
      amount: 50000,
      alertThreshold: 80,
      alertSent: false,
      period: "monthly",
    };
    const expenses = [
      { _id: "exp1", orgId: "org_1", date: "2026-11-15", category: "Food", amount: 45000, status: "approved", deletedAt: undefined },
    ];
    const ctx = createMockCtx(validIdentity(), { budgetToGet: budget, expenses });
    ctx.db.get = () => Promise.resolve(budget);
    await checkBudget.handler(ctx as never, { budgetId: "bud1" });
    expect(ctx._patchCalls![0].data.alertSent).toBe(true);
  });

  it("does not alert when threshold not exceeded", async () => {
    const { checkBudget } = await import("../../convex/budgets");
    const budget = {
      _id: "bud1",
      orgId: "org_1",
      category: "Food",
      amount: 50000,
      alertThreshold: 80,
      alertSent: false,
      period: "monthly",
    };
    const expenses = [
      { _id: "exp1", orgId: "org_1", category: "Food", amount: 30000, status: "approved", deletedAt: undefined },
    ];
    const ctx = createMockCtx(validIdentity(), { budgetToGet: budget, expenses });
    ctx.db.get = () => Promise.resolve(budget);
    await checkBudget.handler(ctx as never, { budgetId: "bud1" });
    expect(ctx._patchCalls!.find((c) => c.data.alertSent)).toBeUndefined();
  });

  it("skips soft-deleted expenses", async () => {
    const { checkBudget } = await import("../../convex/budgets");
    const budget = {
      _id: "bud1",
      orgId: "org_1",
      category: "Food",
      amount: 50000,
      alertThreshold: 80,
      alertSent: false,
      period: "monthly",
    };
    const expenses = [
      { _id: "exp1", orgId: "org_1", category: "Food", amount: 45000, status: "approved", deletedAt: Date.now() },
    ];
    const ctx = createMockCtx(validIdentity(), { budgetToGet: budget, expenses });
    ctx.db.get = () => Promise.resolve(budget);
    await checkBudget.handler(ctx as never, { budgetId: "bud1" });
    expect(ctx._patchCalls!.find((c) => c.data.alertSent)).toBeUndefined();
  });
});

describe("reports:generate", () => {
  it("throws when unauthenticated", async () => {
    const { generateReport } = await import("../../convex/reports");
    const ctx = createMockCtx(null);
    await expect(generateReport.handler(ctx as never, {}))
      .rejects.toThrow("Unauthenticated");
  });

  it("returns expenses scoped by orgId", async () => {
    const { generateReport } = await import("../../convex/reports");
    const expenses = [
      { _id: "exp1", orgId: "org_1", date: "2024-01-15", category: "Food", amount: 1000, status: "approved", deletedAt: undefined },
      { _id: "exp2", orgId: "org_other", date: "2024-01-15", category: "Food", amount: 9999, status: "approved", deletedAt: undefined },
    ];
    const ctx = createMockCtx(validIdentity(), { expenses });
    const result = await generateReport.handler(ctx as never, {});
    expect(result).toHaveLength(1);
  });
});

describe("reports:exportCsv", () => {
  it("throws when unauthenticated", async () => {
    const { exportReportCsv } = await import("../../convex/reports");
    const ctx = createMockCtx(null);
    await expect(exportReportCsv.handler(ctx as never, {}))
      .rejects.toThrow("Unauthenticated");
  });

  it("returns CSV with header row", async () => {
    const { exportReportCsv } = await import("../../convex/reports");
    const expenses = [
      { _id: "exp1", orgId: "org_1", date: "2024-01-15", category: "Food", amount: 1000, paidBy: "Alice", status: "approved", notes: "Lunch", receiptImageId: null, deletedAt: undefined },
    ];
    const ctx = createMockCtx(validIdentity(), { expenses });
    const result = await exportReportCsv.handler(ctx as never, {});
    expect(result).toContain("Date,Category,Amount,Status,Has Receipt");
  });
});

describe("reports:getExpenseSummary", () => {
  it("throws when unauthenticated", async () => {
    const { getExpenseSummary } = await import("../../convex/reports");
    const ctx = createMockCtx(null);
    await expect(getExpenseSummary.handler(ctx as never, {}))
      .rejects.toThrow("Unauthenticated");
  });

  it("returns summary scoped by orgId", async () => {
    const { getExpenseSummary } = await import("../../convex/reports");
    const expenses = [
      { _id: "exp1", orgId: "org_1", category: "Food", amount: 1000, status: "approved", paidBy: "Alice", date: "2024-01-15", deletedAt: undefined },
    ];
    const ctx = createMockCtx(validIdentity(), { expenses });
    const result = await getExpenseSummary.handler(ctx as never, {}) as { total: number; byCategory: Record<string, number> };
    expect(result.total).toBe(1000);
    expect(result.byCategory).toEqual({ Food: 1000 });
  });
});

describe("reports:getExpenseSummary excludes deleted", () => {
  it("excludes deleted expenses from summary", async () => {
    const { getExpenseSummary } = await import("../../convex/reports");
    const expenses = [
      { _id: "exp1", orgId: "org_1", category: "Food", amount: 1000, status: "approved", paidBy: "Alice", date: "2024-01-15", deletedAt: Date.now() },
    ];
    const ctx = createMockCtx(validIdentity(), { expenses });
    const result = await getExpenseSummary.handler(ctx as never, {}) as { total: number };
    expect(result.total).toBe(0);
  });
});

describe("reports:D21-export", () => {
  const validId = { subject: "user_1", org_id: "org_1", tokenIdentifier: "clerk:org_1|user_1" };

  function createStorageCtx(user: typeof validId | null, options?: {
    expenses?: unknown[];
    settlements?: unknown[];
    budgets?: unknown[];
    reportDoc?: unknown;
  }) {
    const patchCalls: Array<{ id: string; data: Record<string, unknown> }> = [];
    const insertCalls: Array<Record<string, unknown>> = [];
    const deleteCalls: string[] = [];
    const storedContents: string[] = [];

    const ctx = {
      auth: { getUserIdentity: () => Promise.resolve(user) },
      db: {
        query: (table: string) => {
          const tableData: Record<string, unknown[]> = {
            expenses: options?.expenses ?? [],
            settlements: options?.settlements ?? [],
            budgets: options?.budgets ?? [],
            reports: [],
          };
          return createQueryChain(tableData[table] ?? []);
        },
        get: () => Promise.resolve(options?.reportDoc ?? null),
        patch: (id: string, data: Record<string, unknown>) => {
          patchCalls.push({ id, data });
          return Promise.resolve();
        },
        insert: (_table: string, data: Record<string, unknown>) => {
          insertCalls.push(data);
          return Promise.resolve("mock_id");
        },
        delete: (id: string) => {
          deleteCalls.push(id);
          return Promise.resolve();
        },
      },
      storage: {
        store: async (file: File, _contentType: string) => {
          const text = await file.text();
          storedContents.push(text);
          return "mock_storage_id";
        },
        getUrl: async () => "https://example.com/signed?expires=123",
      },
      scheduler: { runAfter: vi.fn() },
      _patchCalls: patchCalls,
      _insertCalls: insertCalls,
      _deleteCalls: deleteCalls,
      _storedContents: storedContents,
    };
    return ctx;
  }

  function reportDoc(overrides: Record<string, unknown> = {}) {
    return {
      _id: "report1",
      orgId: "org_1",
      userId: "user_1",
      name: "Report",
      type: "monthly_summary",
      config: {},
      format: "csv",
      status: "generating",
      createdAt: Date.now(),
      ...overrides,
    };
  }

  it("throws when unauthenticated", async () => {
    const { generateReport } = await import("../../convex/functions/reports");
    const ctx = createStorageCtx(null, { reportDoc: reportDoc() });
    await expect(generateReport.handler(ctx as never, { reportId: "report1" })).rejects.toThrow("Unauthenticated");
  });

  it("generates csv monthly summary with correct content", async () => {
    const { generateReport } = await import("../../convex/functions/reports");
    const expenses = [
      { _id: "exp1", orgId: "org_1", date: "2024-01-15", category: "Food", amount: 1000, status: "approved", paidBy: "Alice", deletedAt: undefined },
      { _id: "exp2", orgId: "org_1", date: "2024-01-16", category: "Rent", amount: 2000, status: "approved", paidBy: "Bob", deletedAt: undefined },
    ];
    const ctx = createStorageCtx(validId, { expenses, reportDoc: reportDoc() });
    const result = await generateReport.handler(ctx as never, { reportId: "report1" });
    expect(result.storageId).toBe("mock_storage_id");
    expect(result.downloadUrl).toContain("signed");
    expect(ctx._storedContents[0]).toContain("Month,Total ($)");
    expect(ctx._storedContents[0]).toContain("2024-01,30.00");
    expect(ctx._patchCalls.some((p) => p.data.status === "ready")).toBe(true);
  });

  it("generates csv budget variance with correct content", async () => {
    const { generateReport } = await import("../../convex/functions/reports");
    const expenses = [
      { _id: "exp1", orgId: "org_1", date: "2024-01-15", category: "Food", amount: 1000, status: "approved", paidBy: "Alice", deletedAt: undefined },
    ];
    const budgets = [
      { _id: "bud1", orgId: "org_1", category: "Food", amount: 5000, period: "monthly", alertThreshold: 80, alertSent: false, createdBy: "admin", createdAt: Date.now(), updatedAt: Date.now(), deletedAt: undefined },
    ];
    const ctx = createStorageCtx(validId, { expenses, budgets, reportDoc: reportDoc({ type: "budget_variance" }) });
    await generateReport.handler(ctx as never, { reportId: "report1" });
    expect(ctx._storedContents[0]).toContain("Budget ($)");
    expect(ctx._storedContents[0]).toContain("Food,50.00,10.00,-40.00,20.0");
  });

  it("generates csv settlement history with correct content", async () => {
    const { generateReport } = await import("../../convex/functions/reports");
    const settlements = [
      { _id: "sett1", orgId: "org_1", amount: 500, fromUser: "Alice", toUser: "Bob", date: "2024-01-15", createdAt: Date.now(), updatedAt: Date.now(), deletedAt: undefined },
    ];
    const ctx = createStorageCtx(validId, { settlements, reportDoc: reportDoc({ type: "settlement_history" }) });
    await generateReport.handler(ctx as never, { reportId: "report1" });
    expect(ctx._storedContents[0]).toContain("Date,From,To,Amount");
    expect(ctx._storedContents[0]).toContain("2024-01-15,Alice,Bob,5.00");
  });

  it("generates json format for category breakdown", async () => {
    const { generateReport } = await import("../../convex/functions/reports");
    const expenses = [
      { _id: "exp1", orgId: "org_1", date: "2024-01-15", category: "Food", amount: 1000, status: "approved", paidBy: "Alice", deletedAt: undefined },
    ];
    const ctx = createStorageCtx(validId, { expenses, reportDoc: reportDoc({ type: "category_breakdown", format: "json" }) });
    await generateReport.handler(ctx as never, { reportId: "report1" });
    const parsed = JSON.parse(ctx._storedContents[0] ?? "{}");
    expect(parsed.data[0]).toEqual({ category: "Food", amount: 10 });
  });

  it("throws when report not found", async () => {
    const { generateReport } = await import("../../convex/functions/reports");
    const ctx = createStorageCtx(validId, { reportDoc: null });
    await expect(generateReport.handler(ctx as never, { reportId: "nonexistent" })).rejects.toThrow("Report not found");
  });

  it("throws when org mismatch", async () => {
    const { generateReport } = await import("../../convex/functions/reports");
    const ctx = createStorageCtx(validId, { reportDoc: reportDoc({ orgId: "org_2" }) });
    await expect(generateReport.handler(ctx as never, { reportId: "report1" })).rejects.toThrow("Report not found");
  });

  it("throws when user mismatch", async () => {
    const { generateReport } = await import("../../convex/functions/reports");
    const ctx = createStorageCtx(validId, { reportDoc: reportDoc({ userId: "user_2" }) });
    await expect(generateReport.handler(ctx as never, { reportId: "report1" })).rejects.toThrow("Report not found");
  });

  it("schedules a report", async () => {
    const { scheduleReport } = await import("../../convex/functions/reports");
    const ctx = createStorageCtx(validId);
    const result = await scheduleReport.handler(ctx as never, { name: "Monthly Budget", type: "budget_variance", config: {}, format: "csv", scheduleCron: "0 6 * * *" });
    expect(result.id).toBe("mock_id");
    const inserted = ctx._insertCalls[0];
    expect(inserted).toMatchObject({ orgId: "org_1", userId: "user_1", scheduled: true, scheduleCron: "0 6 * * *" });
  });

  it("unschedules a report", async () => {
    const { unscheduleReport } = await import("../../convex/functions/reports");
    const ctx = createStorageCtx(validId, { reportDoc: reportDoc() });
    const result = await unscheduleReport.handler(ctx as never, { reportId: "report1" });
    expect(result.success).toBe(true);
    expect(ctx._patchCalls[0]?.data).toMatchObject({ scheduled: false });
  });

  it("unschedule rejects for wrong user", async () => {
    const { unscheduleReport } = await import("../../convex/functions/reports");
    const ctx = createStorageCtx(validId, { reportDoc: reportDoc({ userId: "user_2" }) });
    await expect(unscheduleReport.handler(ctx as never, { reportId: "report1" })).rejects.toThrow("Report not found");
  });

  it("getDownloadUrl requires report ready", async () => {
    const { getDownloadUrl } = await import("../../convex/functions/reports");
    const ctx = createStorageCtx(validId, { reportDoc: reportDoc({ status: "generating" }) });
    await expect(getDownloadUrl.handler(ctx as never, { reportId: "report1" })).rejects.toThrow("Report not ready");
  });

  it("getDownloadUrl returns signed URL when ready", async () => {
    const { getDownloadUrl } = await import("../../convex/functions/reports");
    const ctx = createStorageCtx(validId, { reportDoc: reportDoc({ status: "ready", storageId: "mock_storage_id" }) });
    const result = await getDownloadUrl.handler(ctx as never, { reportId: "report1" });
    expect(result.downloadUrl).toBe("https://example.com/signed?expires=123");
  });

  it("deleteReport removes report", async () => {
    const { deleteReport } = await import("../../convex/functions/reports");
    const ctx = createStorageCtx(validId, { reportDoc: reportDoc({ status: "ready", storageId: "mock_storage_id" }) });
    const result = await deleteReport.handler(ctx as never, { reportId: "report1" });
    expect(result.success).toBe(true);
    expect(ctx._deleteCalls).toContain("report1");
  });

  it("deleteReport rejects for wrong org", async () => {
    const { deleteReport } = await import("../../convex/functions/reports");
    const ctx = createStorageCtx(validId, { reportDoc: reportDoc({ orgId: "org_2" }) });
    await expect(deleteReport.handler(ctx as never, { reportId: "report1" })).rejects.toThrow("Report not found");
  });
});

describe("reports:createReport", () => {
  const validId = { subject: "user_1", org_id: "org_1", tokenIdentifier: "clerk:org_1|user_1" };

  function createStorageCtx(user: typeof validId | null, options?: {
    expenses?: unknown[];
    settlements?: unknown[];
    budgets?: unknown[];
    reportDoc?: unknown;
  }) {
    const patchCalls: Array<{ id: string; data: Record<string, unknown> }> = [];
    const insertCalls: Array<Record<string, unknown>> = [];
    const storedContents: string[] = [];

    const ctx = {
      auth: { getUserIdentity: () => Promise.resolve(user) },
      db: {
        query: (table: string) => {
          const tableData: Record<string, unknown[]> = {
            expenses: options?.expenses ?? [],
            settlements: options?.settlements ?? [],
            budgets: options?.budgets ?? [],
            reports: [],
          };
          return createQueryChain(tableData[table] ?? []);
        },
        get: () => Promise.resolve(options?.reportDoc ?? null),
        patch: (id: string, data: Record<string, unknown>) => {
          patchCalls.push({ id, data });
          return Promise.resolve();
        },
        insert: (_table: string, data: Record<string, unknown>) => {
          insertCalls.push(data);
          return Promise.resolve("mock_id");
        },
        delete: (_id: string) => Promise.resolve(),
      },
      storage: {
        store: async (_file: File) => { storedContents.push(""); return "mock_storage_id"; },
        getUrl: async () => "https://example.com/signed?expires=123",
      },
      scheduler: { runAfter: vi.fn() },
      _patchCalls: patchCalls,
      _insertCalls: insertCalls,
      _storedContents: storedContents,
    };
    return ctx;
  }

  function reportDoc(overrides: Record<string, unknown> = {}) {
    return {
      _id: "report1",
      orgId: "org_1",
      userId: "user_1",
      name: "Report",
      type: "monthly_summary",
      config: {},
      format: "csv",
      status: "generating",
      createdAt: Date.now(),
      ...overrides,
    };
  }

  it("throws when unauthenticated", async () => {
    const { createReport } = await import("../../convex/functions/reports");
    const ctx = createStorageCtx(null, { reportDoc: reportDoc() });
    await expect(createReport.handler(ctx as never, { name: "R", type: "monthly_summary", config: {}, format: "csv" })).rejects.toThrow("Unauthenticated");
  });

  it("creates report, generates content, stores and patches", async () => {
    const { createReport } = await import("../../convex/functions/reports");
    const expenses = [
      { _id: "exp1", orgId: "org_1", date: "2024-01-15", category: "Food", amount: 1000, status: "approved", paidBy: "Alice", deletedAt: undefined },
    ];
    const ctx = createStorageCtx(validId, { expenses, reportDoc: reportDoc() });
    const result = await createReport.handler(ctx as never, { name: "Monthly Summary", type: "monthly_summary", config: {}, format: "csv" });
    expect(result.id).toBe("mock_id");
    expect(result.storageId).toBe("mock_storage_id");
    expect(result.downloadUrl).toContain("signed");
    const inserted = ctx._insertCalls[0];
    expect(inserted).toMatchObject({ orgId: "org_1", userId: "user_1", type: "monthly_summary", status: "generating" });
    expect(ctx._storedContents.length).toBeGreaterThan(0);
    expect(ctx._patchCalls.some((p) => p.data.status === "ready")).toBe(true);
  });
});

describe("reports:listReports", () => {
  const validId = { subject: "user_1", org_id: "org_1", tokenIdentifier: "clerk:org_1|user_1" };

  function createCtx(user: typeof validId | null, reports: unknown[] = []) {
    const patchCalls: Array<{ id: string; data: Record<string, unknown> }> = [];
    const ctx = {
      auth: { getUserIdentity: () => Promise.resolve(user) },
      db: {
        query: (_table: string) => {
          const tableData: Record<string, unknown[]> = { reports };
          return createQueryChain(tableData.reports ?? []);
        },
        patch: (id: string, data: Record<string, unknown>) => {
          patchCalls.push({ id, data });
          return Promise.resolve();
        },
        get: () => Promise.resolve(null),
        insert: () => Promise.resolve("mock_id"),
        delete: () => Promise.resolve(),
      },
      _patchCalls: patchCalls,
    };
    return ctx;
  }

  it("throws when unauthenticated", async () => {
    const { listReports } = await import("../../convex/functions/reports");
    const ctx = createCtx(null);
    await expect(listReports.handler(ctx as never, {})).rejects.toThrow("Unauthenticated");
  });

  it("returns reports matching orgId and userId", async () => {
    const { listReports } = await import("../../convex/functions/reports");
    const reports = [
      { _id: "r1", orgId: "org_1", userId: "user_1", name: "Report 1" },
      { _id: "r2", orgId: "org_1", userId: "user_1", name: "Report 2" },
      { _id: "r3", orgId: "org_2", userId: "user_1", name: "Other org" },
    ];
    const ctx = createCtx(validId, reports);
    const result = await listReports.handler(ctx as never, {});
    expect(result).toEqual([{ _id: "r1", orgId: "org_1", userId: "user_1", name: "Report 1" }, { _id: "r2", orgId: "org_1", userId: "user_1", name: "Report 2" }]);
  });
});

describe("reports:getScheduledReports", () => {
  function createCtx(reports: unknown[] = []) {
    const ctx = {
      db: {
        query: (_table: string) => {
          const tableData: Record<string, unknown[]> = { reports };
          return createQueryChain(tableData.reports ?? []);
        },
        get: () => Promise.resolve(null),
      },
    };
    return ctx;
  }

  it("returns reports where scheduled is true", async () => {
    const { getScheduledReports } = await import("../../convex/functions/reports");
    const reports = [
      { _id: "r1", scheduled: true, scheduleCron: "0 6 * * *" },
      { _id: "r2", scheduled: false },
      { _id: "r3", scheduled: true },
    ];
    const ctx = createCtx(reports);
    const result = await getScheduledReports.handler(ctx as never, {});
    expect(result.length).toBe(2);
    expect(result.every((r: Record<string, unknown>) => r.scheduled === true)).toBe(true);
  });
});

describe("reports:internalGenerateReport", () => {
  const validId = { subject: "user_1", org_id: "org_1", tokenIdentifier: "clerk:org_1|user_1" };

  function createStorageCtx(user: typeof validId | null, options?: {
    expenses?: unknown[];
    settlements?: unknown[];
    budgets?: unknown[];
    reportDoc?: unknown;
  }) {
    const patchCalls: Array<{ id: string; data: Record<string, unknown> }> = [];
    const storedContents: string[] = [];
    const ctx = {
      auth: { getUserIdentity: () => Promise.resolve(user) },
      db: {
        query: (table: string) => {
          const tableData: Record<string, unknown[]> = {
            expenses: options?.expenses ?? [],
            settlements: options?.settlements ?? [],
            budgets: options?.budgets ?? [],
          };
          return createQueryChain(tableData[table] ?? []);
        },
        get: () => Promise.resolve(options?.reportDoc ?? null),
        patch: (id: string, data: Record<string, unknown>) => {
          patchCalls.push({ id, data });
          return Promise.resolve();
        },
        insert: () => Promise.resolve("mock_id"),
        delete: () => Promise.resolve(),
      },
      storage: {
        store: async () => { storedContents.push(""); return "mock_storage_id"; },
        getUrl: async () => "https://example.com/signed?expires=123",
      },
      _patchCalls: patchCalls,
      _storedContents: storedContents,
    };
    return ctx;
  }

  function reportDoc(overrides: Record<string, unknown> = {}) {
    return {
      _id: "report1",
      orgId: "org_1",
      userId: "user_1",
      name: "Report",
      type: "monthly_summary",
      config: {},
      format: "csv",
      status: "generating",
      createdAt: Date.now(),
      ...overrides,
    };
  }

  it("throws when report not found", async () => {
    const { internalGenerateReport } = await import("../../convex/functions/reports");
    const ctx = createStorageCtx(validId, { reportDoc: null });
    await expect(internalGenerateReport.handler(ctx as never, { reportId: "nonexistent" })).rejects.toThrow("Report not found");
  });

  it("generates report content, stores, patches, returns url", async () => {
    const { internalGenerateReport } = await import("../../convex/functions/reports");
    const expenses = [
      { _id: "exp1", orgId: "org_1", date: "2024-01-15", category: "Food", amount: 1000, status: "approved", paidBy: "Alice", deletedAt: undefined },
    ];
    const ctx = createStorageCtx(validId, { expenses, reportDoc: reportDoc() });
    const result = await internalGenerateReport.handler(ctx as never, { reportId: "report1" });
    expect(result.storageId).toBe("mock_storage_id");
    expect(result.downloadUrl).toContain("signed");
    expect(ctx._storedContents.length).toBeGreaterThan(0);
    expect(ctx._patchCalls.some((p) => p.data.status === "ready")).toBe(true);
  });
});

describe("reports:cronMatch", () => {
  it("matches minute, hour, dom, month, dow with wildcards", async () => {
    const { cronMatch } = await import("../../convex/functions/reports");
    const now = new Date("2024-01-15T06:00:00Z");
    expect(cronMatch("0 6 * * *", now)).toBe(true);
  });

  it("does not match wrong hour", async () => {
    const { cronMatch } = await import("../../convex/functions/reports");
    const now = new Date("2024-01-15T05:00:00Z");
    expect(cronMatch("0 6 * * *", now)).toBe(false);
  });

  it("does not match wrong minute", async () => {
    const { cronMatch } = await import("../../convex/functions/reports");
    const now = new Date("2024-01-15T06:30:00Z");
    expect(cronMatch("0 6 * * *", now)).toBe(false);
  });

  it("matches */15 minutes", async () => {
    const { cronMatch } = await import("../../convex/functions/reports");
    const now = new Date("2024-01-15T06:15:00Z");
    expect(cronMatch("*/15 6 * * *", now)).toBe(true);
  });

  it("rejects invalid cron format", async () => {
    const { cronMatch } = await import("../../convex/functions/reports");
    const now = new Date("2024-01-15T06:00:00Z");
    expect(cronMatch("invalid cron", now)).toBe(false);
    expect(cronMatch("0 6 * *", now)).toBe(false);
  });
});

describe("reports:generateScheduled", () => {
  function createCtx(reports: unknown[], runQueryResult: unknown[], runMutationCalls: Array<{ name: string; args: unknown }> = []) {
    const ctx = {
      runQuery: async (_name: unknown, _args: unknown) => runQueryResult,
      runMutation: async (_name: unknown, args: unknown) => { runMutationCalls.push({ name: "internalGenerateReport", args }); return Promise.resolve(); },
    };
    return ctx;
  }

  it("skips reports that are not scheduled", async () => {
    const { generateScheduled } = await import("../../convex/functions/reports");
    const reports = [{ _id: "r1", scheduled: false, scheduleCron: undefined }];
    const runMutationCalls: Array<{ name: string; args: unknown }> = [];
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-01-15T06:00:00Z"));
    const ctx = createCtx(reports, reports, runMutationCalls);
    await generateScheduled.handler(ctx as never, {});
    expect(runMutationCalls.length).toBe(0);
    vi.useRealTimers();
  });

  it("skips reports whose cron does not match current time", async () => {
    const { generateScheduled } = await import("../../convex/functions/reports");
    const reports = [{ _id: "r1", scheduled: true, scheduleCron: "0 5 * * *" }];
    const runMutationCalls: Array<{ name: string; args: unknown }> = [];
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-01-15T06:00:00Z"));
    const ctx = createCtx(reports, reports, runMutationCalls);
    await generateScheduled.handler(ctx as never, {});
    expect(runMutationCalls.length).toBe(0);
    vi.useRealTimers();
  });

  it("runs internalGenerateReport for matching scheduled reports", async () => {
    const { generateScheduled } = await import("../../convex/functions/reports");
    const reports = [{ _id: "r1", scheduled: true, scheduleCron: "0 6 * * *" }];
    const runMutationCalls: Array<{ name: string; args: unknown }> = [];
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-01-15T06:00:00Z"));
    const ctx = createCtx(reports, reports, runMutationCalls);
    await generateScheduled.handler(ctx as never, {});
    expect(runMutationCalls.length).toBe(1);
    expect(runMutationCalls[0].args).toEqual({ reportId: "r1" });
    vi.useRealTimers();
  });
});