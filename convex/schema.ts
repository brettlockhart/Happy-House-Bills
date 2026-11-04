import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  expenses: defineTable({
    orgId: v.string(),
    amount: v.number(),
    date: v.string(),
    category: v.string(),
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
    createdAt: v.number(),
    updatedAt: v.number(),
    deletedAt: v.optional(v.number()),
  })
  .index("by_org", ["orgId"])
  .index("by_org_date", ["orgId", "date"])
  .index("by_receiptImageId", ["receiptImageId"]),

  settlements: defineTable({
    orgId: v.string(),
    amount: v.number(),
    fromUser: v.string(),
    toUser: v.string(),
    date: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
    deletedAt: v.optional(v.number()),
  })
  .index("by_org", ["orgId"]),

  orgs: defineTable({
    name: v.string(),
    slug: v.string(),
    createdBy: v.string(),
    emailSettings: v.optional(
      v.object({
        expenseNotifications: v.boolean(),
        settlementNotifications: v.boolean(),
        weeklySummary: v.boolean(),
        securityAlerts: v.boolean(),
      }),
    ),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
   .index("by_slug", ["slug"]),

  invites: defineTable({
    token: v.string(),
    email: v.string(),
    orgId: v.string(),
    orgName: v.string(),
    inviteeUserId: v.optional(v.string()),
    createdBy: v.string(),
    expiresAt: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_token", ["token"])
    .index("by_email", ["email"])
    .index("by_org", ["orgId"]),

  emailRateLimits: defineTable({
    orgId: v.string(),
    userId: v.optional(v.string()),
    date: v.string(),
    count: v.number(),
    lastSentAt: v.optional(v.number()),
  })
    .index("by_org_date", ["orgId", "date"])
    .index("by_org_date_user", ["orgId", "date", "userId"])
    .index("by_user", ["userId"]),

  categories: defineTable({
    orgId: v.string(),
    name: v.string(),
    color: v.string(),
    createdBy: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
    deletedAt: v.optional(v.number()),
  })
    .index("by_org", ["orgId"]),

  budgets: defineTable({
    orgId: v.string(),
    category: v.string(),
    amount: v.number(),
    period: v.union(v.literal("monthly"), v.literal("quarterly"), v.literal("yearly")),
    alertThreshold: v.number(),
    alertSent: v.boolean(),
    createdBy: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
    deletedAt: v.optional(v.number()),
  })
    .index("by_org", ["orgId"])
    .index("by_org_category", ["orgId", "category"]),
});
