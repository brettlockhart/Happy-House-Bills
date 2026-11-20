import { mutation, query, internalMutation, internalAction, internalQuery } from "../_generated/server";
import { v } from "convex/values";
import { requireAuthenticatedOrg } from "../auth";
import { assertOrgWriteAccess } from "./permissions";
import { internal } from "../_generated/api";

const MAX_LIMIT = 100;
const MAX_UNREAD_COUNT = 10000;

export const createInternal = internalMutation({
  args: {
    orgId: v.string(),
    userId: v.string(),
    type: v.union(
      v.literal("expense_pending"),
      v.literal("expense_approved"),
      v.literal("expense_rejected"),
      v.literal("settlement_created"),
      v.literal("invite_sent"),
      v.literal("goal_alert"),
    ),
    title: v.string(),
    body: v.string(),
    data: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const { orgId, userId: _userId } = await requireAuthenticatedOrg(ctx);

    if (args.orgId !== orgId) {
      throw new Error("Cannot create notification for different organization");
    }

    const _rateLimitKey = `notif:${args.orgId}:${args.userId}:${new Date().toISOString().split("T")[0]}`;
    const today = new Date().toISOString().split("T")[0] as string;
    const limitRecord = await ctx.db
      .query("emailRateLimits")
      .withIndex("by_org_date_user", (q) => q.eq("orgId", args.orgId).eq("date", today).eq("userId", args.userId))
      .first();

    if (limitRecord && limitRecord.count >= 200) {
      throw new Error("Notification rate limit exceeded");
    }

    if (limitRecord) {
      await ctx.db.patch(limitRecord._id, { count: limitRecord.count + 1 });
    } else {
      await ctx.db.insert("emailRateLimits", {
        orgId: args.orgId,
        userId: args.userId,
        date: today,
        count: 1,
      });
    }

    const id = await ctx.db.insert("notifications", {
      orgId: args.orgId,
      userId: args.userId,
      type: args.type,
      title: args.title,
      body: args.body,
      data: args.data,
      read: false,
      createdAt: Date.now(),
    });

    return id;
  },
});

export const markRead = mutation({
  args: {
    notificationId: v.id("notifications"),
  },
  handler: async (ctx, args) => {
    const { orgId, userId } = await requireAuthenticatedOrg(ctx);
    await assertOrgWriteAccess(ctx, orgId, userId);

    const notification = await ctx.db.get(args.notificationId);
    if (!notification) {
      throw new Error("Notification not found");
    }
    if (notification.orgId !== orgId || notification.userId !== userId) {
      throw new Error("Not authorized to mark this notification");
    }

    await ctx.db.patch(args.notificationId, { read: true });
  },
});

export const markAllRead = mutation({
  handler: async (ctx) => {
    const { orgId, userId } = await requireAuthenticatedOrg(ctx);
    await assertOrgWriteAccess(ctx, orgId, userId);

    let processed = 0;
    const batchSize = 500;

    while (true) {
      const notifications = await ctx.db
        .query("notifications")
        .withIndex("by_org_user_read", (q) => q.eq("orgId", orgId).eq("userId", userId).eq("read", false))
        .take(batchSize);

      if (notifications.length === 0) break;

      await Promise.all(
        notifications.map((n) => ctx.db.patch(n._id, { read: true })),
      );

      processed += notifications.length;
      if (notifications.length < batchSize) break;
    }

    return { processed };
  },
});

export const list = query({
  args: {
    limit: v.optional(v.number()),
    read: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { orgId, userId } = await requireAuthenticatedOrg(ctx);

    const limit = Math.min(args.limit ?? 50, MAX_LIMIT);

    let queryBuilder = ctx.db
      .query("notifications")
      .withIndex("by_org_user_created", (q) => q.eq("orgId", orgId).eq("userId", userId))
      .order("desc");

    if (args.read !== undefined) {
      const readValue: boolean = args.read;
      queryBuilder = ctx.db
        .query("notifications")
        .withIndex("by_org_user_read", (q) => q.eq("orgId", orgId).eq("userId", userId).eq("read", readValue))
        .order("desc");
    }

    const notifications = await queryBuilder.take(limit);

    return notifications;
  },
});

export const unreadCount = query({
  handler: async (ctx) => {
    const { orgId, userId } = await requireAuthenticatedOrg(ctx);

    const count = await ctx.db
      .query("notifications")
      .withIndex("by_org_user_read", (q) => q.eq("orgId", orgId).eq("userId", userId).eq("read", false))
      .take(MAX_UNREAD_COUNT)
      .then((n) => n.length);

    return count;
  },
});

export const cleanup = internalAction({
  handler: async (ctx): Promise<{ deleted: number }> => {
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;

    let totalDeleted = 0;
    const batchSize = 500;

    while (true) {
      const oldNotifications = await ctx.runQuery(internal.functions.notifications.listForCleanup, {
        before: thirtyDaysAgo,
        limit: batchSize,
      });

      if (oldNotifications.length === 0) break;

      await Promise.all(
        oldNotifications.map((n: { _id: import("../_generated/dataModel").Id<"notifications"> }) => ctx.runMutation(internal.functions.notifications.deleteById, { id: n._id })),
      );

      totalDeleted += oldNotifications.length;
      if (oldNotifications.length < batchSize) break;
    }

    return { deleted: totalDeleted };
  },
});

export const listForCleanup = internalQuery({
  args: {
    before: v.number(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("notifications")
      .withIndex("by_createdAt", (q) => q.lt("createdAt", args.before))
      .order("asc")
      .take(args.limit ?? 1000);
  },
});

export const deleteById = internalMutation({
  args: {
    id: v.id("notifications"),
  },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});

export const scheduleCleanup = internalAction({
  handler: async (ctx): Promise<{ deleted: number }> => {
    await ctx.scheduler.runAfter(24 * 60 * 60 * 1000, internal.functions.notifications.scheduleCleanup);
    return ctx.runAction(internal.functions.notifications.cleanup);
  },
});