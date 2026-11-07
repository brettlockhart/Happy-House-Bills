import { mutation, query, internal } from "../_generated/server";
import { v } from "convex/values";
import { requireAuthenticatedOrg } from "../auth";
import { checkPermission } from "./shared-constants";

export const INTEGRATION_TYPES = [
  "bank",
  "accounting",
  "travel",
  "payment",
  "ocr",
  "storage",
  "email",
  "analytics",
] as const;

export type IntegrationType = (typeof INTEGRATION_TYPES)[number];

export const INTEGRATION_STATUSES = [
  "connected",
  "disconnected",
  "error",
  "pending",
] as const;

export type IntegrationStatus = (typeof INTEGRATION_STATUSES)[number];

export const SYNC_STATUSES = ["success", "failed", "partial"] as const;

export type SyncStatus = (typeof SYNC_STATUSES)[number];

export const listIntegrations = query({
  args: { type: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const { orgId } = await requireAuthenticatedOrg(ctx);

    if (!checkPermission("admin", "integration:read")) {
      throw new Error("Insufficient permissions to view integrations");
    }

    let queryBuilder = ctx.db.query("integrations").withIndex("by_org", (q) =>
      q.eq("orgId", orgId),
    );

    if (args.type) {
      queryBuilder = queryBuilder.filter((q) =>
        q.eq(q.field("type"), args.type),
      );
    }

    return queryBuilder.collect();
  },
});

export const getIntegration = query({
  args: { integrationId: v.id("integrations") },
  handler: async (ctx, args) => {
    const { orgId } = await requireAuthenticatedOrg(ctx);

    const integration = await ctx.db.get(args.integrationId);
    if (!integration || integration.orgId !== orgId) {
      throw new Error("Integration not found");
    }

    return integration;
  },
});

export const createIntegration = mutation({
  args: {
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
  },
  handler: async (ctx, args) => {
    const { orgId, userId } = await requireAuthenticatedOrg(ctx);

    if (!checkPermission("admin", "integration:create")) {
      throw new Error("Insufficient permissions to create integrations");
    }

    const existing = await ctx.db
      .query("integrations")
      .withIndex("by_org_provider", (q) =>
        q.eq("orgId", orgId).eq("provider", args.provider),
      )
      .first();

    if (existing) {
      throw new Error(`Integration with provider ${args.provider} already exists`);
    }

    const now = Date.now();
    const id = await ctx.db.insert("integrations", {
      orgId,
      type: args.type,
      provider: args.provider,
      name: args.name,
      config: args.config ?? {},
      credentials: args.credentials ?? {},
      status: "pending",
      createdBy: userId,
      createdAt: now,
      updatedAt: now,
    });

    return { integrationId: id };
  },
});

export const updateIntegration = mutation({
  args: {
    integrationId: v.id("integrations"),
    name: v.optional(v.string()),
    config: v.optional(v.any()),
    credentials: v.optional(v.any()),
    status: v.optional(
      v.union(
        v.literal("connected"),
        v.literal("disconnected"),
        v.literal("error"),
        v.literal("pending"),
      ),
    ),
  },
  handler: async (ctx, args) => {
    const { orgId } = await requireAuthenticatedOrg(ctx);

    if (!checkPermission("admin", "integration:update")) {
      throw new Error("Insufficient permissions to update integrations");
    }

    const integration = await ctx.db.get(args.integrationId);
    if (!integration || integration.orgId !== orgId) {
      throw new Error("Integration not found");
    }

    const now = Date.now();
    await ctx.db.patch(args.integrationId, {
      ...(args.name && { name: args.name }),
      ...(args.config && { config: args.config }),
      ...(args.credentials && { credentials: args.credentials }),
      ...(args.status && { status: args.status }),
      updatedAt: now,
    });

    return { integrationId: args.integrationId };
  },
});

export const deleteIntegration = mutation({
  args: { integrationId: v.id("integrations") },
  handler: async (ctx, args) => {
    const { orgId } = await requireAuthenticatedOrg(ctx);

    if (!checkPermission("admin", "integration:delete")) {
      throw new Error("Insufficient permissions to delete integrations");
    }

    const integration = await ctx.db.get(args.integrationId);
    if (!integration || integration.orgId !== orgId) {
      throw new Error("Integration not found");
    }

    await ctx.db.delete(args.integrationId);
    return { integrationId: args.integrationId };
  },
});

export const getSyncLogs = query({
  args: {
    integrationId: v.id("integrations"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { orgId } = await requireAuthenticatedOrg(ctx);

    const integration = await ctx.db.get(args.integrationId);
    if (!integration || integration.orgId !== orgId) {
      throw new Error("Integration not found");
    }

    const limit = args.limit ?? 50;
    return ctx.db
      .query("integrationSyncLogs")
      .withIndex("by_integration_started", (q) =>
        q.eq("integrationId", args.integrationId),
      )
      .order("desc")
      .take(limit)
      .collect();
  },
});

export const recordSyncLog = internal({
  args: {
    orgId: v.string(),
    integrationId: v.id("integrations"),
    status: v.union(v.literal("success"), v.literal("failed"), v.literal("partial")),
    recordsProcessed: v.number(),
    recordsCreated: v.number(),
    recordsUpdated: v.number(),
    recordsSkipped: v.number(),
    errorMessage: v.optional(v.string()),
    startedAt: v.number(),
    completedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    await ctx.db.insert("integrationSyncLogs", {
      orgId: args.orgId,
      integrationId: args.integrationId,
      status: args.status,
      recordsProcessed: args.recordsProcessed,
      recordsCreated: args.recordsCreated,
      recordsUpdated: args.recordsUpdated,
      recordsSkipped: args.recordsSkipped,
      errorMessage: args.errorMessage,
      startedAt: args.startedAt,
      completedAt: args.completedAt ?? now,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const listWebhooks = query({
  args: {
    integrationId: v.optional(v.id("integrations")),
    status: v.optional(
      v.union(v.literal("received"), v.literal("processed"), v.literal("failed")),
    ),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { orgId } = await requireAuthenticatedOrg(ctx);

    let queryBuilder = ctx.db.query("webhooks").withIndex("by_org", (q) =>
      q.eq("orgId", orgId),
    );

    if (args.integrationId) {
      queryBuilder = queryBuilder.filter((q) =>
        q.eq(q.field("integrationId"), args.integrationId),
      );
    }

    if (args.status) {
      queryBuilder = queryBuilder.filter((q) =>
        q.eq(q.field("status"), args.status),
      );
    }

    const limit = args.limit ?? 100;
    return queryBuilder.order("desc").take(limit).collect();
  },
});

export const handleWebhook = internal({
  args: {
    orgId: v.string(),
    integrationId: v.optional(v.id("integrations")),
    provider: v.string(),
    eventType: v.string(),
    payload: v.any(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    await ctx.db.insert("webhooks", {
      orgId: args.orgId,
      integrationId: args.integrationId,
      provider: args.provider,
      eventType: args.eventType,
      payload: args.payload,
      status: "received",
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const markWebhookProcessed = internal({
  args: {
    webhookId: v.id("webhooks"),
    status: v.union(v.literal("processed"), v.literal("failed")),
    errorMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    await ctx.db.patch(args.webhookId, {
      status: args.status,
      errorMessage: args.errorMessage,
      processedAt: now,
      updatedAt: now,
    });
  },
});

export const testConnection = internal({
  args: {
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
    credentials: v.any(),
  },
  handler: async (ctx, args) => {
    const { testBankConnection } = await import("./bank-api");
    const { testAccountingConnection } = await import("./accounting-api");
    const { testTravelConnection } = await import("./travel-api");

    switch (args.type) {
      case "bank":
        return testBankConnection(args.provider, args.credentials);
      case "accounting":
        return testAccountingConnection(args.provider, args.credentials);
      case "travel":
        return testTravelConnection(args.provider, args.credentials);
      default:
        return { success: false, error: `Connection test not implemented for ${args.type}` };
    }
  },
});