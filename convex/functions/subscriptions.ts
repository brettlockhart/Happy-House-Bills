import { internalMutation, mutation, query, internalQuery } from "../_generated/server";
import type { MutationCtx } from "../_generated/server";
import { v } from "convex/values";
import { requireAuthenticatedOrg } from "../auth";
import { assertOrgWriteAccess } from "./permissions";

type SubscriptionStatus =
  | "pending"
  | "active"
  | "inactive"
  | "trialing"
  | "past_due"
  | "canceled"
  | "local_test";

const DUNNING_MAX_ATTEMPTS = 3;
const TRIAL_DAYS = 7;
const RENEWAL_REMINDER_DAYS = 3;

// Timing-safe string comparison to prevent timing attacks
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

export const getStatus = query({
  args: {},
  handler: async (ctx) => {
    const { orgId } = await requireAuthenticatedOrg(ctx);

    const sub = await ctx.db
      .query("subscriptions")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .first();

    if (!sub) {
      return { plan: "free", status: "inactive" };
    }

    return {
      plan: sub.plan,
      status: sub.status,
      currentPeriodEnd: sub.currentPeriodEnd,
      trialEnd: sub.trialEnd,
      portalUrl: sub.portalUrl,
    };
  },
});

export const getPortalUrl = query({
  args: {},
  handler: async (ctx) => {
    const { orgId } = await requireAuthenticatedOrg(ctx);

    const sub = await ctx.db
      .query("subscriptions")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .first();

    return { portalUrl: sub?.portalUrl ?? null };
  },
});

export const createCheckout = mutation({
  args: { priceId: v.string() },
  handler: async (ctx, args) => {
    const { userId, orgId } = await requireAuthenticatedOrg(ctx);
    await assertOrgWriteAccess(ctx, orgId, userId);

    const secretKey = process.env.STRIPE_SECRET_KEY;
    const stripeLocalMock = process.env.STRIPE_LOCAL_MOCK;
    const isLocalTest = stripeLocalMock === "1" && (!secretKey || secretKey.startsWith("sk_test_"));
    const isLiveKey = secretKey && !secretKey.startsWith("sk_test_") && stripeLocalMock !== "1";

    const now = Date.now();

    let status: SubscriptionStatus;
    let sessionUrl: string;
    let currentPeriodEnd: number;
    let stripeCustomerId: string;
    let stripeSubscriptionId: string;
    let trialStart: number | undefined;
    let trialEnd: number | undefined;

    if (isLocalTest) {
      status = "local_test";
      currentPeriodEnd = now + 30 * 24 * 60 * 60 * 1000;
      sessionUrl = `/upgrade?local_test=1&orgId=${orgId}`;
      stripeCustomerId = `cus_local_${orgId}`;
      stripeSubscriptionId = `sub_local_${orgId}`;
    } else if (isLiveKey) {
      status = "pending";
      currentPeriodEnd = now + 30 * 24 * 60 * 60 * 1000;
      sessionUrl = `/upgrade?pending=1&orgId=${orgId}`;
      stripeCustomerId = `cus_local_${orgId}`;
      stripeSubscriptionId = `sub_local_${orgId}`;
      // Trial period for new subscriptions
      trialStart = now;
      trialEnd = now + TRIAL_DAYS * 24 * 60 * 60 * 1000;
    } else {
      status = "inactive";
      currentPeriodEnd = 0;
      sessionUrl = "/free";
      stripeCustomerId = `cus_local_${orgId}`;
      stripeSubscriptionId = `sub_local_${orgId}`;
    }

    const existing = await ctx.db
      .query("subscriptions")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        plan: "pro",
        status,
        stripeCustomerId,
        stripeSubscriptionId,
        stripePriceId: args.priceId,
        currentPeriodEnd,
        trialStart,
        trialEnd,
        dunningAttempts: 0,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("subscriptions", {
        orgId,
        plan: "pro",
        status,
        stripeCustomerId,
        stripeSubscriptionId,
        stripePriceId: args.priceId,
        currentPeriodEnd,
        trialStart,
        trialEnd,
        dunningAttempts: 0,
        createdAt: now,
        updatedAt: now,
      });
    }

    return {
      sessionUrl,
      subscriptionId: stripeSubscriptionId,
      statusNote:
        isLiveKey
          ? "Subscription pending Stripe API confirmation. Mark active after webhook event."
          : undefined,
      trialEnd: trialEnd ?? undefined,
    };
  },
});

export const webhook = internalMutation({
  args: {
    eventType: v.string(),
    payload: v.union(v.string(), v.any()),
    signature: v.optional(v.string()),
    timestamp: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    const stripeLocalMock = process.env.STRIPE_LOCAL_MOCK;
    const isLocalTest = stripeLocalMock === "1" && (!secretKey || secretKey.startsWith("sk_test_"));
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (isLocalTest) {
      return { received: true, localTest: true };
    }

    if (!webhookSecret) {
      throw new Error("STRIPE_WEBHOOK_SECRET not configured");
    }
    if (!args.signature || !args.timestamp) {
      throw new Error("Missing Stripe webhook signature or timestamp");
    }
    const payloadStr = typeof args.payload === "string" ? args.payload : JSON.stringify(args.payload);

    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      enc.encode(webhookSecret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const signedPayload = `${args.timestamp}.${payloadStr}`;
    const sig = await crypto.subtle.sign("HMAC", key, enc.encode(signedPayload));
    const hex = Array.from(new Uint8Array(sig))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    const tPart = args.signature.split(",")[0] ?? "";
    const v1Part = args.signature.split(",")[1] ?? "";
    const ts = tPart.replace("t=", "");
    const receivedHex = v1Part.replace("v1=", "");

    const timestampValid = ts.length > 0 && ts === args.timestamp;
    const signatureValid = receivedHex.length > 0 && timingSafeEqual(receivedHex.toLowerCase(), hex.toLowerCase());

    if (!timestampValid || !signatureValid) {
      throw new Error("Invalid Stripe webhook signature");
    }

    let event: { type: string; data: Record<string, unknown> };
    try {
      event = JSON.parse(payloadStr);
    } catch {
      throw new Error("Invalid JSON payload");
    }

    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(ctx, event);
        break;
      case "invoice.payment_succeeded":
      case "customer.subscription.updated":
        await handleSubscriptionEvent(ctx, event);
        break;
      case "invoice.payment_failed":
        await handlePaymentFailed(ctx, event);
        break;
      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(ctx, event);
        break;
      default:
        break;
    }

    return { received: true };
  },
});

async function handleCheckoutCompleted(
  ctx: MutationCtx,
  event: { type: string; data: Record<string, unknown> },
) {
  const session = (event.data.object ?? {}) as Record<string, unknown>;
  const stripeCustomerId = session.customer as string | undefined;
  const stripeSubscriptionId = session.subscription as string | undefined;
  if (!stripeCustomerId || !stripeSubscriptionId) return;

  const existing = await ctx.db
    .query("subscriptions")
    .withIndex("by_stripe_customer", (q) => q.eq("stripeCustomerId", stripeCustomerId))
    .first();

  if (!existing) return;

  const now = Date.now();
  const status = existing.trialEnd && existing.trialEnd > now ? "trialing" : "active";

  await ctx.db.patch(existing._id, {
    plan: "pro",
    status,
    stripeSubscriptionId,
    currentPeriodEnd: now + 30 * 24 * 60 * 60 * 1000,
    dunningAttempts: 0,
    updatedAt: now,
  });

  // D26: Upgrade org membership subscriptionRole to paying on checkout success
  if (status === "active" && existing.orgId) {
    const members = await ctx.db
      .query("memberships")
      .withIndex("by_org", (q) => q.eq("orgId", existing.orgId))
      .collect();

    for (const member of members) {
      if (member.subscriptionRole !== "admin") {
        await ctx.db.patch(member._id, {
          subscriptionRole: "paying",
          updatedAt: now,
        });
      }
    }
  }
}

async function handleSubscriptionEvent(
  ctx: MutationCtx,
  event: { type: string; data: Record<string, unknown> },
) {
  const subscription = (event.data?.object ?? {}) as Record<string, unknown>;
  const stripeCustomerId = subscription.customer as string | undefined;
  const stripeSubscriptionId = subscription.id as string | undefined;
  const status = subscription.status as string | undefined;
  const currentPeriodEnd = (subscription.current_period_end as number | undefined) ?? 0;
  const trialEnd = subscription.trial_end as number | undefined;

  if (!stripeCustomerId || !stripeSubscriptionId) return;

  const existing = await ctx.db
    .query("subscriptions")
    .withIndex("by_stripe_customer", (q) => q.eq("stripeCustomerId", stripeCustomerId))
    .first();

  if (!existing) return;

  const now = Date.now();
  const isTrialing = status === "trialing" || (trialEnd !== undefined && trialEnd > now);
  const isActive = status === "active";
  const isPastDue = status === "past_due";

  const plan = isActive || isTrialing ? "pro" : "free";
  let newStatus: SubscriptionStatus = "canceled";
  if (isTrialing) newStatus = "trialing";
  else if (isActive) newStatus = "active";
  else if (isPastDue) newStatus = "past_due";

  await ctx.db.patch(existing._id, {
    plan,
    status: newStatus,
    stripeSubscriptionId,
    currentPeriodEnd: currentPeriodEnd * 1000,
    trialEnd: trialEnd !== undefined ? trialEnd * 1000 : existing.trialEnd,
    updatedAt: now,
  });
}

async function handlePaymentFailed(
  ctx: MutationCtx,
  event: { type: string; data: Record<string, unknown> },
) {
  const invoice = (event.data?.object ?? {}) as Record<string, unknown>;
  const stripeCustomerId = invoice.customer as string | undefined;
  if (!stripeCustomerId) return;

  const existing = await ctx.db
    .query("subscriptions")
    .withIndex("by_stripe_customer", (q) => q.eq("stripeCustomerId", stripeCustomerId))
    .first();

  if (!existing) return;

  const attempts = (existing.dunningAttempts ?? 0) + 1;
  const now = Date.now();

  if (attempts >= DUNNING_MAX_ATTEMPTS) {
    await ctx.db.patch(existing._id, {
      status: "inactive",
      plan: "free",
      dunningAttempts: attempts,
      updatedAt: now,
    });
  } else {
    await ctx.db.patch(existing._id, {
      status: "past_due",
      plan: "free",
      dunningAttempts: attempts,
      updatedAt: now,
    });
  }
}

async function handleSubscriptionDeleted(
  ctx: MutationCtx,
  event: { type: string; data: Record<string, unknown> },
) {
  const subscription = (event.data?.object ?? {}) as Record<string, unknown>;
  const stripeCustomerId = subscription.customer as string | undefined;
  if (!stripeCustomerId) return;

  const existing = await ctx.db
    .query("subscriptions")
    .withIndex("by_stripe_customer", (q) => q.eq("stripeCustomerId", stripeCustomerId))
    .first();

  if (!existing) return;

  await ctx.db.patch(existing._id, {
    status: "canceled",
    plan: "free",
    updatedAt: Date.now(),
  });
}

export const cancel = mutation({
  args: {},
  handler: async (ctx) => {
    const { userId, orgId } = await requireAuthenticatedOrg(ctx);
    await assertOrgWriteAccess(ctx, orgId, userId);

    const now = Date.now();
    const existing = await ctx.db
      .query("subscriptions")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        status: "canceled",
        plan: "free",
        updatedAt: now,
      });
    }

    return { success: true };
  },
});

export const ensureSubscription = internalMutation({
  args: { orgId: v.string() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("subscriptions")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .first();

    if (!existing) {
      const now = Date.now();
      await ctx.db.insert("subscriptions", {
        orgId: args.orgId,
        plan: "free",
        status: "inactive",
        dunningAttempts: 0,
        createdAt: now,
        updatedAt: now,
      });
    }
  },
});

// Internal query: find subscriptions approaching renewal (for scheduled reminders)
export const findSubscriptionsNeedingRenewalReminder = internalQuery({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const threshold = now + RENEWAL_REMINDER_DAYS * 24 * 60 * 60 * 1000;
    const results = await ctx.db
      .query("subscriptions")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .collect();

    return results.filter(
      (sub) =>
        sub.currentPeriodEnd !== undefined &&
        sub.currentPeriodEnd > now &&
        sub.currentPeriodEnd <= threshold,
    );
  },
});