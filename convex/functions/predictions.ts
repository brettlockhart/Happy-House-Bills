import { query } from "../_generated/server";
import { v } from "convex/values";
import { requireAuthenticatedOrg } from "../auth";

export const forecast = query({
  args: {
    period: v.union(v.literal("month"), v.literal("quarter"), v.literal("year")),
  },
  handler: async (ctx, args) => {
    const { orgId } = await requireAuthenticatedOrg(ctx);

    const expenses = await ctx.db
      .query("expenses")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .filter((q) => q.eq(q.field("deletedAt"), undefined))
      .filter((q) => q.eq(q.field("status"), "approved"))
      .collect();

    if (expenses.length === 0) {
      return {
        forecast: 0,
        confidence: "low",
        period: args.period,
        historicalTotal: 0,
        dataPoints: 0,
      };
    }

    const periodDays: Record<string, number> = {
      month: 30,
      quarter: 90,
      year: 365,
    };

    const days = periodDays[args.period] ?? 30;
    const now = Date.now();

    const cutoff = now - days * 24 * 60 * 60 * 1000;
    const historical = expenses.filter((e) => e.createdAt >= cutoff);
    const historicalTotal = historical.reduce((sum, e) => sum + e.amount, 0);

    const periodMonths = days / 30;
    const forecastAmount = historicalTotal / Math.max(periodMonths, 1);

    const confidence = historical.length >= 3 ? "medium" : "low";

    return {
      forecast: Math.round(forecastAmount * 100) / 100,
      confidence,
      period: args.period,
      historicalTotal: Math.round(historicalTotal * 100) / 100,
      dataPoints: historical.length,
    };
  },
});
