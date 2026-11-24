import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  expenses: defineTable({
    orgId: v.string(),
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
  .index("by_org_status_date", ["orgId", "status", "date"])
  .index("by_org_deletedAt_status", ["orgId", "deletedAt", "status"])
  .index("by_receiptImageId", ["receiptImageId"])
  .index("by_org_ocrSource", ["orgId", "ocrSource"])
  .index("by_org_clientRequest", ["orgId", "clientRequestId"])
  .index("by_org_categoryId", ["orgId", "categoryId"])
  .index("by_org_category", ["orgId", "category"])
  .index("by_org_enteredBy", ["orgId", "enteredBy"]),

  settlements: defineTable({
    orgId: v.string(),
    amount: v.number(),
    fromUser: v.string(),
    toUser: v.string(),
    date: v.string(),
    status: v.optional(v.union(v.literal("pending"), v.literal("settled"), v.literal("canceled"))),
    createdAt: v.number(),
    updatedAt: v.number(),
    deletedAt: v.optional(v.number()),
  })
  .index("by_org", ["orgId"])
  .index("by_org_fromUser", ["orgId", "fromUser"])
  .index("by_org_toUser", ["orgId", "toUser"]),

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
    // D26: subscription role for feature gating (free | paying | admin)
    subscriptionRole: v.union(
      v.literal("free"),
      v.literal("paying"),
      v.literal("admin"),
    ),
    invitedBy: v.optional(v.string()),
    joinedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
    deletedAt: v.optional(v.number()),
  })
    .index("by_org", ["orgId"])
    .index("by_user", ["userId"])
    .index("by_org_user", ["orgId", "userId"])
    .index("by_org_status", ["orgId", "status"])
    .index("by_org_subscriptionRole", ["orgId", "subscriptionRole"]),

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

  subscriptions: defineTable({
    orgId: v.string(),
    plan: v.union(v.literal("free"), v.literal("pro")),
    status: v.union(
      v.literal("inactive"),
      v.literal("active"),
      v.literal("trialing"),
      v.literal("past_due"),
      v.literal("canceled"),
      v.literal("pending"),
      v.literal("local_test"),
    ),
    stripeCustomerId: v.optional(v.string()),
    stripeSubscriptionId: v.optional(v.string()),
    stripePriceId: v.optional(v.string()),
    currentPeriodEnd: v.optional(v.number()),
    trialStart: v.optional(v.number()),
    trialEnd: v.optional(v.number()),
    dunningAttempts: v.optional(v.number()),
    portalUrl: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_org", ["orgId"])
    .index("by_status", ["status"])
    .index("by_stripe_customer", ["stripeCustomerId"])
    .index("by_stripe_subscription", ["stripeSubscriptionId"]),

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

  // D26: Free-member usage limits (monthly expense/OCR caps)
  usageLimits: defineTable({
    orgId: v.string(),
    month: v.string(), // YYYY-MM
    expenseCount: v.number(),
    ocrCount: v.number(),
    expenseCap: v.number(),
    ocrCap: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_org_month", ["orgId", "month"]),

  receiptUploads: defineTable({
    storageId: v.id("_storage"),
    orgId: v.string(),
    uploadedBy: v.string(),
    expenseId: v.optional(v.id("expenses")),
    // Set before storage deletion so a concurrent expense cannot claim the blob.
    deletingAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_storageId", ["storageId"])
    .index("by_org", ["orgId"])
    .index("by_expenseId", ["expenseId"])
    .index("by_createdAt", ["createdAt"]),

  categories: defineTable({
    orgId: v.string(),
    name: v.string(),
    icon: v.optional(v.string()),
    color: v.string(),
    parentId: v.optional(v.id("categories")),
    budgetMonthly: v.optional(v.number()),
    isDefault: v.boolean(),
    sortOrder: v.number(),
    subCategories: v.optional(v.array(v.string())),
    createdBy: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
    deletedAt: v.optional(v.number()),
  })
    .index("by_org", ["orgId"])
    .index("by_org_parent", ["orgId", "parentId"]),

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

  notifications: defineTable({
    orgId: v.string(),
    userId: v.string(),
    type: v.union(
      v.literal("expense_pending"),
      v.literal("expense_approved"),
      v.literal("expense_rejected"),
      v.literal("settlement_created"),
      v.literal("invite_sent"),
      v.literal("goal_alert"),
    ),
    title: v.string(),
    body: v.string(),
    data: v.optional(v.any()),
    read: v.boolean(),
    createdAt: v.number(),
  })
    .index("by_org_user_read", ["orgId", "userId", "read"])
    .index("by_org_user_created", ["orgId", "userId", "createdAt"])
    .index("by_createdAt", ["createdAt"]),

  notificationPreferences: defineTable({
    orgId: v.string(),
    userId: v.string(),
    expensePending: v.boolean(),
    expenseApproved: v.boolean(),
    expenseRejected: v.boolean(),
    settlementCreated: v.boolean(),
    inviteSent: v.boolean(),
    quietHoursStart: v.optional(v.string()),
    quietHoursEnd: v.optional(v.string()),
    batchWindowMs: v.number(),
    emailFallback: v.boolean(),
    updatedAt: v.number(),
  })
    .index("by_org_user", ["orgId", "userId"]),

  // Goal tracking and budget variance
  // Supports savings goals, monthly budgets, category budgets, and debt payoff
  goals: defineTable({
    orgId: v.string(),
    userId: v.string(),
    name: v.string(),
    type: v.union(
      v.literal("savings_target"),
      v.literal("monthly_spending_limit"),
      v.literal("category_budget"),
      v.literal("debt_payoff"),
    ),
    targetAmount: v.number(),
    categoryId: v.optional(v.id("categories")),
    currentAmount: v.number(),
    progressPercent: v.number(),
    varianceAmount: v.number(),
    variancePercent: v.number(),
    projectedCompletion: v.optional(v.number()),
    status: v.union(
      v.literal("active"),
      v.literal("achieved"),
      v.literal("at_risk"),
      v.literal("over_budget"),
      v.literal("paused"),
    ),
    alertAtPercent: v.number(),
    alertSent: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_org", ["orgId"])
    .index("by_org_status", ["orgId", "status"])
    .index("by_org_user", ["orgId", "userId"]),

  reports: defineTable({
    orgId: v.string(),
    userId: v.string(),
    name: v.string(),
    type: v.union(
      v.literal("monthly_summary"),
      v.literal("category_breakdown"),
      v.literal("settlement_history"),
      v.literal("budget_variance"),
      v.literal("custom"),
    ),
    config: v.any(),
    format: v.union(v.literal("csv"), v.literal("json")),
    status: v.union(v.literal("generating"), v.literal("ready"), v.literal("failed")),
    storageId: v.optional(v.id("_storage")),
    downloadUrl: v.optional(v.string()),
    expiresAt: v.number(),
    scheduled: v.optional(v.boolean()),
    scheduleCron: v.optional(v.string()),
    lastGeneratedAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_org_user", ["orgId", "userId"])
    .index("by_org_scheduled", ["orgId", "scheduled"])
    .index("by_expires", ["expiresAt"]),
});
