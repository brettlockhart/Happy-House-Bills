import { query, type QueryCtx } from "../_generated/server";
import { v } from "convex/values";
import { requireAuthenticatedOrg } from "../auth";

const MAX_ANALYTICS_ROWS = 10_000;

interface MembershipDoc {
  userId: string;
  subscriptionRole?: string;
  status?: string;
  deletedAt?: number;
}

interface ExpenseDoc {
  enteredBy: string;
  amount: number;
  share?: number;
  category?: string;
  status?: string;
  deletedAt?: number;
  date: string;
  createdAt: number;
}

function getSubscriptionRank(role: string): number {
  const ranks: Record<string, number> = { free: 0, paying: 1, admin: 2 };
  return ranks[role] ?? 0;
}

async function getActiveMemberships(ctx: QueryCtx, orgId: string): Promise<Array<MembershipDoc>> {
  return ctx.db
    .query("memberships")
    .withIndex("by_org", (q) => q.eq("orgId", orgId))
    .filter((q) => q.eq(q.field("status"), "active"))
    .filter((q) => q.eq(q.field("deletedAt"), undefined))
    .take(MAX_ANALYTICS_ROWS);
}

function buildRoleMap(memberships: Array<MembershipDoc>) {
  const map = new Map<string, string>();
  for (const m of memberships) {
    map.set(m.userId, m.subscriptionRole ?? "free");
  }
  return map;
}

const ENTITLED_SUBSCRIPTION_STATUSES = new Set(["active", "trialing", "local_test"]);

async function requirePayingMember(ctx: QueryCtx, orgId: string, userId: string) {
  const membership = await ctx.db
    .query("memberships")
    .withIndex("by_org_user", (q) => q.eq("orgId", orgId).eq("userId", userId))
    .filter((q) => q.eq(q.field("status"), "active"))
    .filter((q) => q.eq(q.field("deletedAt"), undefined))
    .first();

  if (!membership) {
    throw new Error("You are not a member of this organization");
  }

  const role = membership.subscriptionRole ?? "free";
  if (getSubscriptionRank(role) < getSubscriptionRank("paying")) {
    throw new Error("Group analytics requires a paid subscription. Please upgrade to access this feature.");
  }

  const subscription = await ctx.db
    .query("subscriptions")
    .withIndex("by_org", (q) => q.eq("orgId", orgId))
    .first();
  const subscriptionStatus = subscription?.status;
  const subscriptionEntitled = subscriptionStatus === undefined || ENTITLED_SUBSCRIPTION_STATUSES.has(subscriptionStatus);
  if (!subscriptionEntitled) {
    throw new Error("Group analytics requires a paid subscription. Please upgrade to access this feature.");
  }

  return role;
}

async function getApprovedExpenses(ctx: QueryCtx, orgId: string): Promise<Array<ExpenseDoc>> {
  return ctx.db
    .query("expenses")
    .withIndex("by_org", (q) => q.eq("orgId", orgId))
    .filter((q) => q.eq(q.field("deletedAt"), undefined))
    .filter((q) => q.eq(q.field("status"), "approved"))
    .take(MAX_ANALYTICS_ROWS);
}

export const groupSpendingByRole = query({
  args: {},
  handler: async (ctx) => {
    const { orgId, userId } = await requireAuthenticatedOrg(ctx);
    await requirePayingMember(ctx, orgId, userId);

    const memberships = await getActiveMemberships(ctx, orgId);
    const roleMap = buildRoleMap(memberships);

    const roleCounts: Record<string, number> = {};
    for (const m of memberships) {
      const role = m.subscriptionRole ?? "free";
      roleCounts[role] = (roleCounts[role] || 0) + 1;
    }

    const expenses = await getApprovedExpenses(ctx, orgId);

    const byRole: Record<string, number> = { admin: 0, paying: 0, free: 0 };
    for (const e of expenses) {
      const role = roleMap.get(e.enteredBy) ?? "free";
      byRole[role] = (byRole[role] || 0) + e.amount;
    }

    return {
      orgId,
      byRole: {
        admin: byRole.admin || 0,
        paying: byRole.paying || 0,
        free: byRole.free || 0,
      },
      roleCounts,
      totalExpenses: expenses.length,
      totalAmount: expenses.reduce((sum, e) => sum + e.amount, 0),
    };
  },
});

export const shareEfficiency = query({
  args: {},
  handler: async (ctx) => {
    const { orgId, userId } = await requireAuthenticatedOrg(ctx);
    await requirePayingMember(ctx, orgId, userId);

    const memberships = await getActiveMemberships(ctx, orgId);
    const roleMap = buildRoleMap(memberships);

    const roleTotals: Record<string, number> = { admin: 0, paying: 0, free: 0 };
    const roleExpenses: Record<string, number> = { admin: 0, paying: 0, free: 0 };
    const roleShares: Record<string, number> = { admin: 0, paying: 0, free: 0 };

    const expenses = await getApprovedExpenses(ctx, orgId);

    for (const e of expenses) {
      const role = roleMap.get(e.enteredBy) ?? "free";
      roleTotals[role] = (roleTotals[role] || 0) + 1;
      roleExpenses[role] = (roleExpenses[role] || 0) + e.amount;
      roleShares[role] = (roleShares[role] || 0) + (e.share ?? 0);
    }

    const efficiency: Record<string, { count: number; total: number; avg: number; shareTotal: number; coverage: number }> = {};
    for (const role of ["admin", "paying", "free"] as const) {
      const count = roleTotals[role] || 0;
      const total = roleExpenses[role] || 0;
      const share = roleShares[role] || 0;
      efficiency[role] = {
        count,
        total: Math.round(total * 100) / 100,
        avg: count > 0 ? Math.round((total / count) * 100) / 100 : 0,
        shareTotal: Math.round(share * 100) / 100,
        coverage: total > 0 ? Math.round((share / total) * 100) / 100 : 0,
      };
    }

    const totalAmount = expenses.reduce((sum, e) => sum + e.amount, 0);
    const totalShares = expenses.reduce((sum, e) => sum + (e.share ?? 0), 0);

    return {
      orgId,
      efficiency,
      totalMembers: memberships.length,
      totalExpenses: expenses.length,
      totalAmount,
      totalShares,
      shareCoverage: totalAmount > 0 ? Math.round((totalShares / totalAmount) * 100) / 100 : 0,
    };
  },
});

export const memberBalances = query({
  args: {},
  handler: async (ctx) => {
    const { orgId, userId } = await requireAuthenticatedOrg(ctx);
    const callerRole = await requirePayingMember(ctx, orgId, userId);
    const isAdmin = callerRole === "admin";

    const memberships = await getActiveMemberships(ctx, orgId);

    const userIds = isAdmin
      ? memberships.map((m) => m.userId)
      : [userId];

    const expenses = await getApprovedExpenses(ctx, orgId);

    const balances = userIds.map((uid) => {
      const memberExpenses = expenses.filter((e) => e.enteredBy === uid);
      const totalSpent = memberExpenses.reduce((sum, e) => sum + e.amount, 0);
      const shareSum = memberExpenses.reduce(
        (sum, e) => sum + (e.share ?? 0),
        0,
      );
      return {
        userId: uid,
        totalSpent: Math.round(totalSpent * 100) / 100,
        shareTotal: Math.round(shareSum * 100) / 100,
        balance: Math.round((totalSpent - shareSum) * 100) / 100,
        expenseCount: memberExpenses.length,
      };
    });

    return {
      orgId,
      balances,
      totalMembers: memberships.length,
      callerRole,
    };
  },
});

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
      .take(MAX_ANALYTICS_ROWS);

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
