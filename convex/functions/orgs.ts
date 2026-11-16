import { action, internalMutation, internalQuery, mutation, query } from "../_generated/server";
import { v } from "convex/values";
import { requireAuthenticatedUser, requireAuthenticatedOrg } from "../auth";
import { renderInviteEmail } from "./email";
import { clerkRequest, isClerkConfigured } from "./clerk";
import { ROLES, INVITE_TOKEN_TTL_MS, checkPermission } from "./shared_constants";
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

interface ListUserOrgsResponse {
  data: Array<{ id: string }>;
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

        const userOrgs = await clerkRequest(`/users/${user.id}/organizations`);
        const orgs = (userOrgs as ListUserOrgsResponse).data || [];
        if (orgs.length > 0) {
          throw new Error(
            "This email is already associated with another household.",
          );
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
    )) as { _id: Id<"invites">; orgId: string; orgName: string; role: string; createdBy: string; expiresAt: number } | null;

    if (!invite) {
      throw new Error("Invalid invite token");
    }

    if (invite.expiresAt < Date.now()) {
      throw new Error("Invite has expired");
    }

    const membershipsRes = await clerkRequest(
      `/organizations/${invite.orgId}/memberships`,
    );
    const members = (membershipsRes as ListMembershipsResponse).data || [];

    if (members.length >= 2) {
      throw new Error("Household is already full (maximum 2 members)");
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
