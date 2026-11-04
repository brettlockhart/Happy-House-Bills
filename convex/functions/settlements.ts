import { internal as defineInternal, mutation, query } from "../_generated/server";
import { v } from "convex/values";
import { requireAuthenticatedOrg } from "../auth";
import { sendEmail, renderSettlementNotificationEmail } from "./email";
import { internal as apiInternal } from "../_generated/api";
import { clerkRequest } from "./clerk";

interface ClerkUser {
  id: string;
  first_name: string;
  last_name: string;
  email_addresses: Array<{ email_address: string }>;
}

interface ClerkOrgMembership {
  user: ClerkUser;
}

export const create = mutation({
  args: {
    amount: v.number(),
    fromUser: v.string(),
    toUser: v.string(),
    date: v.string(),
  },
  handler: async (ctx, args) => {
    const { userId, orgId } = await requireAuthenticatedOrg(ctx);
    const now = Date.now();

    if (args.fromUser !== userId) {
      throw new Error("Can only record settlement from yourself");
    }

    if (args.amount <= 0) {
      throw new Error("Settlement amount must be positive");
    }

    if (args.fromUser === args.toUser) {
      throw new Error("Cannot record settlement to yourself");
    }

    const id = await ctx.db.insert("settlements", {
      orgId,
      amount: args.amount,
      fromUser: args.fromUser,
      toUser: args.toUser,
      date: args.date,
      createdAt: now,
      updatedAt: now,
    });

    ctx.scheduler.runAfter(0, apiInternal.settlements.notifySettlementCreated, {
      settlementId: id,
    });

    return { id };
  },
});

export const notifySettlementCreated = defineInternal({
  args: { settlementId: v.id("settlements") },
  handler: async (ctx, args) => {
    const settlement = await ctx.db.get(args.settlementId);
    if (!settlement || !settlement.orgId) {
      throw new Error("Settlement not found");
    }

    const org = await ctx.db
      .query("orgs")
      .withIndex("by_slug", (q) => q.eq("slug", settlement.orgId))
      .first();

    if (org && org.emailSettings && org.emailSettings.settlementNotifications === false) {
      return { sent: false, reason: "User has opted out of settlement notifications" };
    }

    const membershipsRes = (await clerkRequest(
      `/organizations/${settlement.orgId}/memberships`,
    )) as { data: ClerkOrgMembership[] };

    const members = membershipsRes.data || [];

    const fromMember = members.find((m) => m.user.id === settlement.fromUser);
    const toMember = members.find((m) => m.user.id === settlement.toUser);

    if (!fromMember || !toMember) {
      return { sent: false, reason: "Member not found" };
    }

    const fromEmail = fromMember.user.email_addresses[0]?.email_address;
    const toEmail = toMember.user.email_addresses[0]?.email_address;

    if (!fromEmail || !toEmail) {
      return { sent: false, reason: "Missing email address" };
    }

    function getUserName(user: ClerkUser): string {
  const fullName = `${user.first_name || ""} ${user.last_name || ""}`.trim();
  if (fullName) {
    return fullName;
  }
  return (
    user.email_addresses[0]?.email_address?.split("@")[0]?.replace("user_", "") ?? "Partner"
  );
}

    const fromName = getUserName(fromMember.user);
    const toName = getUserName(toMember.user);

    const html = renderSettlementNotificationEmail(fromName, toName, settlement.amount);

    await sendEmail(
      {
        to: [toEmail],
        subject: `Settlement recorded: ${fromName} paid you`,
        html,
        orgId: settlement.orgId,
        userId: settlement.toUser,
      },
      ctx,
    );

    return { sent: true };
  },
});

export const list = query({
  args: {},
  handler: async (ctx) => {
    const { orgId } = await requireAuthenticatedOrg(ctx);
    return ctx.db
      .query("settlements")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .filter((q) => q.eq(q.field("deletedAt"), undefined))
      .order("desc")
      .collect();
  },
});
