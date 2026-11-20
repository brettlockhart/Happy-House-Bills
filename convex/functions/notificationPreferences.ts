import { query, mutation } from "../_generated/server";
import { v } from "convex/values";
import { requireAuthenticatedOrg } from "../auth";
import { assertOrgWriteAccess } from "./permissions";
import type { Doc, Id } from "../_generated/dataModel";

type PrefDoc = Doc<"notificationPreferences"> & { _id: Id<"notificationPreferences"> };

const DEFAULT_PREFS = {
  expensePending: true,
  expenseApproved: true,
  expenseRejected: true,
  settlementCreated: true,
  inviteSent: true,
  quietHoursStart: "22:00",
  quietHoursEnd: "08:00",
  batchWindowMs: 2000,
  emailFallback: true,
};

function validateTimeFormat(value: string): void {
  if (!/^\d{2}:\d{2}$/.test(value)) {
    throw new Error("Time must be in HH:MM format");
  }
  const parts = value.split(":");
  const h = Number(parts[0] ?? "0");
  const m = Number(parts[1] ?? "0");
  if (h < 0 || h > 23 || m < 0 || m > 59) {
    throw new Error("Time must be between 00:00 and 23:59");
  }
}

export const get = query({
  args: {},
  handler: async (ctx) => {
    const { orgId, userId } = await requireAuthenticatedOrg(ctx);
    const existing = (await ctx.db
      .query("notificationPreferences")
      .withIndex("by_org_user", (q) => q.eq("orgId", orgId).eq("userId", userId))
      .first()) as PrefDoc | null;

    if (existing) return existing;
    return { ...DEFAULT_PREFS, orgId, userId, updatedAt: Date.now() } as Omit<PrefDoc, "_id">;
  },
});

export const update = mutation({
  args: {
    expensePending: v.optional(v.boolean()),
    expenseApproved: v.optional(v.boolean()),
    expenseRejected: v.optional(v.boolean()),
    settlementCreated: v.optional(v.boolean()),
    inviteSent: v.optional(v.boolean()),
    quietHoursStart: v.optional(v.string()),
    quietHoursEnd: v.optional(v.string()),
    batchWindowMs: v.optional(v.number()),
    emailFallback: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { userId, orgId } = await requireAuthenticatedOrg(ctx);
    await assertOrgWriteAccess(ctx, orgId, userId);

    if (args.quietHoursStart !== undefined) validateTimeFormat(args.quietHoursStart);
    if (args.quietHoursEnd !== undefined) validateTimeFormat(args.quietHoursEnd);
    if (args.batchWindowMs !== undefined && (args.batchWindowMs < 0 || args.batchWindowMs > 60000)) {
      throw new Error("batchWindowMs must be between 0 and 60000");
    }

    const existing = (await ctx.db
      .query("notificationPreferences")
      .withIndex("by_org_user", (q) => q.eq("orgId", orgId).eq("userId", userId))
      .first()) as PrefDoc | null;

    const merged = { ...(existing ?? DEFAULT_PREFS), ...args, orgId, userId, updatedAt: Date.now() };

    if (existing) {
      await ctx.db.patch(existing._id, merged);
      return { id: existing._id };
    }

    const id = await ctx.db.insert("notificationPreferences", merged);
    return { id };
  },
});

export const reset = mutation({
  args: {},
  handler: async (ctx) => {
    const { userId, orgId } = await requireAuthenticatedOrg(ctx);
    await assertOrgWriteAccess(ctx, orgId, userId);

    const existing = (await ctx.db
      .query("notificationPreferences")
      .withIndex("by_org_user", (q) => q.eq("orgId", orgId).eq("userId", userId))
      .first()) as PrefDoc | null;

    if (!existing) {
      const id = await ctx.db.insert("notificationPreferences", { ...DEFAULT_PREFS, orgId, userId, updatedAt: Date.now() });
      return { id };
    }

    await ctx.db.patch(existing._id, { ...DEFAULT_PREFS, orgId, userId, updatedAt: Date.now() });
    return { id: existing._id };
  },
});