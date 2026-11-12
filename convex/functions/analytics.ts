import { query } from "../_generated/server";
import { v } from "convex/values";
import { requireAuthenticatedOrg } from "../auth";

export const summary = query({
  args: {
    period: v.union(
      v.literal("week"),
      v.literal("month"),
      v.literal("quarter"),
      v.literal("year"),
    ),
  },
  handler: async (ctx, args) => {
    const { orgId } = await requireAuthenticatedOrg(ctx);
    const now = Date.now();

    const periodMs: Record<string, number> = {
      week: 7 * 24 * 60 * 60 * 1000,
      month: 30 * 24 * 60 * 60 * 1000,
      quarter: 90 * 24 * 60 * 60 * 1000,
      year: 365 * 24 * 60 * 60 * 1000,
    };
    const cutoff = now - (periodMs[args.period] ?? (periodMs.month as number));

    const expenses = await ctx.db
      .query("expenses")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .filter((q) => q.eq(q.field("deletedAt"), undefined))
      .filter((q) => q.eq(q.field("status"), "approved"))
      .collect();

    const recent = expenses.filter((e) => e.createdAt >= cutoff);

    const total = recent.reduce((sum, e) => sum + e.amount, 0);
    const avg = recent.length > 0 ? total / recent.length : 0;

    const byCategory: Record<string, number> = {};
    const byDay: Record<string, number> = {};
    for (const e of recent) {
      const cat = e.category ?? "other";
      byCategory[cat] = (byCategory[cat] || 0) + e.amount;
      const day = new Date(e.date).toISOString().slice(0, 10);
      byDay[day] = (byDay[day] || 0) + e.amount;
    }

    const topCategory = Object.entries(byCategory).sort((a, b) => b[1] - a[1])[0];

    const dailyTotals = Object.entries(byDay)
      .map(([date, amount]) => ({ date, amount: Math.round(amount * 100) / 100 }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return {
      period: args.period,
      totalSpent: Math.round(total * 100) / 100,
      averagePerExpense: Math.round(avg * 100) / 100,
      expenseCount: recent.length,
      categories: Object.entries(byCategory)
        .map(([category, amount]) => ({
          category,
          amount: Math.round(amount * 100) / 100,
        }))
        .sort((a, b) => b.amount - a.amount),
      topCategory: topCategory
        ? { category: topCategory[0]!, amount: Math.round(topCategory[1]! * 100) / 100 }
        : null,
      dailyTotals,
    };
  },
});