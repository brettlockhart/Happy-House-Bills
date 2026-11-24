import { action, internalMutation, internalQuery, mutation, query } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { v } from "convex/values";
import { requireAuthenticatedUser, requireAuthenticatedOrg } from "../auth";
import { renderInviteEmail } from "./email";
import { clerkRequest, isClerkConfigured } from "./clerk";
import { ROLES, INVITE_TOKEN_TTL_MS, RETENTION_DAYS, checkPermission } from "./shared_constants";
import { internal } from "../_generated/api";
import { seedDefaultCategories } from "../categories";
import { displayNameForUserId } from "./directory";

interface ClerkUser {
  id: string;
  email_addresses: Array<{ email_address: string }>;
}

interface ListMembershipsResponse {
  data: Array<{ id: string; user_id: string }>;
}

interface ClerkMembership {
  id: string;
  user_id: string;
  organization: { id: string };
  status: string;
}

export const insertOrg = internalMutation({
  args: {
    name: v.string(),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const { userId } = args;
    const now = Date.now();
    const orgDocId = await ctx.db.insert("orgs", {
      name: args.name,
      slug: args.userId,
      createdBy: userId,
      emailSettings: {
        expenseNotifications: true,
        settlementNotifications: true,
        weeklySummary: true,
        securityAlerts: true,
      },
      createdAt: now,
      updatedAt: now,
    });
await ctx.db.insert("memberships", {
      orgId: orgDocId as unknown as string,
      userId,
      role: ROLES.ADMIN,
      status: "active",
      subscriptionRole: "admin",
      invitedBy: userId,
      createdAt: now,
      updatedAt: now,
    });

    await seedDefaultCategories(ctx, orgDocId as unknown as string, userId);

    return { orgId: orgDocId as unknown as string };
  },
});

export const create = insertOrg;

export const createOrg = mutation({
  args: { name: v.string() },
  handler: async (ctx, args): Promise<{ orgId: string }> => {
    const { userId } = await requireAuthenticatedUser(ctx);
    if (!args.name || !args.name.trim()) {
      throw new Error("Household name is required");
    }
    const now = Date.now();
    const orgDocId = await ctx.db.insert("orgs", {
      name: args.name.trim(),
      slug: userId,
      createdBy: userId,
      emailSettings: {
        expenseNotifications: true,
        settlementNotifications: true,
        weeklySummary: true,
        securityAlerts: true,
      },
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.insert("memberships", {
      orgId: orgDocId as unknown as string,
      userId,
      role: ROLES.ADMIN,
      status: "active",
      subscriptionRole: "admin",
      invitedBy: userId,
      createdAt: now,
      updatedAt: now,
    });

    await seedDefaultCategories(ctx, orgDocId as unknown as string, userId);

    return { orgId: orgDocId as unknown as string };
  },
});

export const getMembership = internalQuery({
  args: { orgId: v.string(), userId: v.string() },
  handler: async (ctx, args) => {
    return ctx.db
      .query("memberships")
      .withIndex("by_org_user", (q) =>
        q.eq("orgId", args.orgId).eq("userId", args.userId),
      )
      .first();
  },
});

export const insertInvite = internalMutation({
  args: {
    token: v.string(),
    email: v.string(),
    orgId: v.string(),
    orgName: v.string(),
    role: v.union(v.literal("admin"), v.literal("member"), v.literal("viewer")),
    createdBy: v.string(),
    expiresAt: v.number(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    await ctx.db.insert("invites", {
      token: args.token,
      email: args.email,
      orgId: args.orgId,
      orgName: args.orgName,
      role: args.role,
      createdBy: args.createdBy,
      expiresAt: args.expiresAt,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const getInviteByToken = internalQuery({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    return ctx.db
      .query("invites")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first();
  },
});

export const acceptInviteDb = internalMutation({
  args: {
    inviteId: v.id("invites"),
    orgId: v.string(),
    userId: v.string(),
    role: v.union(v.literal("admin"), v.literal("member"), v.literal("viewer")),
    invitedBy: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    await ctx.db.insert("memberships", {
      orgId: args.orgId,
      userId: args.userId,
      role: args.role,
      status: "active",
      subscriptionRole: "free",
      invitedBy: args.invitedBy,
      joinedAt: now,
      createdAt: now,
      updatedAt: now,
    });

    await ctx.db.patch(args.inviteId, {
      inviteeUserId: args.userId,
      acceptedAt: now,
      updatedAt: now,
    });
  },
});

export const invite = action({
  args: {
    email: v.string(),
    orgId: v.string(),
    orgName: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{ token: string }> => {
    const { userId, orgId: callerOrgId } = await requireAuthenticatedOrg(ctx);

    if (args.orgId !== callerOrgId) {
      throw new Error("Org ID mismatch");
    }

    if (!args.email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(args.email)) {
      throw new Error("Invalid email address");
    }

    const callerMembership = (await ctx.runQuery(
      internal.functions.orgs.getMembership,
      { orgId: callerOrgId, userId },
    )) as { role: string } | null;

    if (!callerMembership) {
      throw new Error("You are not a member of this organization");
    }

    if (!checkPermission(callerMembership.role, "invite:create")) {
      throw new Error("Insufficient permissions to invite users");
    }

    if (isClerkConfigured()) {
      const userLookup = await clerkRequest(
        `/users?email_address=${encodeURIComponent(args.email)}`,
      );
      const userList = (userLookup as { data?: ClerkUser[] }).data || [];

      for (const user of userList) {
        const existingMembership = await clerkRequest(
          `/organizations/${args.orgId}/memberships`,
        );
        const members = (existingMembership as ListMembershipsResponse).data || [];
        if (members.some((m: { user_id: string }) => m.user_id === user.id)) {
          throw new Error("This email is already associated with this household");
        }
      }
    }

    const token = crypto.randomUUID();
    const now = Date.now();
    const orgName = args.orgName ?? args.email.split("@")[0] ?? args.email;

    await ctx.runMutation(internal.functions.orgs.insertInvite, {
      token,
      email: args.email,
      orgId: args.orgId,
      orgName,
      role: "member",
      createdBy: userId,
      expiresAt: now + INVITE_TOKEN_TTL_MS,
    });

    const inviterName = displayNameForUserId(userId);

    const html = renderInviteEmail(args.email, inviterName, orgName, token);
    await ctx.runAction(internal.functions.email.send, {
      to: [args.email],
      subject: "You're invited to join Happy House Bills",
      html,
      orgId: args.orgId,
    });

    await ctx.runMutation(internal.functions.notifications.createInternal, {
      orgId: args.orgId,
      userId,
      type: "invite_sent",
      title: "Invitation sent",
      body: "You sent an invitation to join your household",
      data: { inviteToken: token },
    });

    return { token };
  },
});

export const acceptInvite = action({
  args: {
    token: v.string(),
  },
  handler: async (ctx, args): Promise<{ orgId: string; orgName: string; role: string; membershipId: string }> => {
    const { userId } = await requireAuthenticatedUser(ctx);

    const invite = (await ctx.runQuery(
      internal.functions.orgs.getInviteByToken,
      { token: args.token },
    )) as { _id: Id<"invites">; orgId: string; orgName: string; role: string; createdBy: string; expiresAt: number; inviteeUserId?: string | null } | null;

    if (!invite) {
      throw new Error("Invalid invite token");
    }

    if (invite.expiresAt < Date.now()) {
      throw new Error("Invite has expired");
    }

    if (invite.inviteeUserId) {
      throw new Error("Invite already consumed");
    }

    const membership = (await clerkRequest(
      `/organizations/${invite.orgId}/memberships`,
      "POST",
      { user_id: userId },
    )) as ClerkMembership;

    if (membership.user_id !== userId) {
      throw new Error("Failed to add user to organization");
    }

    await ctx.runMutation(internal.functions.orgs.acceptInviteDb, {
      inviteId: invite._id,
      orgId: invite.orgId,
      userId,
      role: (invite.role as "admin" | "member" | "viewer") ?? "member",
      invitedBy: invite.createdBy,
    });

    await ctx.runMutation(internal.functions.orgs.setSubscriptionRole, {
      orgId: invite.orgId,
      userId,
      role: "free",
    });

    return {
      orgId: invite.orgId,
      orgName: invite.orgName,
      role: invite.role ?? "member",
      membershipId: membership.id,
    };
  },
});

export const listPendingInvites = query({
  args: {},
  handler: async (ctx) => {
    const { orgId } = await requireAuthenticatedOrg(ctx);
    return ctx.db
      .query("invites")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .filter((q) =>
        q.and(
          q.eq(q.field("inviteeUserId"), undefined),
          q.gt(q.field("expiresAt"), Date.now()),
        ),
      )
      .order("desc")
      .collect();
  },
});

// D26: Usage limits per org/month (free-member caps)
export const getUsageLimits = internalQuery({
  args: { orgId: v.string() },
  handler: async (ctx, args) => {
    const month = new Date().toISOString().slice(0, 7); // YYYY-MM
    const limits = await ctx.db
      .query("usageLimits")
      .withIndex("by_org_month", (q) => q.eq("orgId", args.orgId).eq("month", month))
      .first();

    if (!limits) {
      return {
        month,
        expenseCount: 0,
        ocrCount: 0,
        expenseCap: Number(process.env.FREE_EXPENSE_LIMIT_MONTHLY) || 20,
        ocrCap: Number(process.env.FREE_OCR_LIMIT_MONTHLY) || 10,
        isExpenseAtLimit: false,
        isOcrAtLimit: false,
        isExpenseAt80Percent: false,
        isOcrAt80Percent: false,
      };
    }

    return {
      month,
      expenseCount: limits.expenseCount,
      ocrCount: limits.ocrCount,
      expenseCap: limits.expenseCap,
      ocrCap: limits.ocrCap,
      isExpenseAtLimit: limits.expenseCount >= limits.expenseCap,
      isOcrAtLimit: limits.ocrCount >= limits.ocrCap,
      isExpenseAt80Percent: limits.expenseCount >= Math.ceil(limits.expenseCap * 0.8),
      isOcrAt80Percent: limits.ocrCount >= Math.ceil(limits.ocrCap * 0.8),
    };
  },
});

export const incrementExpenseCount = internalMutation({
  args: { orgId: v.string() },
  handler: async (ctx, args) => {
    const month = new Date().toISOString().slice(0, 7);
    const now = Date.now();

    const existing = await ctx.db
      .query("usageLimits")
      .withIndex("by_org_month", (q) => q.eq("orgId", args.orgId).eq("month", month))
      .first();

    const cap = Number(process.env.FREE_EXPENSE_LIMIT_MONTHLY) || 20;
    let count: number;
    if (existing) {
      count = (existing.expenseCount ?? 0) + 1;
      await ctx.db.patch(existing._id, { expenseCount: count, updatedAt: now });
    } else {
      count = 1;
      await ctx.db.insert("usageLimits", {
        orgId: args.orgId,
        month,
        expenseCount: 1,
        ocrCount: 0,
        expenseCap: cap,
        ocrCap: Number(process.env.FREE_OCR_LIMIT_MONTHLY) || 10,
        createdAt: now,
        updatedAt: now,
      });
    }

    return { count, isAtLimit: count >= cap, isOverLimit: count > cap };
  },
});

export const incrementOcrCount = internalMutation({
  args: { orgId: v.string() },
  handler: async (ctx, args) => {
    const month = new Date().toISOString().slice(0, 7);
    const now = Date.now();

    const existing = await ctx.db
      .query("usageLimits")
      .withIndex("by_org_month", (q) => q.eq("orgId", args.orgId).eq("month", month))
      .first();

    const cap = Number(process.env.FREE_OCR_LIMIT_MONTHLY) || 10;
    let count: number;
    if (existing) {
      count = (existing.ocrCount ?? 0) + 1;
      await ctx.db.patch(existing._id, { ocrCount: count, updatedAt: now });
    } else {
      count = 1;
      await ctx.db.insert("usageLimits", {
        orgId: args.orgId,
        month,
        expenseCount: 0,
        ocrCount: 1,
        expenseCap: Number(process.env.FREE_EXPENSE_LIMIT_MONTHLY) || 20,
        ocrCap: cap,
        createdAt: now,
        updatedAt: now,
      });
    }

    return { count, isAtLimit: count >= cap, isOverLimit: count > cap };
  },
});

// D26: Reset limits at month boundary handled by caller/checker; public wrapper
export const resetUsageLimits = internalMutation({
  args: { orgId: v.string(), month: v.string() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("usageLimits")
      .withIndex("by_org_month", (q) => q.eq("orgId", args.orgId).eq("month", args.month))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, { expenseCount: 0, ocrCount: 0, updatedAt: Date.now() });
    }
    return { success: true };
  },
});

export const setSubscriptionRole = internalMutation({
  args: { orgId: v.string(), userId: v.string(), role: v.union(v.literal("free"), v.literal("paying"), v.literal("admin")) },
  handler: async (ctx, args) => {
    const membership = await ctx.db
      .query("memberships")
      .withIndex("by_org_user", (q) => q.eq("orgId", args.orgId).eq("userId", args.userId))
      .first();

    if (!membership) throw new Error("Membership not found");

    await ctx.db.patch(membership._id, { subscriptionRole: args.role, updatedAt: Date.now() });
    return { success: true };
  },
});

export const getSubscriptionRole = internalQuery({
  args: { orgId: v.string(), userId: v.string() },
  handler: async (ctx, args) => {
    const membership = await ctx.db
      .query("memberships")
      .withIndex("by_org_user", (q) => q.eq("orgId", args.orgId).eq("userId", args.userId))
      .first();

    return { subscriptionRole: membership?.subscriptionRole ?? "free" };
  },
});

// D26: Role gate for Convex functions - check caller's subscription role
export const assertFeatureGate = internalQuery({
  args: { orgId: v.string(), userId: v.string(), requiredRole: v.union(v.literal("free"), v.literal("paying"), v.literal("admin")) },
  handler: async (ctx, args) => {
    const membership = await ctx.db
      .query("memberships")
      .withIndex("by_org_user", (q) => q.eq("orgId", args.orgId).eq("userId", args.userId))
      .first();

    const role = membership?.subscriptionRole ?? "free";
    const rank = { free: 0, paying: 1, admin: 2 }[args.requiredRole];
    const callerRank = { free: 0, paying: 1, admin: 2 }[role];

    if (callerRank < rank) {
      throw new Error(`Feature requires '${args.requiredRole}' role; current role: '${role}'`);
    }

    return { allowed: true, callerRole: role };
  },
});

// D26: Public wrappers for the client-side feature-gate composable (auth-scoped, org-resolved from caller).
export const getMySubscriptionRole = query({
  args: {},
  handler: async (ctx): Promise<{ subscriptionRole: string }> => {
    const { userId, orgId } = await requireAuthenticatedOrg(ctx);
    return ctx.runQuery(internal.functions.orgs.getSubscriptionRole, { orgId, userId });
  },
});

export const getMyUsageLimits = query({
  args: {},
  handler: async (ctx): Promise<{
    month: string;
    expenseCount: number;
    ocrCount: number;
    expenseCap: number;
    ocrCap: number;
    isExpenseAtLimit: boolean;
    isOcrAtLimit: boolean;
    isExpenseAt80Percent?: boolean;
    isOcrAt80Percent?: boolean;
  }> => {
    const { orgId } = await requireAuthenticatedOrg(ctx);
    return ctx.runQuery(internal.functions.orgs.getUsageLimits, { orgId });
  },
});

export const incrementMyExpenseCount = mutation({
  args: {},
  handler: async (ctx): Promise<{ count: number; isAtLimit: boolean; isOverLimit: boolean }> => {
    const { orgId } = await requireAuthenticatedOrg(ctx);
    return ctx.runMutation(internal.functions.orgs.incrementExpenseCount, { orgId });
  },
});

export const incrementMyOcrCount = mutation({
  args: {},
  handler: async (ctx): Promise<{ count: number; isAtLimit: boolean; isOverLimit: boolean }> => {
    const { orgId } = await requireAuthenticatedOrg(ctx);
    return ctx.runMutation(internal.functions.orgs.incrementOcrCount, { orgId });
  },
});

// D28: Transfer group ownership to another user (paid subscriber driven)
export const transferOwnership = mutation({
  args: {
    orgId: v.string(),
    targetUserId: v.string(),
    transferType: v.union(v.literal("full"), v.literal("member-only")),
  },
  handler: async (ctx, args): Promise<{ success: boolean; transferType: string; targetUserId: string }> => {
    const { userId, orgId: callerOrgId } = await requireAuthenticatedOrg(ctx);
    if (args.orgId !== callerOrgId) {
      throw new Error("Org ID mismatch");
    }
    const targetUserId = args.targetUserId.trim();
    if (!targetUserId) {
      throw new Error("Target user is required");
    }
    if (targetUserId === userId) {
      throw new Error("Cannot transfer ownership to yourself");
    }

    const callerMembership = await ctx.db
      .query("memberships")
      .withIndex("by_org_user", (q) => q.eq("orgId", args.orgId).eq("userId", userId))
      .first();

    if (!callerMembership || callerMembership.status !== "active" || callerMembership.deletedAt !== undefined) {
      throw new Error("Your membership is not active");
    }

    if (callerMembership.role !== ROLES.ADMIN) {
      throw new Error("Only admins can transfer ownership");
    }

    const ranks: Record<string, number> = { free: 0, paying: 1, admin: 2 };
    const callerRank = ranks[callerMembership.subscriptionRole ?? "free"] ?? 0;
    if (callerRank < (ranks.paying ?? 1)) {
      throw new Error("Only paying subscribers can transfer ownership");
    }

    const targetMembership = await ctx.db
      .query("memberships")
      .withIndex("by_org_user", (q) => q.eq("orgId", args.orgId).eq("userId", targetUserId))
      .first();

    const now = Date.now();
    if (args.transferType === "full") {
      if (targetMembership) {
        await ctx.db.patch(targetMembership._id, {
          role: ROLES.ADMIN,
          status: "active",
          subscriptionRole: "paying",
          updatedAt: now,
        });
      } else {
        await ctx.db.insert("memberships", {
          orgId: args.orgId,
          userId: targetUserId,
          role: ROLES.ADMIN,
          status: "active",
          subscriptionRole: "paying",
          invitedBy: userId,
          createdAt: now,
          updatedAt: now,
        });
      }
      await ctx.db.patch(callerMembership._id, {
        role: ROLES.MEMBER,
        subscriptionRole: "free",
        updatedAt: now,
      });
    } else {
      // For member-only transfer, downgrade caller from paying → free to avoid entitlement inflation
      await ctx.db.patch(callerMembership._id, {
        subscriptionRole: "free",
        updatedAt: now,
      });

      if (targetMembership) {
        await ctx.db.patch(targetMembership._id, {
          subscriptionRole: "paying",
          updatedAt: now,
        });
      } else {
        await ctx.db.insert("memberships", {
          orgId: args.orgId,
          userId: targetUserId,
          role: ROLES.MEMBER,
          status: "active",
          subscriptionRole: "paying",
          invitedBy: userId,
          createdAt: now,
          updatedAt: now,
        });
      }
    }

    await ctx.db.insert("auditLogs", {
      orgId: args.orgId,
      userId,
      action: "transferOwnership",
      resource: "membership",
      resourceId: targetMembership?._id ?? targetUserId,
      metadata: { transferType: args.transferType, targetUserId, previousCallerRole: callerMembership.role },
      createdAt: now,
    });

    return { success: true, transferType: args.transferType, targetUserId };
  },
});

// D28: Account deletion with GDPR export-before-purge (soft delete via deletedAt, 90-day retention)
export const deleteAccount = mutation({
  args: {
    orgId: v.string(),
  },
  handler: async (ctx, args): Promise<{ success: boolean; export: Record<string, unknown> }> => {
    const { userId, orgId: callerOrgId } = await requireAuthenticatedOrg(ctx);
    if (args.orgId !== callerOrgId) {
      throw new Error("Org ID mismatch");
    }

    const membership = await ctx.db
      .query("memberships")
      .withIndex("by_org_user", (q) => q.eq("orgId", args.orgId).eq("userId", userId))
      .first();

    if (!membership || membership.status !== "active" || membership.deletedAt !== undefined) {
      throw new Error("Your membership is not active");
    }

    const now = Date.now();

    const ownedExpenses = await ctx.db
      .query("expenses")
      .withIndex("by_org_enteredBy", (q) => q.eq("orgId", args.orgId).eq("enteredBy", userId))
      .filter((q) => q.eq(q.field("deletedAt"), undefined))
      .collect();

    const ownedSettlementsFrom = await ctx.db
      .query("settlements")
      .withIndex("by_org_fromUser", (q) => q.eq("orgId", args.orgId).eq("fromUser", userId))
      .filter((q) => q.eq(q.field("deletedAt"), undefined))
      .collect();
    const ownedSettlementsTo = await ctx.db
      .query("settlements")
      .withIndex("by_org_toUser", (q) => q.eq("orgId", args.orgId).eq("toUser", userId))
      .filter((q) => q.eq(q.field("deletedAt"), undefined))
      .collect();
    const ownedSettlements = [...ownedSettlementsFrom, ...ownedSettlementsTo];

    const exportPayload = {
      orgId: args.orgId,
      userId,
      generatedAt: now,
      retentionDays: RETENTION_DAYS,
      expenses: ownedExpenses.map((e) => ({
        id: e._id,
        amount: e.amount,
        date: e.date,
        category: e.category,
        paidBy: e.paidBy,
        share: e.share ?? null,
        status: e.status,
        notes: e.notes ?? null,
      })),
      settlements: ownedSettlements.map((s) => ({
        id: s._id,
        amount: s.amount,
        date: s.date,
        fromUser: s.fromUser,
        toUser: s.toUser,
      })),
    };

    for (const e of ownedExpenses) {
      await ctx.db.patch(e._id, { deletedAt: now });
    }
    for (const s of ownedSettlements) {
      await ctx.db.patch(s._id, { deletedAt: now });
    }
    await ctx.db.patch(membership._id, { deletedAt: now, status: "suspended", updatedAt: now });

    await ctx.db.insert("auditLogs", {
      orgId: args.orgId,
      userId,
      action: "deleteAccount",
      resource: "membership",
      resourceId: membership._id,
      metadata: { exportedExpenseCount: ownedExpenses.length, exportedSettlementCount: ownedSettlements.length },
      createdAt: now,
    });

    return { success: true, export: exportPayload };
  },
});
