import { query } from "convex/server";
import { v } from "convex/values";
import { requireAuthenticatedOrg } from "./auth";

// Reports

export interface ReportFilter {
  orgId: string;
  dateFrom?: string;
  dateTo?: string;
  category?: string;
  userId?: string;
  status?: string;
}

export const generateReport = query({
  args: {
    dateFrom: v.optional(v.string()),
    dateTo: v.optional(v.string()),
    category: v.optional(v.string()),
    userId: v.optional(v.string()),
    status: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { orgId } = await requireAuthenticatedOrg(ctx);

    const queryBuilder = ctx.db.query("expenses")
      .withIndex("by_org", (q) => q.eq("orgId", orgId));

    const results = await queryBuilder.collect();

    let filtered = results.filter((exp) => !exp.deletedAt);

    if (args.dateFrom) {
      filtered = filtered.filter((exp) => exp.date >= args.dateFrom!);
    }
    if (args.dateTo) {
      filtered = filtered.filter((exp) => exp.date <= args.dateTo!);
    }
    if (args.category) {
      filtered = filtered.filter((exp) => exp.category === args.category);
    }
    if (args.userId) {
      filtered = filtered.filter((exp) => exp.enteredBy === args.userId);
    }
    if (args.status) {
      filtered = filtered.filter((exp) => exp.status === args.status);
    }

    // Sort by date descending
    filtered.sort((a, b) => b.date.localeCompare(a.date));

    return filtered;
  },
});

export const generate = generateReport;

export const exportReportCsv = query({
  args: {
    dateFrom: v.optional(v.string()),
    dateTo: v.optional(v.string()),
    category: v.optional(v.string()),
    userId: v.optional(v.string()),
    status: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { orgId } = await requireAuthenticatedOrg(ctx);

    const queryBuilder = ctx.db.query("expenses")
      .withIndex("by_org", (q) => q.eq("orgId", orgId));

    const results = await queryBuilder.collect();

    let filtered = results.filter((exp) => !exp.deletedAt);

    if (args.dateFrom) {
      filtered = filtered.filter((exp) => exp.date >= args.dateFrom!);
    }
    if (args.dateTo) {
      filtered = filtered.filter((exp) => exp.date <= args.dateTo!);
    }
    if (args.category) {
      filtered = filtered.filter((exp) => exp.category === args.category);
    }
    if (args.userId) {
      filtered = filtered.filter((exp) => exp.enteredBy === args.userId);
    }
    if (args.status) {
      filtered = filtered.filter((exp) => exp.status === args.status);
    }

    filtered.sort((a, b) => b.date.localeCompare(a.date));

    // Generate CSV with proper escaping
    const headers = ["Date", "Category", "Amount", "Paid By", "Status", "Notes", "Receipt"];
    const escapeCsv = (val: string) => {
      if (val.includes(",") || val.includes('"') || val.includes("\n") || val.includes("\r")) {
        return '"' + val.replace(/"/g, '""') + '"';
      }
      return val;
    };
    const rows = filtered.map((exp) => [
      escapeCsv(exp.date),
      escapeCsv(exp.category),
      escapeCsv((exp.amount / 100).toFixed(2)),
      escapeCsv(exp.paidBy),
      escapeCsv(exp.status),
      escapeCsv(exp.notes || ""),
      escapeCsv(exp.receiptImageId ? "Yes" : "No"),
    ]);

    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    return csv;
  },
});

export const exportCsv = exportReportCsv;

export const getExpenseSummary = query({
  args: {},
  handler: async (ctx, _args) => {
    const { orgId } = await requireAuthenticatedOrg(ctx);

    const expenses = await ctx.db.query("expenses")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .filter((q) => q.eq(q.field("status"), "approved"))
      .filter((q) => q.eq(q.field("deletedAt"), undefined))
      .collect();

    const byCategory: Record<string, number> = {};
    const byMonth: Record<string, number> = {};
    const byPayer: Record<string, number> = {};

    for (const exp of expenses) {
      byCategory[exp.category] = (byCategory[exp.category] || 0) + exp.amount;
      const month = exp.date.slice(0, 7); // YYYY-MM
      byMonth[month] = (byMonth[month] || 0) + exp.amount;
      byPayer[exp.paidBy] = (byPayer[exp.paidBy] || 0) + exp.amount;
    }

    return {
      total: expenses.reduce((sum, exp) => sum + exp.amount, 0),
      byCategory,
      byMonth,
      byPayer,
    };
  },
});

export const summary = getExpenseSummary;
export const getSummary = getExpenseSummary;