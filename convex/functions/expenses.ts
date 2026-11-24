import { internalMutation, mutation, query } from "../_generated/server";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { v } from "convex/values";
import { requireAuthenticatedOrg } from "../auth";
import { assertOrgWriteAccess } from "./permissions";
import { runDuplicateCheck } from "./duplicateDetection";
import { assertReceiptUploadsOwned } from "./receiptUpgrades";
import { sendEmail, renderExpenseNotificationEmail, renderExpenseApprovedEmail, renderExpenseRejectedEmail } from "./email";
import { clerkRequest } from "./clerk";
import type { Doc, Id } from "../_generated/dataModel";
import { internal } from "../_generated/api";

type ExpenseDoc = Doc<"expenses"> & { _id: Id<"expenses"> };

export async function assertShareMembers(
  ctx: MutationCtx | QueryCtx,
  orgId: string,
  shares: Array<{ userId: string; percent: number }>,
): Promise<void> {
  const seen = new Set<string>();
  for (const entry of shares) {
    if (seen.has(entry.userId)) {
      throw new Error(`Shares must not contain duplicate userIds: ${entry.userId}`);
    }
    seen.add(entry.userId);
    const membership = await ctx.db.query("memberships")
      .withIndex("by_org_user", (q) => q.eq("orgId", orgId).eq("userId", entry.userId))
      .first();
    if (!membership || membership.status !== "active" || membership.deletedAt !== undefined) {
      throw new Error(`Share user '${entry.userId}' is not an active member of organisation '${orgId}'`);
    }
  }
}

export const create = mutation({
  args: {
    amount: v.number(),
    date: v.string(),
    category: v.string(),
    categoryId: v.optional(v.id("categories")),
    paidBy: v.string(),
    notes: v.optional(v.string()),
    share: v.optional(v.number()),
    shares: v.optional(v.array(v.object({
      userId: v.string(),
      percent: v.number(),
    }))),
    receiptImageId: v.optional(v.id("_storage")),
    receiptImageIds: v.optional(v.array(v.id("_storage"))),
    receiptPHash: v.optional(v.string()),
    receiptFingerprint: v.optional(v.string()),
    store: v.optional(v.string()),
    ocrSource: v.optional(v.string()),
    ocrConfidence: v.optional(v.number()),
    ocrRawText: v.optional(v.string()),
    ocrNeedsReview: v.optional(v.boolean()),
    clientRequestId: v.optional(v.string()),
    lineItems: v.optional(v.array(v.object({
      description: v.string(),
      quantity: v.optional(v.number()),
      unitPrice: v.optional(v.number()),
      totalPrice: v.optional(v.number()),
      categoryHint: v.optional(v.string()),
    }))),
  },
  handler: async (ctx, args) => {
    const { userId, orgId } = await requireAuthenticatedOrg(ctx);
    await assertOrgWriteAccess(ctx, orgId, userId);

    const now = Date.now();

    if (userId !== args.paidBy) {
      throw new Error("Expense paidBy must match authenticated user");
    }

    if (!Number.isFinite(args.amount) || args.amount <= 0 || args.amount > 1_000_000) {
      throw new Error("Amount must be a positive number up to 1,000,000");
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(args.date) || Number.isNaN(Date.parse(args.date))) {
      throw new Error("Date must be a valid YYYY-MM-DD value");
    }
    if ((args.notes?.length ?? 0) > 2000 || (args.store?.length ?? 0) > 200) {
      throw new Error("Notes or store name is too long");
    }
    if (args.shares) {
      if (args.shares.length === 0) {
        throw new Error("Shares array must contain at least one entry");
      }
      let sum = 0;
      const seen = new Set<string>();
      for (const entry of args.shares) {
        if (!entry.userId || entry.userId.length === 0 || entry.userId.length > 64) {
          throw new Error("Each share entry must have a non-empty userId");
        }
        if (seen.has(entry.userId)) {
          throw new Error("Shares must not contain duplicate userIds");
        }
        seen.add(entry.userId);
        if (!Number.isFinite(entry.percent) || entry.percent < 0 || entry.percent > 100) {
          throw new Error("Each share percent must be a finite number between 0 and 100");
        }
        sum += entry.percent;
      }
      if (Math.abs(sum - 100) > 0.01) {
        throw new Error("Shares must sum to 100%; current sum: " + Math.round(sum));
      }
      await assertShareMembers(ctx, orgId, args.shares);
    }
    if (args.share !== undefined) {
      if (!Number.isInteger(args.share) || args.share < 0 || args.share > 100) {
        throw new Error("Share must be an integer between 0 and 100");
      }
    }
    if (args.ocrRawText && args.ocrRawText.length > 20000) {
      throw new Error("OCR text exceeds the 20,000 character limit");
    }
    if (args.ocrConfidence !== undefined && (args.ocrConfidence < 0 || args.ocrConfidence > 100)) {
      throw new Error("OCR confidence must be between 0 and 100");
    }
    if (args.ocrSource && !["openrouter", "tesseract", "document-ai", "manual"].includes(args.ocrSource)) {
      throw new Error("Invalid OCR source");
    }
    if (args.lineItems) {
      if (args.lineItems.length > 200) throw new Error("Too many line items (maximum 200)");
      for (const item of args.lineItems) {
        if (!item.description.trim() || item.description.length > 200) {
          throw new Error("Line item descriptions must be 1-200 characters");
        }
        for (const value of [item.quantity, item.unitPrice, item.totalPrice]) {
          if (value !== undefined && (!Number.isFinite(value) || value < 0 || value > 1_000_000)) {
            throw new Error("Line item values must be finite numbers between 0 and 1,000,000");
          }
        }
      }
    }

    if (args.clientRequestId) {
      const existing = await ctx.db
        .query("expenses")
        .withIndex("by_org_clientRequest", (q) =>
          q.eq("orgId", orgId).eq("clientRequestId", args.clientRequestId!),
        )
        .first();
      if (existing) {
        return { id: existing._id, isDuplicate: false, duplicateMatches: [] };
      }
    }

    if (args.categoryId) {
      const cat = await ctx.db.get(args.categoryId);
      if (!cat || cat.orgId !== orgId) {
        throw new Error("Category not found in this organization");
      }
    }

    const storageIds = args.receiptImageIds ?? (args.receiptImageId ? [args.receiptImageId] : []);
    await assertReceiptUploadsOwned(ctx, storageIds, orgId);

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
      categoryId: args.categoryId,
      paidBy: args.paidBy,
      notes: args.notes,
      share: args.share,
      shares: args.shares,
      status: "pending" as const,
      enteredBy: userId,
      approvedBy: undefined,
      rejectReason: undefined,
      receiptImageId: args.receiptImageId ?? args.receiptImageIds?.[0],
      receiptImageIds: args.receiptImageIds ?? (args.receiptImageId ? [args.receiptImageId] : undefined),
      receiptPHash: args.receiptPHash,
      receiptFingerprint: args.receiptFingerprint,
      store: args.store,
      ocrSource: args.ocrSource,
      ocrConfidence: args.ocrConfidence,
      ocrRawText: args.ocrRawText,
      ocrNeedsReview: args.ocrNeedsReview,
      clientRequestId: args.clientRequestId,
      lineItems: args.lineItems,
      createdAt: now,
      updatedAt: now,
      deletedAt: undefined,
    });

    ctx.scheduler.runAfter(0, internal.functions.expenses.notifyExpensePending, {
      expenseId: id,
    });

    return {
      id,
      isDuplicate: duplicateResult.isDuplicate,
      duplicateMatches: duplicateResult.matches,
    };
  },
});

// D29: Update expense shares (paying admin only). Shares must sum to 100%.
export const updateExpenseShare = mutation({
  args: {
    expenseId: v.id("expenses"),
    shares: v.array(v.object({
      userId: v.string(),
      percent: v.number(),
    })),
  },
  handler: async (ctx, args) => {
    const { userId, orgId } = await requireAuthenticatedOrg(ctx);

    // Paying admin required for share editing
    const gate = await ctx.runQuery(internal.functions.orgs.assertFeatureGate, {
      orgId,
      userId,
      requiredRole: "admin",
    });
    if (!gate.allowed) {
      throw new Error("Feature requires 'admin' role; access denied");
    }

    // Validate shares sum to 100%
    if (args.shares.length === 0) {
      throw new Error("Shares array must contain at least one entry");
    }
    let sum = 0;
    const seen = new Set<string>();
    for (const entry of args.shares) {
      if (!entry.userId || entry.userId.length === 0 || entry.userId.length > 64) {
        throw new Error("Each share entry must have a non-empty userId");
      }
      if (seen.has(entry.userId)) {
        throw new Error("Shares must not contain duplicate userIds");
      }
      seen.add(entry.userId);
      if (!Number.isFinite(entry.percent) || entry.percent < 0 || entry.percent > 100) {
        throw new Error("Each share percent must be a finite number between 0 and 100");
      }
      sum += entry.percent;
    }
    if (Math.abs(sum - 100) > 0.01) {
      throw new Error("Shares must sum to 100%; current sum: " + Math.round(sum));
    }
    await assertShareMembers(ctx, orgId, args.shares);

    const expense = (await ctx.db.get(args.expenseId)) as ExpenseDoc | null;
    if (!expense) throw new Error("Expense not found");
    if (expense.orgId !== orgId) throw new Error("Access denied");
    if (expense.deletedAt !== undefined) {
      throw new Error("Expense is deleted");
    }

    await ctx.db.patch(args.expenseId, {
      shares: args.shares,
      updatedAt: Date.now(),
    });

    await ctx.db.insert("auditLogs", {
      orgId,
      userId,
      action: "updateExpenseShare",
      resource: "expense",
      resourceId: args.expenseId,
      metadata: { shares: args.shares },
      createdAt: Date.now(),
    });

    return { id: args.expenseId };
  },
});

export const approve = mutation({
  args: { expenseId: v.id("expenses") },
  handler: async (ctx, args) => {
    const { userId, orgId } = await requireAuthenticatedOrg(ctx);
    await assertOrgWriteAccess(ctx, orgId, userId);

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

    // Schedule email notification to the expense creator
    const creatorEmailRes = (await clerkRequest(`/users/${expense.enteredBy}`)) as { data: { email_addresses: Array<{ email_address: string }> } } | null;
    const creatorEmail = creatorEmailRes?.data?.email_addresses?.[0]?.email_address;
    if (creatorEmail) {
      const approverRes = (await clerkRequest(`/users/${userId}`)) as { data: { first_name: string; last_name: string } } | null;
      const approverName = `${approverRes?.data?.first_name ?? ""} ${approverRes?.data?.last_name ?? ""}`.trim() || "Another member";
      const emailHtml = renderExpenseApprovedEmail(
        approverName,
        args.expenseId,
        expense.amount,
        expense.category ?? "expense",
      );
      await ctx.scheduler.runAfter(0, internal.functions.email.send, {
        to: [creatorEmail],
        subject: "Expense approved",
        html: emailHtml,
        orgId,
      });
    }

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
    await assertOrgWriteAccess(ctx, orgId, userId);

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

    // Schedule email notification to the expense creator
    const creatorEmailRes = (await clerkRequest(`/users/${expense.enteredBy}`)) as { data: { email_addresses: Array<{ email_address: string }> } } | null;
    const creatorEmail = creatorEmailRes?.data?.email_addresses?.[0]?.email_address;
    if (creatorEmail) {
      const rejectorRes = (await clerkRequest(`/users/${userId}`)) as { data: { first_name: string; last_name: string } } | null;
      const rejectorName = `${rejectorRes?.data?.first_name ?? ""} ${rejectorRes?.data?.last_name ?? ""}`.trim() || "Another member";
      const emailHtml = renderExpenseRejectedEmail(
        rejectorName,
        args.expenseId,
        expense.amount,
        expense.category ?? "expense",
        args.rejectReason,
      );
      await ctx.scheduler.runAfter(0, internal.functions.email.send, {
        to: [creatorEmail],
        subject: "Expense rejected",
        html: emailHtml,
        orgId,
      });
    }

    return { id: args.expenseId };
  },
});

export const list = query({
  args: {},
  handler: async (ctx) => {
    const { orgId } = await requireAuthenticatedOrg(ctx);

    const expenses = await ctx.db
      .query("expenses")
      .withIndex("by_org_date", (q) => q.eq("orgId", orgId))
      .filter((q) => q.eq(q.field("deletedAt"), undefined))
      .order("desc")
      .collect();

    const categories = await ctx.db
      .query("categories")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .filter((q) => q.eq(q.field("deletedAt"), undefined))
      .collect();

    const categoryMap = new Map<string, { name: string; color: string; icon?: string }>();
    for (const cat of categories) {
      categoryMap.set(cat._id as unknown as string, {
        name: cat.name,
        color: cat.color,
        icon: cat.icon,
      });
    }

    return expenses.map((exp) => {
      const catInfo = exp.categoryId ? categoryMap.get(exp.categoryId as unknown as string) : undefined;
      return {
        ...exp,
        categoryColor: catInfo?.color,
        categoryIcon: catInfo?.icon,
        category: catInfo?.name ?? exp.category,
      };
    });
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

    let balance = 0;
    for (const exp of expenses) {
      // Determine current user's share percent for this expense
      let ownPercent: number;
      if (exp.shares && exp.shares.length > 0) {
        // N-party: use shares array
        const entry = exp.shares.find((s) => s.userId === userId);
        ownPercent = entry?.percent ?? 0;
      } else if (exp.share !== undefined) {
        // Legacy 2-party: scalar share field represents payer's percentage
        if (exp.paidBy === userId) {
          ownPercent = exp.share;
        } else {
          ownPercent = 100 - exp.share;
        }
      } else {
        // Legacy no-share: default 2-party where non-payer owes 100%
        ownPercent = exp.paidBy === userId ? 0 : 100;
      }

      if (exp.paidBy === userId) {
        // Payer: others owe their share = (100 - ownPercent)%
        balance -= exp.amount * ((100 - ownPercent) / 100);
      } else {
        // Non-payer: owes their own share = ownPercent%
        balance += exp.amount * (ownPercent / 100);
      }
    }

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

export const notifyExpensePending = internalMutation({
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
    void membershipsRes;

    void sendEmail;
    void renderExpenseNotificationEmail;
    void getUserDisplayName;

    return { sent: false, reason: "Notification delivery not wired to Convex action" };
  },
});
