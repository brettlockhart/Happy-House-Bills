import { internalAction, internalMutation, internalQuery, mutation, query } from "../_generated/server";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { v } from "convex/values";
import { requireAuthenticatedOrg } from "../auth";
import { assertOrgWriteAccess } from "./permissions";
import type { Doc, Id } from "../_generated/dataModel";
import { internal } from "../_generated/api";

type GoalDoc = Doc<"goals"> & { _id: Id<"goals"> };
type DbCtx = MutationCtx | QueryCtx;

const ALERT_NOTIFICATION_TITLE: Record<string, string> = {
  active: "Goal on track",
  at_risk: "Goal at risk",
  over_budget: "Goal over budget",
  achieved: "Goal achieved",
  paused: "Goal paused",
};

function monthBounds(now: number): { start: string; end: string } {
  const d = new Date(now);
  const start = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
  const end = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0));
  const fmt = (x: Date) => x.toISOString().slice(0, 10);
  return { start: fmt(start), end: fmt(end) };
}

async function sumApprovedExpenses(
  ctx: DbCtx,
  orgId: string,
  categoryId: Id<"categories"> | undefined,
): Promise<number> {
  const { start, end } = monthBounds(Date.now());
  const q = ctx.db
    .query("expenses")
    .withIndex("by_org_date", (q2) => q2.eq("orgId", orgId).gte("date", start).lte("date", end));
  const rows = (await q.collect()) as Array<Doc<"expenses">>;
  const approved = rows.filter(
    (e) => e.status === "approved" && e.deletedAt === undefined,
  );
  if (!categoryId) {
    return approved.reduce((s, e) => s + e.amount, 0);
  }
  return approved
    .filter((e) => e.categoryId === categoryId)
    .reduce((s, e) => s + e.amount, 0);
}

async function computeCurrent(ctx: DbCtx, goal: GoalDoc): Promise<number> {
  switch (goal.type) {
    case "savings_target":
      return goal.currentAmount;
    case "debt_payoff":
      return goal.currentAmount;
    case "monthly_spending_limit":
      return sumApprovedExpenses(ctx, goal.orgId, undefined);
    case "category_budget":
      return sumApprovedExpenses(ctx, goal.orgId, goal.categoryId);
  }
}

function deriveStatus(
  goal: { type: GoalDoc["type"]; alertAtPercent: number },
  progress: number,
): GoalDoc["status"] {
  if (goal.type === "savings_target" || goal.type === "debt_payoff") {
    if (progress >= 100) return "achieved";
    return "active";
  }
  if (progress >= 100) return "over_budget";
  if (progress >= goal.alertAtPercent) return "at_risk";
  return "active";
}

export const list = query({
  args: {
    status: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { orgId } = await requireAuthenticatedOrg(ctx);

    const q = ctx.db
      .query("goals")
      .withIndex("by_org", (q2) => q2.eq("orgId", orgId))
      .order("desc");

    const goals = (await q.collect()) as GoalDoc[];
    const filtered = args.status
      ? goals.filter((g) => g.status === args.status)
      : goals;

    return filtered.map((g) => ({
      ...g,
      progressPercent: g.progressPercent,
    }));
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    type: v.union(
      v.literal("savings_target"),
      v.literal("monthly_spending_limit"),
      v.literal("category_budget"),
      v.literal("debt_payoff"),
    ),
    targetAmount: v.number(),
    categoryId: v.optional(v.id("categories")),
    currentAmount: v.optional(v.number()),
    alertAtPercent: v.optional(v.number()),
    periodEnd: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { userId, orgId } = await requireAuthenticatedOrg(ctx);
    await assertOrgWriteAccess(ctx, orgId, userId);

    if (!args.name.trim() || args.name.length > 200) {
      throw new Error("Goal name must be 1-200 characters");
    }
    if (!Number.isFinite(args.targetAmount) || args.targetAmount <= 0) {
      throw new Error("Target amount must be a positive number");
    }
    if (args.currentAmount !== undefined && (!Number.isFinite(args.currentAmount) || args.currentAmount < 0)) {
      throw new Error("Current amount must be a non-negative number");
    }
    if (args.alertAtPercent !== undefined && (args.alertAtPercent < 1 || args.alertAtPercent > 99)) {
      throw new Error("alertAtPercent must be between 1 and 99");
    }

    if (args.categoryId) {
      const cat = await ctx.db.get(args.categoryId);
      if (!cat || cat.orgId !== orgId) {
        throw new Error("Category not found in this organisation");
      }
    }

    const now = Date.now();
    const currentAmount = args.currentAmount ?? 0;
    const progressPercent =
      args.targetAmount > 0 ? Math.min((currentAmount / args.targetAmount) * 100, 9999) : 0;
    const varianceAmount = currentAmount - args.targetAmount;
    const variancePercent =
      args.targetAmount > 0 ? (varianceAmount / args.targetAmount) * 100 : 0;

    const goal = {
      orgId,
      userId,
      name: args.name.trim(),
      type: args.type,
      targetAmount: args.targetAmount,
      categoryId: args.categoryId,
      currentAmount,
      progressPercent,
      varianceAmount,
      variancePercent,
      periodStart: now,
      status: deriveStatus(
        { type: args.type, alertAtPercent: args.alertAtPercent ?? 80 },
        progressPercent,
      ),
      alertAtPercent: args.alertAtPercent ?? 80,
      alertSent: false,
      createdAt: now,
      updatedAt: now,
    };

    return await ctx.db.insert("goals", goal);
  },
});

export const update = mutation({
  args: {
    goalId: v.id("goals"),
    name: v.optional(v.string()),
    targetAmount: v.optional(v.number()),
    currentAmount: v.optional(v.number()),
    alertAtPercent: v.optional(v.number()),
    status: v.optional(
      v.union(
        v.literal("active"),
        v.literal("achieved"),
        v.literal("at_risk"),
        v.literal("over_budget"),
        v.literal("paused"),
      ),
    ),
    periodEnd: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { userId: _userId, orgId } = await requireAuthenticatedOrg(ctx);
    await assertOrgWriteAccess(ctx, orgId, _userId);

    const goal = (await ctx.db.get(args.goalId)) as GoalDoc | null;
    if (!goal || goal.orgId !== orgId) {
      throw new Error("Goal not found in this organisation");
    }

    if (args.name !== undefined && (args.name.trim().length === 0 || args.name.length > 200)) {
      throw new Error("Goal name must be 1-200 characters");
    }
    if (args.targetAmount !== undefined && (!Number.isFinite(args.targetAmount) || args.targetAmount <= 0)) {
      throw new Error("Target amount must be a positive number");
    }
    if (args.currentAmount !== undefined && (!Number.isFinite(args.currentAmount) || args.currentAmount < 0)) {
      throw new Error("Current amount must be a non-negative number");
    }
    if (args.alertAtPercent !== undefined && (args.alertAtPercent < 1 || args.alertAtPercent > 99)) {
      throw new Error("alertAtPercent must be between 1 and 99");
    }

    const targetAmount = args.targetAmount ?? goal.targetAmount;
    const currentAmount = args.currentAmount ?? goal.currentAmount;
    const progressPercent =
      targetAmount > 0 ? Math.min((currentAmount / targetAmount) * 100, 9999) : 0;
    const varianceAmount = currentAmount - targetAmount;
    const variancePercent = targetAmount > 0 ? (varianceAmount / targetAmount) * 100 : 0;

    const patch: Record<string, unknown> = {
      name: args.name !== undefined ? args.name.trim() : goal.name,
      targetAmount,
      currentAmount,
      progressPercent,
      varianceAmount,
      variancePercent,
      alertAtPercent: args.alertAtPercent ?? goal.alertAtPercent,
      status: args.status ?? deriveStatus({ type: goal.type, alertAtPercent: args.alertAtPercent ?? goal.alertAtPercent }, progressPercent),
      updatedAt: Date.now(),
    };
    if (args.periodEnd !== undefined) {
      patch.periodEnd = args.periodEnd;
    }

    await ctx.db.patch(args.goalId, patch);
    return { id: args.goalId };
  },
});

export const remove = mutation({
  args: { goalId: v.id("goals") },
  handler: async (ctx, args) => {
    const { userId: _userId, orgId } = await requireAuthenticatedOrg(ctx);
    await assertOrgWriteAccess(ctx, orgId, _userId);

    const goal = (await ctx.db.get(args.goalId)) as GoalDoc | null;
    if (!goal || goal.orgId !== orgId) {
      throw new Error("Goal not found in this organisation");
    }

    await ctx.db.patch(args.goalId, { status: "paused", updatedAt: Date.now() });
    return { id: args.goalId, archived: true };
  },
});

export const getById = query({
  args: { goalId: v.id("goals") },
  handler: async (ctx, args) => {
    const { orgId } = await requireAuthenticatedOrg(ctx);
    const goal = (await ctx.db.get(args.goalId)) as GoalDoc | null;
    if (!goal || goal.orgId !== orgId) {
      throw new Error("Goal not found in this organisation");
    }
    return goal;
  },
});

export const updateProgress = internalMutation({
  args: { orgId: v.string() },
  handler: async (ctx, args) => {
    const goals = (await ctx.db
      .query("goals")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect()) as GoalDoc[];

    const active = goals.filter((g) => g.status === "active" || g.status === "at_risk");
    const now = Date.now();
    let totalUpdated = 0;

    for (const goal of active) {
      const current = await computeCurrent(ctx, goal);
      const progressPercent =
        goal.targetAmount > 0 ? Math.min((current / goal.targetAmount) * 100, 9999) : 0;
      const varianceAmount = current - goal.targetAmount;
      const variancePercent =
        goal.targetAmount > 0 ? (varianceAmount / goal.targetAmount) * 100 : 0;
      const status = deriveStatus(goal, progressPercent);

      let projectedCompletion: number | undefined;
      if (
        (goal.type === "savings_target" || goal.type === "debt_payoff") &&
        progressPercent > 0 &&
        progressPercent < 100
      ) {
        const ageMs = now - goal.createdAt;
        const remaining = Math.max(goal.targetAmount - current, 0);
        const ratePerMs = ageMs > 0 ? current / ageMs : 0;
        if (ratePerMs > 0 && remaining > 0) {
          projectedCompletion = now + remaining / ratePerMs;
        }
      }

      const alertSent = status === "active" ? false : goal.alertSent;

      await ctx.db.patch(goal._id, {
        currentAmount: current,
        progressPercent,
        varianceAmount,
        variancePercent,
        projectedCompletion,
        status,
        alertSent,
        updatedAt: now,
      });

      if (status !== "active" && !goal.alertSent) {
        await ctx.runMutation(internal.functions.goals.sendGoalAlert, {
          goalId: goal._id,
        });
      }

      totalUpdated++;
    }

    return { updated: totalUpdated };
  },
});

export const sendGoalAlert = internalMutation({
  args: { goalId: v.id("goals") },
  handler: async (ctx, args) => {
    const goal = (await ctx.db.get(args.goalId)) as GoalDoc | null;
    if (!goal) return { sent: false };

    await ctx.runMutation(internal.functions.notifications.createInternal, {
      orgId: goal.orgId,
      userId: goal.userId,
      type: "goal_alert",
      title: ALERT_NOTIFICATION_TITLE[goal.status] ?? "Goal update",
      body: `${goal.name}: ${goal.progressPercent.toFixed(0)}% (${goal.currentAmount.toFixed(2)} / ${goal.targetAmount.toFixed(2)})`,
      data: { goalId: goal._id, status: goal.status },
    });

    await ctx.db.patch(args.goalId, { alertSent: true });
    return { sent: true };
  },
});

export const listOrgs = internalQuery({
  args: {},
  handler: async (ctx) => {
    const goals = (await ctx.db.query("goals").collect()) as GoalDoc[];
    const orgIds = [...new Set(goals.map((g) => g.orgId))];
    return orgIds.map((orgId) => ({ orgId }));
  },
});

export const checkVariance = internalAction({
  args: {},
  handler: async (ctx) => {
    const orgs = (await ctx.runQuery(internal.functions.goals.listOrgs)) as Array<{ orgId: string }>;
    let totalUpdated = 0;
    for (const org of orgs) {
      const result = await ctx.runMutation(internal.functions.goals.updateProgress, {
        orgId: org.orgId,
      });
      totalUpdated += result.updated;
    }
    return { ok: true, updated: totalUpdated };
  },
});