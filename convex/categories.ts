import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireAuthenticatedOrg } from "./auth";

// Categories

export const create = mutation({
  args: {
    name: v.string(),
    color: v.string(),
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