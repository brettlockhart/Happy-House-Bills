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
  filter: (fn: (q: { eq: (field: string, value: unknown) => boolean }) => boolean) => QueryChain;
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
    filter: (fn: (q: { eq: (field: string, value: unknown) => boolean }) => boolean) => {
      filtered = filtered.filter((doc) =>
        fn(createFilterBuilder(doc as Record<string, unknown>))
      );
      return chainable;
    },
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
    const { createCategory } = await import("../../convex/categories");
    const ctx = createMockCtx(null);
    await expect(createCategory.handler(ctx as never, { name: "Food", color: "#10b981" }))
      .rejects.toThrow("Unauthenticated");
  });

  it("creates category with orgId from auth", async () => {
    const { createCategory } = await import("../../convex/categories");
    const ctx = createMockCtx(validIdentity());
    const result = await createCategory.handler(ctx as never, { name: "Food", color: "#10b981" });
    expect(typeof result).toBe("string");
    expect(ctx._insertCalls![0]).toMatchObject({
      orgId: "org_1",
      name: "Food",
      color: "#10b981",
      createdBy: "user_1",
    });
  });

  it("rejects duplicate category name", async () => {
    const { createCategory } = await import("../../convex/categories");
    const existing = [{ _id: "cat1", orgId: "org_1", name: "Food", color: "#10b981" }];
    const ctx = createMockCtx(validIdentity(), { categories: existing });
    await expect(createCategory.handler(ctx as never, { name: "Food", color: "#ff0000" }))
      .rejects.toThrow("already exists");
  });
});

describe("categories:list", () => {
  it("throws when unauthenticated", async () => {
    const { listCategories } = await import("../../convex/categories");
    const ctx = createMockCtx(null);
    await expect(listCategories.handler(ctx as never, {})).rejects.toThrow("Unauthenticated");
  });

  it("returns categories for orgId from auth", async () => {
    const { listCategories } = await import("../../convex/categories");
    const cats = [
      { _id: "cat1", orgId: "org_1", name: "Food", color: "#10b981" },
      { _id: "cat2", orgId: "org_1", name: "Transport", color: "#ff0000" },
    ];
    const ctx = createMockCtx(validIdentity(), { categories: cats });
    const result = await listCategories.handler(ctx as never, {});
    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(2);
  });

  it("filters out other orgs' categories", async () => {
    const { listCategories } = await import("../../convex/categories");
    const cats = [
      { _id: "cat1", orgId: "org_other", name: "Other Food", color: "#10b981" },
      { _id: "cat2", orgId: "org_1", name: "Food", color: "#ff0000" },
    ];
    const ctx = createMockCtx(validIdentity(), { categories: cats });
    const result = await listCategories.handler(ctx as never, {});
    expect(result).toHaveLength(1);
  });
});

describe("categories:update", () => {
  it("throws when unauthenticated", async () => {
    const { updateCategory } = await import("../../convex/categories");
    const ctx = createMockCtx(null);
    await expect(updateCategory.handler(ctx as never, { id: "cat1", name: "New" }))
      .rejects.toThrow("Unauthenticated");
  });

  it("throws when category belongs to different org", async () => {
    const { updateCategory } = await import("../../convex/categories");
    const cat = { _id: "cat1", orgId: "org_other", name: "Food" };
    const ctx = createMockCtx(validIdentity(), { categoryToGet: cat });
    await expect(updateCategory.handler(ctx as never, { id: "cat1", name: "New" }))
      .rejects.toThrow("Access denied");
  });

  it("updates category and patches", async () => {
    const { updateCategory } = await import("../../convex/categories");
    const cat = { _id: "cat1", orgId: "org_1", name: "Food", color: "#10b981" };
    const ctx = createMockCtx(validIdentity(), { categoryToGet: cat });
    await updateCategory.handler(ctx as never, { id: "cat1", name: "Groceries" });
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
    expect(ctx._patchCalls![0].data.category).toBe("other");
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
    const { listBudgets } = await import("../../convex/budgets");
    const ctx = createMockCtx(null);
    await expect(listBudgets.handler(ctx as never, {})).rejects.toThrow("Unauthenticated");
  });

  it("returns budgets for orgId from auth", async () => {
    const { listBudgets } = await import("../../convex/budgets");
    const budgets = [
      { _id: "bud1", orgId: "org_1", category: "Food", amount: 50000 },
      { _id: "bud2", orgId: "org_1", category: "Transport", amount: 30000 },
    ];
    const ctx = createMockCtx(validIdentity(), { budgets });
    const result = await listBudgets.handler(ctx as never, {});
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