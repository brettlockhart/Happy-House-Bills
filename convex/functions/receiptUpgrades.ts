import { internalMutation, internalQuery, query, mutation } from "../_generated/server";
import { v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { requireAuthenticatedOrg } from "../auth";

const OCR_DAILY_LIMIT = 50;

/** Active admin/member required for uploads, OCR, and other paid/write operations. */
export async function assertReceiptWriteAccess(
  ctx: QueryCtx | MutationCtx,
  orgId: string,
  userId: string,
): Promise<void> {
  // requireAuthenticatedOrg already constrains AUTH_BYPASS to a local backend.
  if (process.env.AUTH_BYPASS === "1") return;
  const membership = await ctx.db
    .query("memberships")
    .withIndex("by_org_user", (q) => q.eq("orgId", orgId).eq("userId", userId))
    .first();
  if (!membership || membership.deletedAt || membership.status !== "active" || membership.role === "viewer") {
    throw new Error("You do not have permission to upload or process receipts in this organisation");
  }
}

export const assertReceiptWrite = internalQuery({
  args: { orgId: v.string(), userId: v.string() },
  handler: async (ctx, args) => {
    await assertReceiptWriteAccess(ctx, args.orgId, args.userId);
    return true;
  },
});

/** Throws unless every storage object has a recorded upload owned by this org. */
export async function assertReceiptUploadsOwned(
  ctx: QueryCtx | MutationCtx,
  storageIds: Array<Id<"_storage">>,
  orgId: string,
): Promise<void> {
  for (const storageId of new Set(storageIds)) {
    const upload = await ctx.db
      .query("receiptUploads")
      .withIndex("by_storageId", (q) => q.eq("storageId", storageId))
      .first();
    if (!upload || upload.orgId !== orgId || upload.deletingAt !== undefined) {
      throw new Error("Receipt upload not found or not authorised");
    }
  }
}

/**
 * Claims uploads for an expense in the same mutation that inserts the expense.
 * Replaying a claim for the same expense is safe; sharing uploads is not.
 */
export async function claimReceiptUploads(
  ctx: MutationCtx,
  storageIds: Array<Id<"_storage">>,
  orgId: string,
  expenseId: Id<"expenses">,
): Promise<void> {
  for (const storageId of new Set(storageIds)) {
    const upload = await ctx.db
      .query("receiptUploads")
      .withIndex("by_storageId", (q) => q.eq("storageId", storageId))
      .first();
    if (!upload || upload.orgId !== orgId || upload.deletingAt !== undefined) {
      throw new Error("Receipt upload not found or not authorised");
    }
    if (upload.expenseId !== undefined && upload.expenseId !== expenseId) {
      throw new Error("Receipt upload is already attached to another expense");
    }
    if (upload.expenseId === undefined) {
      await ctx.db.patch(upload._id, { expenseId });
    }
  }
}

export const assertReceiptsOwned = internalQuery({
  args: { storageIds: v.array(v.id("_storage")), orgId: v.string() },
  handler: async (ctx, args) => {
    await assertReceiptUploadsOwned(ctx, args.storageIds, args.orgId);
    return true;
  },
});

export const recordReceiptUpload = internalMutation({
  args: { storageId: v.id("_storage"), orgId: v.string(), uploadedBy: v.string() },
  handler: async (ctx, args) => {
    await ctx.db.insert("receiptUploads", { ...args, createdAt: Date.now() });
  },
});

/** Atomic per-user/org/day quota check shared by initial OCR and reprocessing. */
export const consumeOcrQuota = internalMutation({
  args: { orgId: v.string(), userId: v.string() },
  handler: async (ctx, args) => {
    const date = new Date().toISOString().split("T")[0]!;
    const existing = await ctx.db
      .query("emailRateLimits")
      .withIndex("by_org_date_user", (q) =>
        q.eq("orgId", args.orgId).eq("date", date).eq("userId", args.userId),
      )
      .first();
    if (existing && existing.count >= OCR_DAILY_LIMIT) {
      throw new Error(`Daily OCR limit reached (${OCR_DAILY_LIMIT}/day). Try again tomorrow.`);
    }
    if (existing) {
      await ctx.db.patch(existing._id, { count: existing.count + 1, lastSentAt: Date.now() });
    } else {
      await ctx.db.insert("emailRateLimits", {
        orgId: args.orgId,
        userId: args.userId,
        date,
        count: 1,
        lastSentAt: Date.now(),
      });
    }
  },
});

/** Internal read used by the (Node) reprocess action, which has no ctx.db access. */
export const getExpense = internalQuery({
  args: { expenseId: v.id("expenses") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.expenseId);
  },
});

export const needsAiUpgrade = query({
  args: {},
  handler: async (ctx) => {
    const { orgId } = await requireAuthenticatedOrg(ctx);
    const rows = await ctx.db
      .query("expenses")
      .withIndex("by_org_ocrSource", (q) => q.eq("orgId", orgId).eq("ocrSource", "tesseract"))
      .collect();
    return rows
      .filter((e) =>
        e.receiptImageId &&
        !e.deletedAt &&
        e.status === "pending" &&
        e.ocrNeedsReview === true &&
        e.updatedAt === e.createdAt
      )
      .map((e) => ({ _id: e._id, store: e.store, date: e.date, amount: e.amount }));
  },
});

/** Internal mutation: apply an OCR upgrade to an expense (used by reprocessReceipt action). */
export const applyOcrUpgrade = internalMutation({
  args: {
    expenseId: v.id("expenses"),
    store: v.optional(v.string()),
    date: v.optional(v.string()),
    amount: v.optional(v.number()),
    rawText: v.optional(v.string()),
    confidence: v.optional(v.number()),
    expectedUpdatedAt: v.optional(v.number()),
    lineItems: v.optional(v.array(v.object({
      description: v.string(),
      quantity: v.optional(v.number()),
      unitPrice: v.optional(v.number()),
      totalPrice: v.optional(v.number()),
      categoryHint: v.optional(v.string()),
    }))),
  },
  handler: async (ctx, args) => {
    const expense = await ctx.db.get(args.expenseId);
    if (!expense) throw new Error("Expense not found");
    // Stale jobs and reviewed/approved/deleted records must never be overwritten.
    if (
      expense.deletedAt ||
      expense.status !== "pending" ||
      (args.expectedUpdatedAt !== undefined && expense.updatedAt !== args.expectedUpdatedAt)
    ) {
      return { applied: false };
    }

    const hasConflict =
      (args.amount !== undefined && expense.amount > 0 && args.amount !== expense.amount) ||
      (args.date !== undefined && args.date !== expense.date) ||
      (args.store !== undefined && expense.store !== undefined && args.store !== expense.store);

    await ctx.db.patch(args.expenseId, {
      // Only fill missing values; user-entered or user-corrected values win.
      store: expense.store ?? args.store,
      date: expense.date ?? args.date,
      amount: expense.amount > 0 ? expense.amount : args.amount,
      ocrSource: "openrouter",
      ocrConfidence: args.confidence ?? expense.ocrConfidence,
      ocrRawText: args.rawText ?? expense.ocrRawText,
      lineItems: expense.lineItems?.length ? expense.lineItems : args.lineItems,
      ocrNeedsReview: hasConflict || args.confidence === undefined || args.confidence < 75 || !args.amount,
      updatedAt: Date.now(),
    });
    return { applied: true, hasConflict };
  },
});

/** Public mutation: dismiss an expense that has an OCR review pending. */
export const dismissOcrUpgrade = mutation({
  args: { expenseId: v.id("expenses") },
  handler: async (ctx, args) => {
    const { orgId } = await requireAuthenticatedOrg(ctx);
    const expense = await ctx.db.get(args.expenseId);
    if (!expense) throw new Error("Expense not found");
    if (expense.orgId !== orgId) throw new Error("Expense not in this organisation");

    // Prevent stale dismiss; also skip if already reviewed/approved/deleted
    if (
      expense.deletedAt ||
      expense.status !== "pending" ||
      expense.ocrNeedsReview === false
    ) {
      return { dismissed: false };
    }

    await ctx.db.patch(args.expenseId, {
      ocrNeedsReview: false,
      updatedAt: Date.now(),
    });
    return { dismissed: true };
  },
});
