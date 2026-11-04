import { mutation, query, internal } from "convex/server";
import { v } from "convex/values";
import { requireAuthenticatedOrg } from "./auth";
import { internal as apiInternal } from "./_generated/api";
import { sendEmail } from "./functions/email";

// Budgets

export const createBudget = mutation({
  args: {
    category: v.string(),
    amount: v.number(),
    period: v.union(v.literal("monthly"), v.literal("quarterly"), v.literal("yearly")),
    alertThreshold: v.number(),
  },
  handler: async (ctx, args) => {
    // Input validation
    if (!args.category || args.category.trim().length === 0) {
      throw new Error("Category cannot be empty");
    }
    if (args.category.length > 100) {
      throw new Error("Category cannot exceed 100 characters");
    }
    if (args.amount <= 0) {
      throw new Error("Amount must be positive");
    }
    if (args.alertThreshold < 0 || args.alertThreshold > 100) {
      throw new Error("Alert threshold must be between 0 and 100");
    }

    const { userId, orgId } = await requireAuthenticatedOrg(ctx);
    const now = Date.now();

    const id = await ctx.db.insert("budgets", {
      orgId,
      category: args.category,
      amount: args.amount,
      period: args.period,
      alertThreshold: args.alertThreshold,
      alertSent: false,
      createdBy: userId,
      createdAt: now,
      updatedAt: now,
    });

    // Check budget immediately
    await ctx.scheduler.runAfter(0, apiInternal.budgets.checkBudget, { budgetId: id });

    return id;
  },
});

export const create = createBudget;

export const list = query({
  args: {},
  handler: async (ctx, _args) => {
    const { orgId } = await requireAuthenticatedOrg(ctx);
    return await ctx.db.query("budgets")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect();
  },
});

export const listBudgets = list;

export const updateBudget = mutation({
  args: {
    id: v.id("budgets"),
    amount: v.optional(v.number()),
    alertThreshold: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { orgId } = await requireAuthenticatedOrg(ctx);

    const existing = await ctx.db.get(args.id);
    if (!existing) {
      throw new Error("Budget not found");
    }

    if (existing.orgId !== orgId) {
      throw new Error("Access denied");
    }

    // Input validation for updates
    if (args.amount !== undefined) {
      if (args.amount <= 0) {
        throw new Error("Amount must be positive");
      }
    }

    if (args.alertThreshold !== undefined) {
      if (args.alertThreshold < 0 || args.alertThreshold > 100) {
        throw new Error("Alert threshold must be between 0 and 100");
      }
    }

    const updates: Record<string, unknown> = {};
    if (args.amount !== undefined) {
      updates.amount = args.amount;
    }
    if (args.alertThreshold !== undefined) {
      updates.alertThreshold = args.alertThreshold;
    }
    updates.updatedAt = Date.now();
    updates.alertSent = false; // Reset alert when budget updated

    await ctx.db.patch(args.id, updates);

    // Re-check budget
    await ctx.scheduler.runAfter(0, apiInternal.budgets.checkBudget, { budgetId: args.id });

    return args.id;
  },
});

export const update = updateBudget;

export const deleteBudget = mutation({
  args: { id: v.id("budgets") },
  handler: async (ctx, args) => {
    const { orgId } = await requireAuthenticatedOrg(ctx);

    const existing = await ctx.db.get(args.id);
    if (!existing) {
      throw new Error("Budget not found");
    }

    if (existing.orgId !== orgId) {
      throw new Error("Access denied");
    }

    await ctx.db.delete(args.id);

    return args.id;
  },
});

export const delete_ = deleteBudget;
export const remove = deleteBudget;
export { deleteBudget as del };

export const checkBudget = internal.mutation({
  args: {
    budgetId: v.id("budgets"),
  },
  handler: async (ctx, args) => {
    const { orgId } = await requireAuthenticatedOrg(ctx);

    const budget = await ctx.db.get(args.budgetId);
    if (!budget) {
      throw new Error("Budget not found");
    }

    if (budget.orgId !== orgId) {
      throw new Error("Access denied");
    }

    const now = new Date();
    let startDate: Date;
    const quarter = Math.floor(now.getMonth() / 3);
    switch (budget.period) {
      case "monthly":
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case "quarterly":
        startDate = new Date(now.getFullYear(), quarter * 3, 1);
        break;
      case "yearly":
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
    }

    const expenses = await ctx.db.query("expenses")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .filter((q) => q.gte(q.field("date"), startDate.toISOString().slice(0, 10)))
      .filter((q) => q.eq(q.field("deletedAt"), undefined))
      .collect();

    const total = expenses
      .filter((exp) => exp.category === budget.category && exp.status === "approved")
      .reduce((sum, exp) => sum + exp.amount, 0);

    const thresholdAmount = (budget.amount * budget.alertThreshold) / 100;

    if (total >= thresholdAmount && !budget.alertSent) {
      await ctx.db.patch(args.budgetId, { alertSent: true, updatedAt: Date.now() });

      // Send alert via email
      try {
        const escapeHtml = (text: string) => {
          return text.replace(/[&<>"']/g, (char) => {
            const escapeMap: Record<string, string> = {
              '&': '&amp;',
              '<': '&lt;',
              '>': '&gt;',
              '"': '&quot;',
              "'": '&#39;',
            };
            return escapeMap[char];
          });
        };
        await sendEmail({
          to: ["admin@happyhousebills.com"],
          subject: `Budget alert: ${escapeHtml(budget.category)}`,
          html: `<p>You have spent ${total/100} on ${escapeHtml(budget.category)}, exceeding ${budget.alertThreshold}% of your budget of ${budget.amount/100}.</p>`,
          orgId: orgId as any,
          userId: "admin",
        });
      } catch {
        // Ignore email errors
      }
    }
  },
});

export const check = checkBudget;