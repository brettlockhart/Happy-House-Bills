import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  expenses: defineTable({
    orgId: v.string(),
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
    status: v.union(
      v.literal("pending"),
      v.literal("approved"),
      v.literal("rejected")
    ),
    enteredBy: v.string(),
    approvedBy: v.optional(v.string()),
    rejectReason: v.optional(v.string()),
    createdAt: v.string(),
  })
  .index("by_org", ["orgId"])
  .index("by_org_date", ["orgId", "date"]),

  settlements: defineTable({
    orgId: v.string(),
    amount: v.number(),
    fromUser: v.string(),
    toUser: v.string(),
    date: v.string(),
    createdAt: v.string(),
  })
  .index("by_org", ["orgId"]),
});
