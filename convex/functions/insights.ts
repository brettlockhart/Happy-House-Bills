import { query } from "../_generated/server";
import { requireAuthenticatedOrg } from "../auth";

export const insights = query({
  args: {},
  handler: async (ctx) => {
    const { orgId } = await requireAuthenticatedOrg(ctx);

    const expenses = await ctx.db
      .query("expenses")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .filter((q) => q.eq(q.field("deletedAt"), undefined))
      .filter((q) => q.eq(q.field("status"), "approved"))
      .collect();

    const insights: Array<{ type: string; severity: string; message: string }> = [];

    const byCategory: Record<string, number> = {};
    const byDay: Record<string, number> = {};
    for (const e of expenses) {
      const cat = e.category ?? "other";
      byCategory[cat] = (byCategory[cat] || 0) + e.amount;
      const day = new Date(e.date).toISOString().slice(0, 10);
      byDay[day] = (byDay[day] || 0) + e.amount;
    }

    const sortedCategories = Object.entries(byCategory)
      .map(([cat, amount]) => ({
        category: cat,
        amount,
      }))
      .sort((a, b) => b.amount - a.amount);

    if (sortedCategories.length > 0) {
      const top = sortedCategories[0]!;
      const totalAll = sortedCategories.reduce((s, c) => s + c.amount, 0);
      const share = totalAll > 0 ? top.amount / totalAll : 0;
      if (share > 0.5) {
        insights.push({
          type: "spending_pattern",
          severity: "info",
          message: `"${top.category}" accounts for ${Math.round(share * 100)}% of spending`,
        });
      }
    }

    const avgDaily =
      Object.keys(byDay).length > 0
        ? Object.values(byDay).reduce((s, a) => s + a, 0) / Object.keys(byDay).length
        : 0;

    for (const [day, amount] of Object.entries(byDay)) {
      if (amount > avgDaily * 2 && avgDaily > 0) {
        insights.push({
          type: "spike",
          severity: "warning",
          message: `Spending spike on ${day}: $${Math.round(amount * 100) / 100} (2x daily average)`,
        });
        break;
      }
    }

    if (insights.length === 0) {
      insights.push({
        type: "positive",
        severity: "info",
        message: "No anomalies detected — spending is within normal ranges",
      });
    }

    return { insights };
  },
});
