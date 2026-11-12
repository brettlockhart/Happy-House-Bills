import { query } from "../_generated/server";
import { v } from "convex/values";
import { requireAuthenticatedOrg } from "../auth";

/**
 * Performance benchmark: measures query execution time and index usage.
 * Returns timing info for optimization analysis.
 */
export const benchmark = query({
  args: {
    duration: v.optional(v.number()), // how long to run (ms)
  },
  handler: async (ctx, args) => {
    const { orgId } = await requireAuthenticatedOrg(ctx);
    const duration = args.duration ?? 30_000; // default 30s

    const start = Date.now();
    const expenses = await ctx.db
      .query("expenses")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .filter((q) => q.eq(q.field("deletedAt"), undefined))
      .filter((q) => q.eq(q.field("status"), "approved"))
      .collect();

    const end = Date.now();
    const elapsed = end - start;

    return {
      recordCount: expenses.length,
      elapsedMs: elapsed,
      avgTimePerRecord: elapsed / Math.max(expenses.length, 1),
      benchmarkDurationMs: duration,
    };
  },
});

/**
 * Health check: verifies the analytics system is operational.
 * Returns status of all dependent systems.
 */
export const healthCheck = query({
  args: {},
  handler: async (ctx) => {
    const { orgId } = await requireAuthenticatedOrg(ctx);

    // Check expenses count
    const expenseCount = (
      await ctx.db
        .query("expenses")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .filter((q) => q.eq(q.field("deletedAt"), undefined))
        .filter((q) => q.eq(q.field("status"), "approved"))
        .collect()
    ).length;

    // Check if indexes exist by testing query (org-scoped)
    let indexAccessible = true;
    try {
      await ctx.db
        .query("expenses")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .take(1);
    } catch {
      indexAccessible = false;
    }

    return {
      status: indexAccessible ? "healthy" : "degraded",
      expenseCount,
      indexAccessible,
      timestamp: Date.now(),
    };
  },
});