import { internalMutation, mutation, query } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { requireAuthenticatedOrg } from "./auth";

const DEFAULT_CATEGORIES = [
  { name: "Groceries", icon: "shopping-cart", color: "#22c55e", sortOrder: 0, subCategories: ["Supermarket", "Convenience", "Online Grocery"] },
  { name: "Utilities", icon: "zap", color: "#f59e0b", sortOrder: 1, subCategories: ["Electricity", "Water", "Gas", "Internet", "Phone"] },
  { name: "Transport", icon: "car", color: "#3b82f6", sortOrder: 2, subCategories: ["Fuel", "Public Transport", "Rideshare", "Parking"] },
  { name: "Dining", icon: "utensils", color: "#ef4444", sortOrder: 3, subCategories: ["Restaurant", "Takeaway", "Coffee", "Fast Food"] },
  { name: "Entertainment", icon: "film", color: "#a855f7", sortOrder: 4, subCategories: ["Streaming", "Games", "Events", "Subscriptions"] },
  { name: "Health", icon: "heart-pulse", color: "#ec4899", sortOrder: 5, subCategories: ["Pharmacy", "Doctor", "Dental", "Insurance"] },
  { name: "Shopping", icon: "shopping-bag", color: "#06b6d4", sortOrder: 6, subCategories: ["Clothing", "Electronics", "Home", "Gifts"] },
  { name: "Other", icon: "more-horizontal", color: "#6b7280", sortOrder: 7, subCategories: [] },
] as const;

const LEGACY_CATEGORY_MAP: Record<string, string> = {
  groceries: "Groceries",
  utilities: "Utilities",
  transport: "Transport",
  dining: "Dining",
  entertainment: "Entertainment",
  health: "Health",
  shopping: "Shopping",
  other: "Other",
};

function resolveDefaultName(rawCategory: string): string {
  const normalized = rawCategory.trim().toLowerCase();
  return LEGACY_CATEGORY_MAP[normalized] ?? rawCategory;
}

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

    if (args.parentId) {
      const parent = await ctx.db.get(args.parentId);
      if (!parent || parent.orgId !== orgId) {
        throw new Error("Parent category not found in this organization");
      }
    }

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

export const list = query({
  args: {},
  handler: async (ctx, _args) => {
    const { orgId } = await requireAuthenticatedOrg(ctx);
    const categories = await ctx.db.query("categories")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect();
    return categories.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  },
});

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
    const { userId, orgId } = await requireAuthenticatedOrg(ctx);

    const existing = await ctx.db.get(args.id);
    if (!existing) {
      throw new Error("Category not found");
    }

    if (existing.orgId !== orgId) {
      throw new Error("Access denied");
    }

    if (args.parentId && args.parentId !== args.id) {
      const parent = await ctx.db.get(args.parentId);
      if (!parent || parent.orgId !== orgId) {
        throw new Error("Parent category not found in this organization");
      }
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
      const membership = await ctx.db.query("memberships")
        .withIndex("by_org_user", (q) => q.eq("orgId", orgId).eq("userId", userId))
        .first();
      if (!membership || membership.role !== "admin") {
        throw new Error("Only admins can change the default status of a category");
      }
      updates.isDefault = args.isDefault;
    }
    if (args.sortOrder !== undefined) {
      updates.sortOrder = args.sortOrder;
    }

    updates.updatedAt = Date.now();

    await ctx.db.patch(args.id, updates);

    // Cascade rename to expenses referencing this category by id or legacy name
    if (args.name !== undefined && args.name !== existing.name) {
      const affected = await ctx.db.query("expenses")
        .withIndex("by_org", (q) => q.eq("orgId", existing.orgId))
        .filter((q) => q.or(
          q.eq(q.field("categoryId"), args.id),
          q.eq(q.field("category"), existing.name)
        ))
        .collect();

      for (const expense of affected) {
        await ctx.db.patch(expense._id, {
          category: args.name,
          categoryId: args.id,
          updatedAt: Date.now(),
        });
      }
    }

    return args.id;
  },
});

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

    // Expenses linked by categoryId (efficient index path) plus legacy name matches.
    const byId = await ctx.db.query("expenses")
      .withIndex("by_org_categoryId", (q) => q.eq("orgId", existing.orgId).eq("categoryId", args.id))
      .filter((q) => q.eq(q.field("deletedAt"), undefined))
      .collect();

    const byLegacyName = await ctx.db.query("expenses")
      .withIndex("by_org", (q) => q.eq("orgId", existing.orgId))
      .filter((q) => q.eq(q.field("deletedAt"), undefined))
      .filter((q) => q.eq(q.field("category"), existing.name) || q.eq(q.field("category"), existing.name.toLowerCase()))
      .collect();

    const seen = new Set<string>();
    const expensesWithCategory = [...byId, ...byLegacyName].filter((exp) => {
      if (seen.has(exp._id)) return false;
      seen.add(exp._id);
      return true;
    });

    if (expensesWithCategory.length > 0) {
      const otherCat = await ctx.db.query("categories")
        .withIndex("by_org", (q) => q.eq("orgId", existing.orgId))
        .filter((q) => q.eq(q.field("name"), "Other"))
        .first();

      const otherName = otherCat?.name ?? "Other";
      const otherId = otherCat?._id;

      for (const expense of expensesWithCategory) {
        await ctx.db.patch(expense._id, { category: otherName, categoryId: otherId, updatedAt: Date.now() });
      }
    }

    await ctx.db.delete(args.id);

    return args.id;
  },
});

export async function seedDefaultCategories(ctx: MutationCtx, orgId: string, userId?: string): Promise<void> {
  const now = Date.now();
  for (const c of DEFAULT_CATEGORIES) {
    const existing = await ctx.db.query("categories")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .filter((q) => q.eq(q.field("name"), c.name))
      .collect();
    if (existing.length > 0) continue;

    const rootId = await ctx.db.insert("categories", {
      orgId,
      name: c.name,
      color: c.color,
      icon: c.icon,
      isDefault: true,
      sortOrder: c.sortOrder,
      subCategories: [...c.subCategories],
      createdBy: userId ?? orgId,
      createdAt: now,
      updatedAt: now,
    });

    for (let i = 0; i < c.subCategories.length; i++) {
      const subName = c.subCategories[i]!;
      const subExisting = await ctx.db.query("categories")
        .withIndex("by_org_parent", (q) => q.eq("orgId", orgId).eq("parentId", rootId))
        .filter((q) => q.eq(q.field("name"), subName))
        .collect();
      if (subExisting.length > 0) continue;

      await ctx.db.insert("categories", {
        orgId,
        name: subName,
        color: c.color,
        icon: c.icon,
        parentId: rootId,
        isDefault: true,
        sortOrder: c.sortOrder * 100 + i + 1,
        createdBy: userId ?? orgId,
        createdAt: now,
        updatedAt: now,
      });
    }
  }
}

export const seedDefaults = internalMutation({
  args: { orgId: v.string(), userId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await seedDefaultCategories(ctx, args.orgId, args.userId);
    return true;
  },
});

export const backfillLegacyCategories = internalMutation({
  args: { orgId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const orgs = args.orgId
      ? [{ _id: args.orgId as unknown as string } as const]
      : await ctx.db.query("orgs").collect();

    for (const org of orgs) {
      const orgId = org._id as unknown as string;

      const categories = await ctx.db.query("categories")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .collect();

      const byName = new Map<string, { _id: string; name: string }>();
      for (const cat of categories) {
        byName.set(cat.name.toLowerCase(), { _id: cat._id as unknown as string, name: cat.name });
      }

      const expenses = await ctx.db.query("expenses")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .filter((q) => q.eq(q.field("deletedAt"), undefined))
        .collect();

      for (const expense of expenses) {
        const resolved = resolveDefaultName(expense.category);
        const match = byName.get(resolved.toLowerCase());

        if (match && (expense.category !== match.name || !expense.categoryId)) {
          await ctx.db.patch(expense._id, {
            category: match.name,
            categoryId: match._id,
            updatedAt: Date.now(),
          });
        } else if (!match && expense.category !== resolved) {
          await ctx.db.patch(expense._id, {
            category: resolved,
            updatedAt: Date.now(),
          });
        }
      }
    }

    return true;
  },
});