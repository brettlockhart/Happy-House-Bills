import { defineInternal, mutation, query } from "../_generated/server";
import { v } from "convex/values";
import { requireAuthenticatedOrg } from "../auth";
import { runDuplicateCheck } from "./duplicateDetection";
import { sendEmail, renderExpenseNotificationEmail } from "./email";
import { clerkRequest } from "./clerk";
import type { Doc, Id } from "../_generated/dataModel";
import { internal as apiInternal } from "../_generated/api";

type ExpenseDoc = Doc<"expenses"> & { _id: Id<"expenses"> };

export const create = mutation({
  args: {
    amount: v.number(),
    date: v.string(),
    category: v.union(
      v.literal("groceries"),
      v.literal("utilities"),
      v.literal("other")
    ),
    paidBy: v.string(),
    notes: v.optional(v.string()),
    receiptImageId: v.optional(v.id("_storage")),
    receiptPHash: v.optional(v.string()),
    receiptFingerprint: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId, orgId } = await requireAuthenticatedOrg(ctx);
    const now = Date.now();

    if (userId !== args.paidBy) {
      throw new Error("Expense paidBy must match authenticated user");
    }

    const duplicateResult = await runDuplicateCheck(ctx, {
      orgId,
      receiptPHash: args.receiptPHash,
      receiptFingerprint: args.receiptFingerprint,
      amount: args.amount,
      date: args.date,
    });

    const id = await ctx.db.insert("expenses", {
      orgId,
      amount: args.amount,
      date: args.date,
      category: args.category,
      paidBy: args.paidBy,
      notes: args.notes,
      status: "pending" as const,
      enteredBy: userId,
      approvedBy: undefined,
      rejectReason: undefined,
      receiptImageId: args.receiptImageId,
      receiptPHash: args.receiptPHash,
      receiptFingerprint: args.receiptFingerprint,
      createdAt: now,
      updatedAt: now,
      deletedAt: undefined,
    });

    ctx.scheduler.runAfter(0, apiInternal.expenses.notifyExpensePending, {
      expenseId: id,
    });

    return {
      id,
      isDuplicate: duplicateResult.isDuplicate,
      duplicateMatches: duplicateResult.matches,
    };
  },
});

export const approve = mutation({
  args: { expenseId: v.id("expenses") },
  handler: async (ctx, args) => {
    const { userId, orgId } = await requireAuthenticatedOrg(ctx);

    const expense = (await ctx.db.get(args.expenseId)) as ExpenseDoc | null;
    if (!expense) throw new Error("Expense not found");
    if (expense.orgId !== orgId) throw new Error("Access denied");
    if (expense.status !== "pending") throw new Error("Expense is not pending");
    if (expense.enteredBy === userId) {
      throw new Error("Expense creator cannot approve their own expense");
    }

    await ctx.db.patch(args.expenseId, {
      status: "approved",
      approvedBy: userId,
      updatedAt: Date.now(),
    });

    return { id: args.expenseId };
  },
});

export const reject = mutation({
  args: {
    expenseId: v.id("expenses"),
    rejectReason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId, orgId } = await requireAuthenticatedOrg(ctx);

    const expense = (await ctx.db.get(args.expenseId)) as ExpenseDoc | null;
    if (!expense) throw new Error("Expense not found");
    if (expense.orgId !== orgId) throw new Error("Access denied");
    if (expense.status !== "pending") throw new Error("Expense is not pending");
    if (expense.enteredBy === userId) {
      throw new Error("Expense creator cannot reject their own expense");
    }

    await ctx.db.patch(args.expenseId, {
      status: "rejected",
      approvedBy: userId,
      rejectReason: args.rejectReason,
      updatedAt: Date.now(),
    });

    return { id: args.expenseId };
  },
});

export const list = query({
  args: {},
  handler: async (ctx) => {
    const { orgId } = await requireAuthenticatedOrg(ctx);
    return ctx.db
      .query("expenses")
      .withIndex("by_org_date", (q) => q.eq("orgId", orgId))
      .filter((q) => q.eq(q.field("deletedAt"), undefined))
      .order("desc")
      .collect();
  },
});

export const pending = query({
  args: {},
  handler: async (ctx) => {
    const { userId, orgId } = await requireAuthenticatedOrg(ctx);
    return ctx.db
      .query("expenses")
      .withIndex("by_org_date", (q) => q.eq("orgId", orgId))
      .filter((q) => q.eq(q.field("status"), "pending"))
      .filter((q) => q.neq(q.field("enteredBy"), userId))
      .filter((q) => q.eq(q.field("deletedAt"), undefined))
      .order("desc")
      .collect();
  },
});

export const balance = query({
  args: {},
  handler: async (ctx) => {
    const { userId, orgId } = await requireAuthenticatedOrg(ctx);

    const expenses = await ctx.db
      .query("expenses")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .filter((q) => q.eq(q.field("status"), "approved"))
      .filter((q) => q.eq(q.field("deletedAt"), undefined))
      .collect();

    const balance = expenses.reduce((acc, exp: ExpenseDoc) => {
      if (exp.paidBy === userId) return acc - exp.amount;
      return acc + exp.amount;
    }, 0);

    const otherUserExpense = expenses.find(
      (e: ExpenseDoc) => e.paidBy !== userId
    );

    return {
      balance: Math.round(balance * 100) / 100,
      owesWhom:
        balance > 0
          ? otherUserExpense?.paidBy || "partner"
          : balance < 0
          ? otherUserExpense?.paidBy || "partner"
          : "",
    };
  },
});

interface ClerkOrgMembership {
  user: {
    id: string;
    first_name: string;
    last_name: string;
    email_addresses: Array<{ email_address: string }>;
  };
}

export async function getUserDisplayName(userId: string): Promise<string> {
  try {
    const userRes = (await clerkRequest(`/users/${userId}`)) as { data: ClerkUser };
    const user = userRes.data;
    const fullName = `${user.first_name || ""} ${user.last_name || ""}`.trim();
    if (fullName) return fullName;
    return (
      user.email_addresses[0]?.email_address?.split("@")[0]?.replace("user_", "") ??
        "Partner"
    );
  } catch {
    return "Partner";
  }
}

interface ClerkUser {
  id: string;
  first_name: string;
  last_name: string;
  email_addresses: Array<{ email_address: string }>;
}

export const notifyExpensePending = defineInternal({
  args: {
    expenseId: v.id("expenses"),
  },
  handler: async (ctx, args) => {
    const expense = await ctx.db.get(args.expenseId);
    if (!expense || !expense.orgId) {
      throw new Error("Expense not found");
    }

    const org = await ctx.db
      .query("orgs")
      .withIndex("by_slug", (q) => q.eq("slug", expense.orgId))
      .first();

    if (org && org.emailSettings && org.emailSettings.expenseNotifications === false) {
      return { sent: false, reason: "User has opted out of expense notifications" };
    }

    const membershipsRes = (await clerkRequest(
      `/organizations/${expense.orgId}/memberships`,
    )) as { data: ClerkOrgMembership[] };

    const members = membershipsRes.data || [];

    const recipient = members.find((m) => m.user.id !== expense.paidBy);
    if (!recipient) {
      return { sent: false, reason: "No recipient found" };
    }

    const recipientEmail = recipient.user.email_addresses[0]?.email_address;
    if (!recipientEmail) {
      return { sent: false, reason: "No email address for recipient" };
    }

    const html = await renderExpenseNotificationEmail(
      expense._id,
      await getUserDisplayName(expense.paidBy),
      expense.amount,
      expense.category,
      expense.notes,
    );

    await sendEmail(
      {
        to: [recipientEmail],
        subject: "New expense pending your confirmation",
        html,
        orgId: expense.orgId,
        userId: recipient.user.id,
      },
      ctx,
    );

    return { sent: true };
  },
});
