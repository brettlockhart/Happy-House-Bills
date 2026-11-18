import { internalAction, internalMutation, internalQuery } from "../_generated/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";

const RETENTION_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;
const RETENTION_THRESHOLD_MS = RETENTION_DAYS * DAY_MS;

export const purgeExpiredExpenses = internalMutation({
  args: { orgId: v.string() },
  handler: async (ctx, args) => {
    const { orgId } = args;
    const now = Date.now();
    const cutoff = now - RETENTION_THRESHOLD_MS;

    const expired = await ctx.db
      .query("expenses")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .filter((q) => q.neq(q.field("deletedAt"), undefined))
      .collect();

    let purgedExpenses = 0;
    for (const expense of expired) {
      const deletedAt = expense.deletedAt;
      if (deletedAt === undefined || deletedAt >= cutoff) continue;

      const storageIds = expense.receiptImageIds?.length
        ? expense.receiptImageIds
        : expense.receiptImageId
          ? [expense.receiptImageId]
          : [];
      for (const storageId of storageIds) {
        try {
          await ctx.storage.delete(storageId);
        } catch {
          // Storage deletion is best-effort; record claim keeps references safe.
        }
      }

      await ctx.db.delete(expense._id);
      purgedExpenses += 1;
    }

    const expiredSettlements = await ctx.db
      .query("settlements")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .filter((q) => q.neq(q.field("deletedAt"), undefined))
      .collect();

    let purgedSettlements = 0;
    for (const settlement of expiredSettlements) {
      const deletedAt = settlement.deletedAt;
      if (deletedAt === undefined || deletedAt >= cutoff) continue;
      await ctx.db.delete(settlement._id);
      purgedSettlements += 1;
    }

    return { purgedExpenses, purgedSettlements };
  },
});

export const getExpiredExpensesCount = internalQuery({
  args: { orgId: v.string() },
  handler: async (ctx, args) => {
    const now = Date.now();
    const cutoff = now - RETENTION_THRESHOLD_MS;
    const expired = await ctx.db
      .query("expenses")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .filter((q) => q.neq(q.field("deletedAt"), undefined))
      .collect();
    const expiredNow = expired.filter((e) => e.deletedAt !== undefined && e.deletedAt < cutoff).length;
    return { expiredNow };
  },
});

export const scheduleRetention = internalAction({
  args: {},
  handler: async (ctx) => {
    const orgs = await ctx.db
      .query("orgs")
      .collect();
    for (const org of orgs) {
      await ctx.runMutation(internal.functions.retention.purgeExpiredExpenses, { orgId: org.slug });
    }
    await ctx.scheduler.runAfter(24 * 60 * 60 * 1000, internal.functions.retention.scheduleRetention);
    return { ok: true };
  },
});
