import { internalMutation, mutation, query } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { requireAuthenticatedOrg } from "./auth";

const DEFAULT_CATEGORIES = [
  { name: "Groceries", icon: "shopping-cart", color: "#22c55e", sortOrder: 0 },
  { name: "Utilities", icon: "zap", color: "#f59e0b", sortOrder: 1 },
  { name: "Transport", icon: "car", color: "#3b82f6", sortOrder: 2 },
  { name: "Dining", icon: "utensils", color: "#ef4444", sortOrder: 3 },
  { name: "Entertainment", icon: "film", color: "#a855f7", sortOrder: 4 },
  { name: "Health", icon: "heart-pulse", color: "#ec4899", sortOrder: 5 },
  { name: "Shopping", icon: "shopping-bag", color: "#06b6d4", sortOrder: 6 },
  { name: "Other", icon: "more-horizontal", color: "#6b7280", sortOrder: 7 },
] as const;

// Categories

export const create = mutation({
  args: {
    name: v.string(),
    color: v.string(),
    icon: v.optional(v.string()),
    parentId: v.optional(v.id("categories")),
    budgetMonthly: v.optional(v.number()),
    isDefault: v.optional(v.boolean()),
    sortOrder: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Input validation
    if (!args.name || args.name.trim().length === 0) {
      throw new Error("Category name cannot be empty");
    }
    if (args.name.length > 100) {
      throw new Error("Category name cannot exceed 100 characters");
    }
    if (!args.color || args.color.trim().length === 0) {
      throw new Error("Category color cannot be empty");
    }
    if (!/^#[0-9A-F]{6}$/i.test(args.color)) {
      throw new Error("Category color must be a valid hex color (e.g. #FF0000)");
    }

    const { userId, orgId } = await requireAuthenticatedOrg(ctx);
    const now = Date.now();

    // Check for duplicates
    const existing = await ctx.db.query("categories")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .filter((q) => q.eq(q.field("name"), args.name))
      .collect();

    if (existing.length > 0) {
      throw new Error("Category name already exists in this organization");
    }

    const id = await ctx.db.insert("categories", {
      orgId,
      name: args.name,
      color: args.color,
      icon: args.icon,
      parentId: args.parentId,
      budgetMonthly: args.budgetMonthly,
      isDefault: args.isDefault ?? false,
      sortOrder: args.sortOrder ?? 0,
      createdBy: userId,
      createdAt: now,
      updatedAt: now,
    });

    return id;
  },
});

export const createCategory = create;

export const list = query({
  args: {},
  handler: async (ctx, _args) => {
    const { orgId } = await requireAuthenticatedOrg(ctx);
    return await ctx.db.query("categories")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect();
  },
});

export const listCategories = list;

export const update = mutation({
  args: {
    id: v.id("categories"),
    name: v.optional(v.string()),
    color: v.optional(v.string()),
    icon: v.optional(v.string()),
    parentId: v.optional(v.id("categories")),
    budgetMonthly: v.optional(v.number()),
    isDefault: v.optional(v.boolean()),
    sortOrder: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { orgId } = await requireAuthenticatedOrg(ctx);

    const existing = await ctx.db.get(args.id);
    if (!existing) {
      throw new Error("Category not found");
    }

    if (existing.orgId !== orgId) {
      throw new Error("Access denied");
    }

    const updates: Record<string, unknown> = {};
    if (args.name !== undefined) {
      // Check for duplicates
      const duplicate = await ctx.db.query("categories")
        .withIndex("by_org", (q) => q.eq("orgId", existing.orgId))
        .filter((q) => q.eq(q.field("name"), args.name))
        .collect();

      if (duplicate.length > 0 && duplicate[0]?._id !== args.id) {
        throw new Error("Category name already exists in this organization");
      }

      updates.name = args.name;
    }

    if (args.color !== undefined) {
      updates.color = args.color;
    }
    if (args.icon !== undefined) {
      updates.icon = args.icon;
    }
    if (args.parentId !== undefined) {
      updates.parentId = args.parentId;
    }
    if (args.budgetMonthly !== undefined) {
      updates.budgetMonthly = args.budgetMonthly;
    }
    if (args.isDefault !== undefined) {
      updates.isDefault = args.isDefault;
    }
    if (args.sortOrder !== undefined) {
      updates.sortOrder = args.sortOrder;
    }

    updates.updatedAt = Date.now();

    await ctx.db.patch(args.id, updates);

    return args.id;
  },
});

export const updateCategory = update;

export const deleteCategory = mutation({
  args: { id: v.id("categories") },
  handler: async (ctx, args) => {
    const { orgId } = await requireAuthenticatedOrg(ctx);

    const existing = await ctx.db.get(args.id);
    if (!existing) {
      throw new Error("Category not found");
    }

    if (existing.orgId !== orgId) {
      throw new Error("Access denied");
    }

    // Check if any expenses use this category
    const expensesUsing = await ctx.db.query("expenses")
      .withIndex("by_org", (q) => q.eq("orgId", existing.orgId))
      .collect();

    const expensesWithCategory = expensesUsing.filter((exp) => exp.category === existing.name && !exp.deletedAt);

    if (expensesWithCategory.length > 0) {
      // Move expenses to 'other' category
      for (const expense of expensesWithCategory) {
        await ctx.db.patch(expense._id, { category: "other" });
      }
    }

    await ctx.db.delete(args.id);

    return args.id;
  },
});

export const delete_ = deleteCategory;
export { deleteCategory as remove };
export const del = deleteCategory;

export async function seedDefaultCategories(ctx: MutationCtx, orgId: string): Promise<void> {
  const now = Date.now();
  for (const c of DEFAULT_CATEGORIES) {
    const existing = await ctx.db.query("categories")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .filter((q) => q.eq(q.field("name"), c.name))
      .collect();
    if (existing.length > 0) continue;
    await ctx.db.insert("categories", {
      orgId,
      name: c.name,
      color: c.color,
      icon: c.icon,
      isDefault: true,
      sortOrder: c.sortOrder,
      createdBy: orgId,
      createdAt: now,
      updatedAt: now,
    });
  }
}

export const seedDefaults = internalMutation({
  args: { orgId: v.string() },
  handler: async (ctx, args) => {
    await seedDefaultCategories(ctx, args.orgId);
    return true;
  },
});