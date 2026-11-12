import { mutation, query } from "../_generated/server";
import { v } from "convex/values";
import { requireAuthenticatedUser, requireAuthenticatedOrg } from "../auth";
import { clerkRequest, isClerkConfigured } from "./clerk";
import { checkAndIncrementRateLimit } from "./email";
import { checkPermission, INVITE_TOKEN_TTL_MS } from "./shared_constants";

export const listMembers = query({
  args: {},
  handler: async (ctx) => {
    const { orgId } = await requireAuthenticatedOrg(ctx);
    return ctx.db
      .query("memberships")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect();
  },
});

export const updateMemberRole = mutation({
  args: {
    userId: v.string(),
    role: v.union(v.literal("admin"), v.literal("member"), v.literal("viewer")),
  },
  handler: async (ctx, args) => {
    const { orgId, userId: callerId } = await requireAuthenticatedOrg(ctx);

    if (callerId === args.userId) {
      throw new Error("Cannot change your own role");
    }

    const callerMembership = await ctx.db
      .query("memberships")
      .withIndex("by_org_user", (q) => q.eq("orgId", orgId).eq("userId", callerId))
      .first();

    if (!callerMembership) {
      throw new Error("You are not a member of this organization");
    }

    if (!checkPermission(callerMembership.role, "team:manage")) {
      throw new Error("Insufficient permissions to manage team");
    }

    const membership = await ctx.db
      .query("memberships")
      .withIndex("by_org_user", (q) => q.eq("orgId", orgId).eq("userId", args.userId))
      .first();

    if (!membership) {
      throw new Error("Member not found");
    }

    await ctx.db.patch(membership._id, {
      role: args.role,
      updatedAt: Date.now(),
    });

    return { userId: args.userId, role: args.role };
  },
});

export const removeMember = mutation({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const { orgId, userId: callerId } = await requireAuthenticatedOrg(ctx);

    if (callerId === args.userId) {
      throw new Error("Cannot remove yourself");
    }

    const callerMembership = await ctx.db
      .query("memberships")
      .withIndex("by_org_user", (q) => q.eq("orgId", orgId).eq("userId", callerId))
      .first();

    if (!callerMembership) {
      throw new Error("You are not a member of this organization");
    }

    if (!checkPermission(callerMembership.role, "team:manage")) {
      throw new Error("Insufficient permissions to manage team");
    }

    const membership = await ctx.db
      .query("memberships")
      .withIndex("by_org_user", (q) => q.eq("orgId", orgId).eq("userId", args.userId))
      .first();

    if (!membership) {
      throw new Error("Member not found");
    }

    await ctx.db.delete(membership._id);

    return { userId: args.userId };
  },
});

export const listAuditLogs = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const { orgId, userId } = await requireAuthenticatedOrg(ctx);

    const callerMembership = await ctx.db
      .query("memberships")
      .withIndex("by_org_user", (q) => q.eq("orgId", orgId).eq("userId", userId))
      .first();

    if (callerMembership && !checkPermission(callerMembership.role, "audit:read")) {
      throw new Error("Insufficient permissions to view audit logs");
    }

    const limit = args.limit ?? 50;

    return ctx.db
      .query("auditLogs")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .order("desc")
      .take(limit);
  },
});

export const createInvite = mutation({
  args: {
    email: v.string(),
    orgId: v.string(),
    orgName: v.optional(v.string()),
    role: v.union(v.literal("admin"), v.literal("member"), v.literal("viewer")),
  },
  handler: async (ctx, args) => {
    const { userId, orgId: callerOrgId } = await requireAuthenticatedOrg(ctx);

    if (args.orgId !== callerOrgId) {
      throw new Error("Org ID mismatch");
    }

    if (!args.email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(args.email)) {
      throw new Error("Invalid email address");
    }

    const callerMembership = await ctx.db
      .query("memberships")
      .withIndex("by_org_user", (q) => q.eq("orgId", callerOrgId).eq("userId", userId))
      .first();

    if (!callerMembership) {
      throw new Error("You are not a member of this organization");
    }

    if (!checkPermission(callerMembership.role, "invite:create")) {
      throw new Error("Insufficient permissions to invite users");
    }

    const now = Date.now();
    const orgName = args.orgName ?? args.email.split("@")[0] ?? args.email;

    await checkAndIncrementRateLimit(ctx, callerOrgId, userId);

    if (isClerkConfigured()) {
      const userLookup = await clerkRequest(
        `/users?email_address=${encodeURIComponent(args.email)}`,
      );
      const userList = (userLookup as { data?: Array<{ id: string; email_addresses: Array<{ email_address: string }> }> }).data || [];

      for (const user of userList) {
        const existingMembership = await clerkRequest(
          `/organizations/${args.orgId}/memberships`,
        );
        const members = (existingMembership as { data?: Array<{ user_id: string }> }).data || [];
        if (members.some((m: { user_id: string }) => m.user_id === user.id)) {
          throw new Error("This email is already associated with this household");
        }

        const userOrgs = await clerkRequest(`/users/${user.id}/organizations`);
        const orgs = (userOrgs as { data?: Array<{ id: string }> }).data || [];
        if (orgs.length > 0) {
          throw new Error(
            "This email is already associated with another household.",
          );
        }
      }
    }

    const token = crypto.randomUUID();

    await ctx.db.insert("invites", {
      token,
      email: args.email,
      orgId: args.orgId,
      orgName,
      role: args.role,
      createdBy: userId,
      expiresAt: now + INVITE_TOKEN_TTL_MS,
      createdAt: now,
      updatedAt: now,
    });

    return { token };
  },
});

export const acceptTeamInvite = mutation({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const { userId } = await requireAuthenticatedUser(ctx);

    const invite = await ctx.db
      .query("invites")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first();

    if (!invite) {
      throw new Error("Invalid invite token");
    }

    if (invite.expiresAt < Date.now()) {
      throw new Error("Invite has expired");
    }

    const alreadyMember = await ctx.db
      .query("memberships")
      .withIndex("by_org_user", (q) => q.eq("orgId", invite.orgId).eq("userId", userId))
      .first();

    if (alreadyMember) {
      throw new Error("You are already a member of this organization");
    }

    const now = Date.now();
    await ctx.db.insert("memberships", {
      orgId: invite.orgId,
      userId,
      role: invite.role,
      status: "active",
      invitedBy: invite.createdBy,
      joinedAt: now,
      createdAt: now,
      updatedAt: now,
    });

    await ctx.db.patch(invite._id, {
      inviteeUserId: userId,
      acceptedAt: now,
      updatedAt: now,
    });

    return {
      orgId: invite.orgId,
      orgName: invite.orgName,
      role: invite.role,
      membershipId: "new_membership",
    };
  },
});