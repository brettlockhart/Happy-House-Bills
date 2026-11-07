import { action, query, internal } from "../_generated/server";
import { v } from "convex/values";
import { requireAuthenticatedUser, requireAuthenticatedOrg } from "../auth";
import { sendEmail, renderInviteEmail } from "./email";
import { clerkRequest } from "./clerk";
import { ROLES, INVITE_TOKEN_TTL_MS, checkPermission } from "./shared-constants";

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

export const insertOrg = internal({
  args: {
    name: v.string(),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const { userId } = args;
    const now = Date.now();
    const { id: orgId } = await ctx.db.insert("orgs", {
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
      orgId: orgId,
      userId,
      role: ROLES.ADMIN,
      status: "active",
      invitedBy: userId,
      createdAt: now,
      updatedAt: now,
    });

    return { orgId };
  },
});

export const create = insertOrg;

export const invite = action({
  args: {
    email: v.string(),
    orgId: v.string(),
    orgName: v.optional(v.string()),
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
      .withIndex("by_org_user", (q) => q.and(
        q.eq("orgId", callerOrgId),
        q.eq("userId", userId),
      ))
      .first();

    if (!callerMembership) {
      throw new Error("You are not a member of this organization");
    }

    if (!checkPermission(callerMembership.role, "invite:create")) {
      throw new Error("Insufficient permissions to invite users");
    }

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

    const token = crypto.randomUUID();
    const now = Date.now();

    await ctx.db.insert("invites", {
      token,
      email: args.email,
      orgId: args.orgId,
      orgName: args.orgName ?? args.email.split("@")[0],
      role: "member",
      createdBy: userId,
      expiresAt: now + INVITE_TOKEN_TTL_MS,
      createdAt: now,
      updatedAt: now,
    });

    const createdBy = (await clerkRequest(`/users/${userId}`)) as ClerkUser;
    const inviterName =
      (createdBy.email_addresses[0]?.email_address &&
        createdBy.email_addresses[0].email_address.split("@")[0]) ||
      "Your partner";

    const html = renderInviteEmail(args.email, inviterName, args.orgName ?? "", token);
    await sendEmail(
      {
        to: [args.email],
        subject: "You're invited to join Happy House Bills",
        html,
        orgId: args.orgId,
      },
      ctx,
    );

    return { token };
  },
});

export const acceptInvite = action({
  args: {
    token: v.string(),
  },
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

    const membershipsRes = await clerkRequest(
      `/organizations/${invite.orgId}/memberships`,
    );
    const members = (membershipsRes as ListMembershipsResponse).data || [];

    if (members.length >= 2) {
      throw new Error("Household is already full (maximum 2 members)");
    }

    const membership = await clerkRequest(
      `/organizations/${invite.orgId}/memberships`,
      "POST",
      {
        user_id: userId,
      },
    ) as ClerkMembership;

    if (membership.user_id !== userId) {
      throw new Error("Failed to add user to organization");
    }

    const now = Date.now();
    await ctx.db.insert("memberships", {
      orgId: invite.orgId,
      userId,
      role: invite.role ?? "member",
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
