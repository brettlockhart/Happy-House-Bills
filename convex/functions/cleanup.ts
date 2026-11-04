import { internalMutation } from "../_generated/server";
import { v } from "convex/values";

export const cleanupOrganization = internalMutation({
  args: { orgId: v.string() },
  handler: async (ctx, args) => {
    const expenses = await ctx.db
      .query("expenses")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();

    for (const expense of expenses) {
      await ctx.db.patch(expense._id, { deletedAt: Date.now() });
    }

    const settlements = await ctx.db
      .query("settlements")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();

    for (const settlement of settlements) {
      await ctx.db.patch(settlement._id, { deletedAt: Date.now() });
    }
  },
});
