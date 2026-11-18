import { describe, it, expect, vi, beforeEach } from "vitest";

const { requireAuthenticatedOrg } = vi.hoisted(() => ({
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
  requireAuthenticatedOrg,
}));

function makeCtx() {
  const ctx = {
    auth: { getUserIdentity: async () => null },
    db: {
      insert: vi.fn().mockResolvedValue("cat_id"),
      query: vi.fn(),
      patch: vi.fn().mockResolvedValue(undefined),
      get: vi.fn().mockResolvedValue(null),
      delete: vi.fn().mockResolvedValue(undefined),
    },
  };
  const queryChain = {
    withIndex: vi.fn().mockReturnValue({
      first: vi.fn().mockResolvedValue(null),
      filter: vi.fn(() => queryChain),
      collect: vi.fn().mockResolvedValue([]),
      order: vi.fn().mockReturnValue({ collect: vi.fn().mockResolvedValue([]) }),
    }),
    filter: vi.fn(() => queryChain),
    order: vi.fn().mockReturnValue({ collect: vi.fn().mockResolvedValue([]) }),
    collect: vi.fn().mockResolvedValue([]),
  };
  const membershipChain = {
    withIndex: vi.fn().mockReturnValue({
      first: vi.fn().mockResolvedValue({
        orgId: "org_test",
        userId: "user_test",
        role: "admin",
        status: "active",
      }),
      filter: vi.fn(() => membershipChain),
      collect: vi.fn().mockResolvedValue([]),
      order: vi.fn().mockReturnValue({ collect: vi.fn().mockResolvedValue([]) }),
    }),
    filter: vi.fn(() => membershipChain),
    order: vi.fn().mockReturnValue({ collect: vi.fn().mockResolvedValue([]) }),
    collect: vi.fn().mockResolvedValue([]),
  };
  ctx.db.query = vi.fn((table?: string) =>
    table === "memberships" ? membershipChain : queryChain,
  );
  return ctx;
}

describe("convex/categories", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    requireAuthenticatedOrg.mockResolvedValue({
      userId: "user_test",
      orgId: "org_test",
    });
  });

  describe("create", () => {
    it("requires authentication", async () => {
      requireAuthenticatedOrg.mockRejectedValue(new Error("Unauthenticated"));
      const { create } = await import("../../convex/categories");
      await expect(
        create.handler(
          { auth: { getUserIdentity: async () => null } },
          { name: "Groceries", color: "#22c55e" },
        ),
      ).rejects.toThrow("Unauthenticated");
    });

    it("rejects empty category name", async () => {
      const ctx = makeCtx();
      const { create } = await import("../../convex/categories");
      await expect(
        create.handler(ctx, { name: "", color: "#22c55e" }),
      ).rejects.toThrow("Category name cannot be empty");
    });

    it("rejects invalid hex colour", async () => {
      const ctx = makeCtx();
      const { create } = await import("../../convex/categories");
      await expect(
        create.handler(ctx, { name: "Groceries", color: "not-a-colour" }),
      ).rejects.toThrow("Category color must be a valid hex color");
    });

    it("rejects duplicate category name in same org", async () => {
      const ctx = makeCtx();
      ctx.db.query().withIndex().filter().collect.mockResolvedValueOnce([
        { _id: "existing_cat", name: "Groceries" },
      ]);
      const { create } = await import("../../convex/categories");
      await expect(
        create.handler(ctx, { name: "Groceries", color: "#22c55e" }),
      ).rejects.toThrow("Category name already exists");
    });

    it("creates category successfully", async () => {
      const ctx = makeCtx();
      const { create } = await import("../../convex/categories");
      const id = await create.handler(ctx, {
        name: "Groceries",
        color: "#22c55e",
        icon: "cart",
        sortOrder: 0,
      });
      expect(id).toBe("cat_id");
      expect(ctx.db.insert).toHaveBeenCalledWith("categories", expect.objectContaining({
        name: "Groceries",
        color: "#22c55e",
        icon: "cart",
        sortOrder: 0,
        isDefault: false,
      }));
    });
  });

  describe("list", () => {
    it("requires authentication", async () => {
      requireAuthenticatedOrg.mockRejectedValue(new Error("Unauthenticated"));
      const { list } = await import("../../convex/categories");
      await expect(list.handler({ auth: { getUserIdentity: async () => null } })).rejects.toThrow("Unauthenticated");
    });

    it("returns org-scoped categories ordered by sortOrder", async () => {
      const ctx = makeCtx();
      ctx.db.query().withIndex().collect.mockResolvedValueOnce([
        { _id: "cat_1", name: "Groceries", sortOrder: 2, orgId: "org_test" },
        { _id: "cat_2", name: "Utilities", sortOrder: 0, orgId: "org_test" },
      ]);
      const { list } = await import("../../convex/categories");
      const result = await list.handler(ctx);
      expect(result).toHaveLength(2);
      expect(result[0].name).toBe("Utilities");
      expect(result[1].name).toBe("Groceries");
      expect(ctx.db.query).toHaveBeenCalledWith("categories");
    });
  });

  describe("update", () => {
    it("rejects unauthenticated request", async () => {
      requireAuthenticatedOrg.mockRejectedValue(new Error("Unauthenticated"));
      const { update } = await import("../../convex/categories");
      await expect(
        update.handler({ auth: { getUserIdentity: async () => null } }, { id: "cat_1", name: "Renamed" }),
      ).rejects.toThrow("Unauthenticated");
    });

    it("rejects cross-org category update", async () => {
      const ctx = makeCtx();
      ctx.db.get.mockResolvedValueOnce({ _id: "cat_1", orgId: "org_other", name: "Old" });
      const { update } = await import("../../convex/categories");
      await expect(
        update.handler(ctx, { id: "cat_1", name: "Renamed" }),
      ).rejects.toThrow("Access denied");
    });

    it("rejects category not found", async () => {
      const ctx = makeCtx();
      ctx.db.get.mockResolvedValueOnce(null);
      const { update } = await import("../../convex/categories");
      await expect(
        update.handler(ctx, { id: "cat_missing", name: "Renamed" }),
      ).rejects.toThrow("Category not found");
    });

    it("updates fields partially", async () => {
      const ctx = makeCtx();
      ctx.db.get.mockResolvedValueOnce({
        _id: "cat_1",
        orgId: "org_test",
        name: "Old",
      });
      const { update } = await import("../../convex/categories");
      const id = await update.handler(ctx, {
        id: "cat_1",
        name: "Renamed",
        color: "#ef4444",
      });
      expect(id).toBe("cat_1");
      expect(ctx.db.patch).toHaveBeenCalledWith("cat_1", expect.objectContaining({
        name: "Renamed",
        color: "#ef4444",
      }));
    });
  });

  describe("deleteCategory", () => {
    it("requires authentication", async () => {
      requireAuthenticatedOrg.mockRejectedValue(new Error("Unauthenticated"));
      const { deleteCategory } = await import("../../convex/categories");
      await expect(
        deleteCategory.handler({ auth: { getUserIdentity: async () => null } }, { id: "cat_1" }),
      ).rejects.toThrow("Unauthenticated");
    });

    it("rejects cross-org delete", async () => {
      const ctx = makeCtx();
      ctx.db.get.mockResolvedValueOnce({ _id: "cat_1", orgId: "org_other", name: "Old" });
      const { deleteCategory } = await import("../../convex/categories");
      await expect(
        deleteCategory.handler(ctx, { id: "cat_1" }),
      ).rejects.toThrow("Access denied");
    });

    it("deletes category successfully", async () => {
      const ctx = makeCtx();
      ctx.db.get.mockResolvedValueOnce({ _id: "cat_1", orgId: "org_test", name: "Old" });
      const { deleteCategory } = await import("../../convex/categories");
      const id = await deleteCategory.handler(ctx, { id: "cat_1" });
      expect(id).toBe("cat_1");
      expect(ctx.db.delete).toHaveBeenCalledWith("cat_1");
    });

    it("reassigns expenses referencing the deleted category to Other", async () => {
      const ctx = makeCtx();
      const existing = { _id: "cat_1", orgId: "org_test", name: "Food" };
      ctx.db.get.mockResolvedValueOnce(existing);

      const byIdExpense = { _id: "exp_1", orgId: "org_test", category: "Food", categoryId: "cat_1", deletedAt: undefined };
      const legacyExpense = { _id: "exp_2", orgId: "org_test", category: "food", deletedAt: undefined };
      const otherCat = { _id: "cat_other", orgId: "org_test", name: "Other" };

      function chain(collectValues: unknown[][]) {
        let call = 0;
        const self: Record<string, unknown> = {};
        self.withIndex = vi.fn(() => self);
        self.filter = vi.fn(() => self);
        self.first = vi.fn().mockResolvedValue(otherCat);
        self.collect = vi.fn(() => Promise.resolve(collectValues[call++] ?? []));
        return self;
      }

      const expenseChain = chain([[byIdExpense], [legacyExpense]]);
      const categoryChain = chain([[otherCat]]);
      const membershipChain = chain([[{ orgId: "org_test", userId: "user_test", role: "admin", status: "active" }]]);
      membershipChain.first = vi.fn().mockResolvedValue({ orgId: "org_test", userId: "user_test", role: "admin", status: "active" });

      ctx.db.query.mockImplementation((table: string) => {
        if (table === "expenses") return expenseChain;
        if (table === "categories") return categoryChain;
        if (table === "memberships") return membershipChain;
        return chain([[]]);
      });

      const { deleteCategory } = await import("../../convex/categories");
      await deleteCategory.handler(ctx, { id: "cat_1" });

      expect(ctx.db.delete).toHaveBeenCalledWith("cat_1");
      expect(ctx.db.patch).toHaveBeenCalledWith("exp_1", expect.objectContaining({
        category: "Other",
        categoryId: "cat_other",
      }));
      expect(ctx.db.patch).toHaveBeenCalledWith("exp_2", expect.objectContaining({
        category: "Other",
        categoryId: "cat_other",
      }));
    });
  });

  describe("seedDefaultCategories", () => {
    it("is idempotent - does not duplicate existing defaults", async () => {
      const ctx = makeCtx();
      const collectMock = ctx.db.query().withIndex().filter().collect;
      collectMock.mockResolvedValue([
        { _id: "existing", name: "Groceries", orgId: "org_test" },
      ]);
      const { seedDefaultCategories } = await import("../../convex/categories");
      await seedDefaultCategories(ctx, "org_test");
      expect(ctx.db.insert).not.toHaveBeenCalled();
    });

    it("inserts default roots and sub-categories when none exist", async () => {
      const ctx = makeCtx();
      const collectMock = ctx.db.query().withIndex().filter().collect;
      collectMock.mockResolvedValue([]);
      const { seedDefaultCategories } = await import("../../convex/categories");
      await seedDefaultCategories(ctx, "org_test");
      // 8 default roots + sub-categories for each root that has children
      const insertCalls = (ctx.db.insert as ReturnType<typeof vi.fn>).mock.calls;
      expect(insertCalls.length).toBeGreaterThan(8);
      expect(insertCalls[0][0]).toBe("categories");
      expect(insertCalls[0][1]).toMatchObject({
        name: "Groceries",
        isDefault: true,
        subCategories: expect.any(Array),
      });
    });
  });

  describe("seedDefaults (internalMutation)", () => {
    it("seeds default categories", async () => {
      const ctx = makeCtx();
      const collectMock3 = vi.fn().mockResolvedValue([]);
      ctx.db.query = vi.fn().mockReturnValue({
        withIndex: vi.fn().mockReturnValue({
          filter: vi.fn().mockReturnValue({
            collect: collectMock3,
          }),
        }),
      });
      const { seedDefaults } = await import("../../convex/categories");
      const result = await seedDefaults.handler(
        ctx,
        { orgId: "org_test" },
      );
      expect(result).toBe(true);
    });
  });
});
