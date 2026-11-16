import { internalAction, internalMutation, internalQuery, mutation, query } from "../_generated/server";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { requireAuthenticatedOrg } from "../auth";

const REPORT_RETENTION_DAYS = 90;
const MAX_REPORT_ROWS = 10_000;

interface ReportConfig {
  dateFrom?: string;
  dateTo?: string;
  category?: string;
  userId?: string;
  status?: string;
  dateRange?: string;
  grouping?: string;
}

interface ReportDoc {
  _id: string;
  orgId: string;
  userId: string;
  name: string;
  type: "monthly_summary" | "category_breakdown" | "settlement_history" | "budget_variance" | "custom";
  config: ReportConfig;
  format: "csv" | "json";
  status: "generating" | "ready" | "failed";
  storageId?: string;
  downloadUrl?: string;
  expiresAt: number;
  scheduled?: boolean;
  scheduleCron?: string;
  lastGeneratedAt?: number;
  createdAt: number;
}

function getCutoffDate(period: string): number {
  const now = Date.now();
  const periodMs: Record<string, number> = {
    week: 7 * 24 * 60 * 60 * 1000,
    month: 30 * 24 * 60 * 60 * 1000,
    quarter: 90 * 24 * 60 * 60 * 1000,
    year: 365 * 24 * 60 * 60 * 1000,
  };
  return now - (periodMs[period] ?? periodMs.month ?? 0);
}

function escapeCsv(val: string): string {
  if (val.includes(",") || val.includes('"') || val.includes("\n") || val.includes("\r")) {
    return '"' + val.replace(/"/g, '""') + '"';
  }
  return val;
}

function formatCsv(headers: string[], rows: string[][]): string {
  return [headers.map(escapeCsv).join(","), ...rows.map((r) => r.map(escapeCsv).join(","))].join("\n");
}

function formatJson(data: Record<string, unknown>): string {
  return JSON.stringify(data, null, 2);
}

async function uploadToStorage(ctx: MutationCtx, content: string, filename: string, contentType: string): Promise<Id<"_storage">> {
  const file = new File([content], filename, { type: contentType });
  const storageId = await ctx.storage.store(file);
  return storageId;
}

async function generateSignedUrl(ctx: MutationCtx, storageId: Id<"_storage">): Promise<string> {
  const url = await ctx.storage.getUrl(storageId);
  if (!url) {
    throw new Error("Failed to generate signed URL");
  }
  return url;
}

function fetchExpenses(ctx: QueryCtx, orgId: string, config: ReportConfig): Promise<unknown[]> {
  let builder = ctx.db.query("expenses")
    .withIndex("by_org", (q) => q.eq("orgId", orgId))
    .filter((q) => q.eq(q.field("deletedAt"), undefined));

  if (config.dateRange) {
    const cutoff = getCutoffDate(config.dateRange);
    builder = builder.filter((q) => q.gte(q.field("createdAt"), cutoff));
  }
  if (config.dateFrom) {
    const dateFrom = config.dateFrom;
    builder = builder.filter((q) => q.gte(q.field("date"), dateFrom));
  }
  if (config.dateTo) {
    const dateTo = config.dateTo;
    builder = builder.filter((q) => q.lte(q.field("date"), dateTo));
  }
  if (config.category) {
    const category = config.category;
    builder = builder.filter((q) => q.eq(q.field("category"), category));
  }
  if (config.userId) {
    const userId = config.userId;
    builder = builder.filter((q) => q.eq(q.field("paidBy"), userId));
  }
  if (config.status) {
    const status = config.status;
    builder = builder.filter((q) => q.eq(q.field("status"), status));
  }

  return builder.order("desc").take(MAX_REPORT_ROWS);
}

function fetchSettlements(ctx: QueryCtx, orgId: string, config: ReportConfig): Promise<unknown[]> {
  let builder = ctx.db.query("settlements")
    .withIndex("by_org", (q) => q.eq("orgId", orgId))
    .filter((q) => q.eq(q.field("deletedAt"), undefined));

  if (config.dateRange) {
    const cutoff = getCutoffDate(config.dateRange);
    builder = builder.filter((q) => q.gte(q.field("createdAt"), cutoff));
  }
  if (config.dateFrom) {
    const dateFrom = config.dateFrom;
    builder = builder.filter((q) => q.gte(q.field("date"), dateFrom));
  }
  if (config.dateTo) {
    const dateTo = config.dateTo;
    builder = builder.filter((q) => q.lte(q.field("date"), dateTo));
  }

  return builder.order("desc").take(MAX_REPORT_ROWS);
}

function fetchBudgets(ctx: QueryCtx, orgId: string): Promise<unknown[]> {
  return ctx.db.query("budgets")
    .withIndex("by_org", (q) => q.eq("orgId", orgId))
    .filter((q) => q.eq(q.field("deletedAt"), undefined))
    .order("desc")
    .take(MAX_REPORT_ROWS);
}

interface ExpenseRow {
  date: string;
  category: string;
  amount: number;
  status: string;
  receiptImageId?: string;
}

interface SettlementRow {
  date: string;
  fromUser: string;
  toUser: string;
  amount: number;
}

interface BudgetRow {
  category: string;
  amount: number;
}

function buildReportContent(
  reportType: ReportDoc["type"],
  expenses: ExpenseRow[],
  settlements: SettlementRow[],
  budgets: BudgetRow[],
  format: ReportDoc["format"],
): { content: string; contentType: string; filename: string } {
  if (reportType === "settlement_history") {
    if (format === "csv") {
      const headers = ["Date", "From", "To", "Amount"];
      const rows = settlements.map((s) => [s.date, s.fromUser, s.toUser, (s.amount / 100).toFixed(2)]);
      return { content: formatCsv(headers, rows), contentType: "text/csv", filename: `settlement-history-${Date.now()}.csv` };
    } else if (format === "json") {
      return {
        content: formatJson({ settlements, generatedAt: Date.now() }),
        contentType: "application/json",
        filename: `settlement-history-${Date.now()}.json`,
      };
    }
    throw new Error("PDF not supported for settlement history");
  }

  if (reportType === "budget_variance") {
    const catSpend = new Map<string, number>();
    for (const exp of expenses) {
      catSpend.set(exp.category, (catSpend.get(exp.category) || 0) + exp.amount);
    }
    const data = budgets.map((b) => ({
      category: b.category,
      budget: b.amount / 100,
      spent: (catSpend.get(b.category) || 0) / 100,
      variance: ((catSpend.get(b.category) || 0) - b.amount) / 100,
      pct: b.amount > 0 ? ((catSpend.get(b.category) || 0) / b.amount) * 100 : 0,
    }));
    if (format === "csv") {
      const headers = ["Category", "Budget ($)", "Spent ($)", "Variance ($)", "Usage (%)"];
      const rows = data.map((d) => [
        d.category,
        d.budget.toFixed(2),
        d.spent.toFixed(2),
        d.variance.toFixed(2),
        d.pct.toFixed(1),
      ]);
      return { content: formatCsv(headers, rows), contentType: "text/csv", filename: `budget-variance-${Date.now()}.csv` };
    } else if (format === "json") {
      return { content: formatJson({ data, generatedAt: Date.now() }), contentType: "application/json", filename: `budget-variance-${Date.now()}.json` };
    }
    throw new Error("PDF not supported for budget variance");
  }

  if (reportType === "monthly_summary") {
    const byMonth: Record<string, number> = {};
    const byCategory: Record<string, number> = {};
    for (const exp of expenses) {
      const month = exp.date.slice(0, 7);
      byMonth[month] = (byMonth[month] || 0) + exp.amount;
      byCategory[exp.category] = (byCategory[exp.category] || 0) + exp.amount;
    }
    const data = Object.entries(byMonth).map(([month, amount]) => ({
      month,
      total: amount / 100,
      categories: Object.entries(byCategory).map(([cat, amt]) => ({ category: cat, amount: amt / 100 })),
    }));
    if (format === "csv") {
      const headers = ["Month", "Total ($)"];
      const rows = data.map((d) => [d.month, d.total.toFixed(2)]);
      return { content: formatCsv(headers, rows), contentType: "text/csv", filename: `monthly-summary-${Date.now()}.csv` };
    } else if (format === "json") {
      return { content: formatJson({ data, generatedAt: Date.now() }), contentType: "application/json", filename: `monthly-summary-${Date.now()}.json` };
    }
    throw new Error("PDF not supported for monthly summary");
  }

  // category_breakdown or custom
  if (reportType === "category_breakdown") {
    const byCategory: Record<string, number> = {};
    for (const exp of expenses) {
      byCategory[exp.category] = (byCategory[exp.category] || 0) + exp.amount;
    }
    const data = Object.entries(byCategory)
      .map(([category, amount]) => ({ category, amount: amount / 100 }))
      .sort((a, b) => b.amount - a.amount);
    if (format === "csv") {
      const headers = ["Category", "Amount ($)"];
      const rows = data.map((d) => [d.category, d.amount.toFixed(2)]);
      return { content: formatCsv(headers, rows), contentType: "text/csv", filename: `category-breakdown-${Date.now()}.csv` };
    } else if (format === "json") {
      return { content: formatJson({ data, generatedAt: Date.now() }), contentType: "application/json", filename: `category-breakdown-${Date.now()}.json` };
    }
    throw new Error("PDF not supported for category breakdown");
  }

  // custom report type
  if (format === "csv") {
    const headers = ["Date", "Category", "Amount", "Status", "Has Receipt"];
    const rows = expenses.map((exp) => [exp.date, exp.category, (exp.amount / 100).toFixed(2), exp.status, exp.receiptImageId ? "Yes" : "No"]);
    return { content: formatCsv(headers, rows), contentType: "text/csv", filename: `custom-report-${Date.now()}.csv` };
  } else if (format === "json") {
    return { content: formatJson({ expenses, generatedAt: Date.now() }), contentType: "application/json", filename: `custom-report-${Date.now()}.json` };
  }
  throw new Error("PDF not supported for custom report");
}

export const listReports = query({
  args: {},
  handler: async (ctx) => {
    const { userId, orgId } = await requireAuthenticatedOrg(ctx);
    return ctx.db
      .query("reports")
      .withIndex("by_org_user", (q) => q.eq("orgId", orgId).eq("userId", userId))
      .order("desc")
      .collect();
  },
});

export const generateReport = mutation({
  args: {
    reportId: v.id("reports"),
  },
  handler: async (ctx, args) => {
    const { userId, orgId } = await requireAuthenticatedOrg(ctx);

    const report = (await ctx.db.get(args.reportId)) as ReportDoc | null;
    if (!report || report.orgId !== orgId || report.userId !== userId) {
      throw new Error("Report not found");
    }

    await ctx.db.patch(args.reportId, { status: "generating" });

    try {
      const contentInfo = await runReportGeneration(ctx, report);
      const storageId = await uploadToStorage(ctx, contentInfo.content, contentInfo.filename, contentInfo.contentType);
      const downloadUrl = await generateSignedUrl(ctx, storageId);
      const expiresAt = Date.now() + REPORT_RETENTION_DAYS * 24 * 60 * 60 * 1000;

      await ctx.db.patch(args.reportId, {
        status: "ready",
        storageId,
        downloadUrl,
        expiresAt,
        lastGeneratedAt: Date.now(),
      });

      return { downloadUrl, storageId };
    } catch (error) {
      await ctx.db.patch(args.reportId, { status: "failed" });
      throw error;
    }
  },
});

export const createReport = mutation({
  args: {
    name: v.string(),
    type: v.union(
      v.literal("monthly_summary"),
      v.literal("category_breakdown"),
      v.literal("settlement_history"),
      v.literal("budget_variance"),
      v.literal("custom"),
    ),
    config: v.optional(
      v.object({
        dateFrom: v.optional(v.string()),
        dateTo: v.optional(v.string()),
        category: v.optional(v.string()),
        userId: v.optional(v.string()),
        status: v.optional(v.string()),
        dateRange: v.optional(v.string()),
        grouping: v.optional(v.string()),
      }),
    ),
    scheduleCron: v.optional(v.string()),
    format: v.union(v.literal("csv"), v.literal("json")),
  },
  handler: async (ctx, args) => {
    const { userId, orgId } = await requireAuthenticatedOrg(ctx);

    const todayStart = new Date().setHours(0, 0, 0, 0);
    const recentReports = await ctx.db
      .query("reports")
      .withIndex("by_org_user", (q) => q.eq("orgId", orgId).eq("userId", userId))
      .collect();
    const todayCount = recentReports.filter((r) => r.createdAt >= todayStart).length;
    if (todayCount >= 100) {
      throw new Error("Daily report creation limit reached");
    }

    const now = Date.now();
    const expiresAt = now + REPORT_RETENTION_DAYS * 24 * 60 * 60 * 1000;

    const id = await ctx.db.insert("reports", {
      orgId,
      userId,
      name: args.name,
      type: args.type,
      config: args.config,
      format: args.format,
      status: "generating",
      scheduled: !!args.scheduleCron,
      scheduleCron: args.scheduleCron,
      expiresAt,
      createdAt: now,
    });

    const report = (await ctx.db.get(id)) as ReportDoc | null;
    if (!report) throw new Error("Report not found");

    const contentInfo = await runReportGeneration(ctx, report);
    const storageId = await uploadToStorage(ctx, contentInfo.content, contentInfo.filename, contentInfo.contentType);
    const downloadUrl = await generateSignedUrl(ctx, storageId);

    await ctx.db.patch(id, {
      status: "ready",
      storageId,
      downloadUrl,
      expiresAt,
      lastGeneratedAt: Date.now(),
    });

    return { id, downloadUrl, storageId };
  },
});

async function runReportGeneration(ctx: QueryCtx, report: ReportDoc): Promise<{ content: string; contentType: string; filename: string }> {
  const config = report.config;
  const format = report.format;
  const expenses: unknown[] = [];
  const settlements: unknown[] = [];
  const budgets: unknown[] = [];

  if (report.type === "settlement_history") {
    settlements.push(...((await fetchSettlements(ctx, report.orgId, config)) as unknown[]));
  } else if (report.type === "budget_variance") {
    expenses.push(...((await fetchExpenses(ctx, report.orgId, config)) as unknown[]));
    budgets.push(...((await fetchBudgets(ctx, report.orgId)) as unknown[]));
  } else {
    expenses.push(...((await fetchExpenses(ctx, report.orgId, config)) as unknown[]));
    budgets.push(...((await fetchBudgets(ctx, report.orgId)) as unknown[]));
  }

  const content = buildReportContent(report.type as ReportDoc["type"], expenses as ExpenseRow[], settlements as SettlementRow[], budgets as BudgetRow[], format);
  return content;
}

export const deleteReport = mutation({
  args: { reportId: v.id("reports") },
  handler: async (ctx, args) => {
    const { userId, orgId } = await requireAuthenticatedOrg(ctx);

    const report = (await ctx.db.get(args.reportId)) as ReportDoc | null;
    if (!report || report.orgId !== orgId || report.userId !== userId) {
      throw new Error("Report not found");
    }

    if (report.storageId) {
      try {
        await ctx.storage.delete(report.storageId as Id<"_storage">);
      } catch {
        // Storage cleanup best-effort; ignore errors
      }
    }

    await ctx.db.delete(args.reportId);
    return { success: true };
  },
});

export const scheduleReport = mutation({
  args: {
    name: v.string(),
    type: v.union(
      v.literal("monthly_summary"),
      v.literal("category_breakdown"),
      v.literal("settlement_history"),
      v.literal("budget_variance"),
      v.literal("custom"),
    ),
    config: v.optional(
      v.object({
        dateFrom: v.optional(v.string()),
        dateTo: v.optional(v.string()),
        category: v.optional(v.string()),
        userId: v.optional(v.string()),
        status: v.optional(v.string()),
        dateRange: v.optional(v.string()),
        grouping: v.optional(v.string()),
      }),
    ),
    scheduleCron: v.string(),
    format: v.union(v.literal("csv"), v.literal("json")),
  },
  handler: async (ctx, args) => {
    const { userId, orgId } = await requireAuthenticatedOrg(ctx);
    const now = Date.now();
    const expiresAt = now + REPORT_RETENTION_DAYS * 24 * 60 * 60 * 1000;

    const id = await ctx.db.insert("reports", {
      orgId,
      userId,
      name: args.name,
      type: args.type,
      config: args.config,
      format: args.format,
      status: "ready",
      scheduled: true,
      scheduleCron: args.scheduleCron,
      expiresAt,
      createdAt: now,
    });

    return { id };
  },
});

export const unscheduleReport = mutation({
  args: { reportId: v.id("reports") },
  handler: async (ctx, args) => {
    const { userId, orgId } = await requireAuthenticatedOrg(ctx);

    const report = (await ctx.db.get(args.reportId)) as ReportDoc | null;
    if (!report || report.orgId !== orgId || report.userId !== userId) {
      throw new Error("Report not found");
    }

    await ctx.db.patch(args.reportId, { scheduled: false, scheduleCron: undefined });
    return { success: true };
  },
});

export const getDownloadUrl = mutation({
  args: { reportId: v.id("reports") },
  handler: async (ctx, args) => {
    const { userId, orgId } = await requireAuthenticatedOrg(ctx);

    const report = (await ctx.db.get(args.reportId)) as ReportDoc | null;
    if (!report || report.orgId !== orgId || report.userId !== userId) {
      throw new Error("Report not found");
    }

    if (report.status !== "ready" || !report.storageId) {
      throw new Error("Report not ready");
    }

    if (report.expiresAt < Date.now()) {
      throw new Error("Report expired");
    }

    const downloadUrl = await generateSignedUrl(ctx, report.storageId as Id<"_storage">);
    await ctx.db.patch(args.reportId, { downloadUrl });
    return { downloadUrl };
  },
});

export const getScheduledReports = internalQuery({
  args: {},
  handler: async (ctx) => {
    return ctx.db.query("reports").filter((q) => q.eq(q.field("scheduled"), true)).collect();
  },
});

export const internalGenerateReport = internalMutation({
  args: { reportId: v.id("reports") },
  handler: async (ctx, args) => {
    const report = (await ctx.db.get(args.reportId)) as ReportDoc | null;
    if (!report) {
      throw new Error("Report not found");
    }

    const contentInfo = await runReportGeneration(ctx, report);
    const storageId = await uploadToStorage(ctx, contentInfo.content, contentInfo.filename, contentInfo.contentType);
    const downloadUrl = await generateSignedUrl(ctx, storageId);
    const expiresAt = Date.now() + REPORT_RETENTION_DAYS * 24 * 60 * 60 * 1000;

    await ctx.db.patch(args.reportId, {
      status: "ready",
      storageId,
      downloadUrl,
      expiresAt,
      lastGeneratedAt: Date.now(),
    });

    return { downloadUrl, storageId };
  },
});

export const generateScheduled = internalAction({
  args: {},
  handler: async (ctx) => {
    const now = new Date();
    const reports = await ctx.runQuery(internal.functions.reports.getScheduledReports, {});
    for (const report of reports) {
      const doc = report as ReportDoc;
      if (!doc.scheduled || !doc.scheduleCron) continue;

      const cron = doc.scheduleCron;
      const matches = cronMatch(cron, now);
      if (!matches) continue;

      try {
        await ctx.runMutation(internal.functions.reports.internalGenerateReport, { reportId: doc._id as Id<"reports"> });
      } catch (error) {
        console.error(`Failed to generate scheduled report ${doc._id}:`, error);
      }
    }
  },
});

export function cronFieldMatch(expr: string, value: number, min: number, max: number): boolean {
  if (expr === "*") return true;

  const parts = expr.split(",");
  for (const part of parts) {
    let step: number | null = null;
    let range = part;

    const stepIdx = part.indexOf("/");
    if (stepIdx !== -1) {
      step = parseInt(part.slice(stepIdx + 1), 10);
      if (isNaN(step) || step <= 0) return false;
      range = part.slice(0, stepIdx);
    }

    if (range === "*") {
      if (step === null) return true;
      if (value % step === 0) return true;
      continue;
    }

    const dashIdx = range.indexOf("-");
    let low: number, high: number;
    if (dashIdx !== -1) {
      low = parseInt(range.slice(0, dashIdx), 10);
      high = parseInt(range.slice(dashIdx + 1), 10);
      if (isNaN(low) || isNaN(high) || low < min || high > max || low > high) return false;
    } else {
      low = high = parseInt(range, 10);
      if (isNaN(low) || low < min || low > max) return false;
    }

    if (value < low || value > high) continue;

    if (step === null) {
      return true;
    }

    if ((value - low) % step === 0) return true;
  }

  return false;
}

export function cronMatch(cron: string, now: Date): boolean {
  const parts = cron.split(" ");
  if (parts.length !== 5) return false;

  const minute = parts[0] ?? "";
  const hour = parts[1] ?? "";
  const dayOfMonth = parts[2] ?? "";
  const month = parts[3] ?? "";
  const dayOfWeek = parts[4] ?? "";

  return (
    cronFieldMatch(minute, now.getUTCMinutes(), 0, 59) &&
    cronFieldMatch(hour, now.getUTCHours(), 0, 23) &&
    cronFieldMatch(dayOfMonth, now.getUTCDate(), 1, 31) &&
    cronFieldMatch(month, now.getUTCMonth() + 1, 1, 12) &&
    cronFieldMatch(dayOfWeek, now.getUTCDay(), 0, 7)
  );
}
