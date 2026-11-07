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

  memberships: defineTable({
    orgId: v.string(),
    userId: v.string(),
    role: v.union(v.literal("admin"), v.literal("member"), v.literal("viewer")),
    status: v.union(v.literal("active"), v.literal("pending"), v.literal("suspended")),
    invitedBy: v.optional(v.string()),
    joinedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
    deletedAt: v.optional(v.number()),
  })
    .index("by_org", ["orgId"])
    .index("by_user", ["userId"])
    .index("by_org_user", ["orgId", "userId"])
    .index("by_org_status", ["orgId", "status"]),

  auditLogs: defineTable({
    orgId: v.string(),
    userId: v.string(),
    action: v.string(),
    resource: v.string(),
    resourceId: v.optional(v.string()),
    metadata: v.optional(v.any()),
    ipAddress: v.optional(v.string()),
    userAgent: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_org", ["orgId"])
    .index("by_user", ["userId"])
    .index("by_org_created", ["orgId", "createdAt"])
    .index("by_resource", ["orgId", "resource", "resourceId"]),

  invites: defineTable({
    token: v.string(),
    email: v.string(),
    orgId: v.string(),
    orgName: v.string(),
    role: v.union(v.literal("admin"), v.literal("member"), v.literal("viewer")),
    inviteeUserId: v.optional(v.string()),
    createdBy: v.string(),
    acceptedAt: v.optional(v.number()),
    expiresAt: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_token", ["token"])
    .index("by_email", ["email"])
    .index("by_org", ["orgId"])
    .index("by_org_email", ["orgId", "email"]),

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

  integrations: defineTable({
    orgId: v.string(),
    type: v.union(
      v.literal("bank"),
      v.literal("accounting"),
      v.literal("travel"),
      v.literal("payment"),
      v.literal("ocr"),
      v.literal("storage"),
      v.literal("email"),
      v.literal("analytics"),
    ),
    provider: v.string(),
    name: v.string(),
    config: v.optional(v.any()),
    credentials: v.optional(v.any()),
    status: v.union(
      v.literal("connected"),
      v.literal("disconnected"),
      v.literal("error"),
      v.literal("pending"),
    ),
    lastSyncAt: v.optional(v.number()),
    errorMessage: v.optional(v.string()),
    createdBy: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_org", ["orgId"])
    .index("by_org_type", ["orgId", "type"])
    .index("by_org_provider", ["orgId", "provider"]),

  integrationSyncLogs: defineTable({
    orgId: v.string(),
    integrationId: v.id("integrations"),
    status: v.union(
      v.literal("success"),
      v.literal("failed"),
      v.literal("partial"),
    ),
    recordsProcessed: v.number(),
    recordsCreated: v.number(),
    recordsUpdated: v.number(),
    recordsSkipped: v.number(),
    errorMessage: v.optional(v.string()),
    startedAt: v.number(),
    completedAt: v.optional(v.number()),
  })
    .index("by_org", ["orgId"])
    .index("by_integration", ["integrationId"])
    .index("by_integration_started", ["integrationId", "startedAt"]),

  webhooks: defineTable({
    orgId: v.string(),
    integrationId: v.optional(v.id("integrations")),
    provider: v.string(),
    eventType: v.string(),
    payload: v.any(),
    status: v.union(
      v.literal("received"),
      v.literal("processed"),
      v.literal("failed"),
    ),
    errorMessage: v.optional(v.string()),
    processedAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_org", ["orgId"])
    .index("by_integration", ["integrationId"])
    .index("by_status", ["status"])
    .index("by_created", ["createdAt"]),
});
