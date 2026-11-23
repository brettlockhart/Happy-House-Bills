import { describe, it, expect, vi, beforeEach } from "vitest";

const { requireAuthenticatedOrg, assertOrgWriteAccess } = vi.hoisted(() => ({
  requireAuthenticatedOrg: vi.fn(),
  assertOrgWriteAccess: vi.fn(),
}));

vi.mock("../../convex/_generated/server", () => ({
  query: (config: { handler: (ctx: unknown, args: unknown) => Promise<unknown> }) => ({
    ...config,
    handler: config.handler.bind(config),
  }),
  mutation: (config: { handler: (ctx: unknown, args: unknown) => Promise<unknown> }) => ({
    ...config,
    handler: config.handler.bind(config),
  }),
  internalMutation: (config: { handler: (ctx: unknown, args: unknown) => Promise<unknown> }) => ({
    ...config,
    handler: config.handler.bind(config),
  }),
  internalQuery: (config: { handler: (ctx: unknown, args: unknown) => Promise<unknown> }) => ({
    ...config,
    handler: config.handler.bind(config),
  }),
}));

vi.mock("convex/values", () => ({
  v: {
    object: () => ({ _isValidator: true }),
    string: () => ({ _isValidator: true }),
    number: () => ({ _isValidator: true }),
    union: () => ({ _isValidator: true }),
    literal: () => ({ _isValidator: true }),
    boolean: () => ({ _isValidator: true }),
    optional: () => ({ _isValidator: true }),
    id: () => ({ _isValidator: true }),
    array: () => ({ _isValidator: true }),
    any: () => ({ _isValidator: true }),
  },
}));

vi.mock("../../convex/auth", () => ({
  requireAuthenticatedOrg,
}));

vi.mock("../../convex/functions/permissions", () => ({
  assertOrgWriteAccess,
}));

interface QueryChain {
  withIndex: (name: string, fn?: (q: { eq: (field: string, value: unknown) => unknown }) => unknown) => QueryChain;
  filter: (fn: unknown) => QueryChain;
  order: (direction: string) => QueryChain;
  collect: () => Promise<unknown[]>;
  first: () => Promise<unknown | null>;
}

function createQueryChain(results: unknown[] = []): QueryChain {
  const filtered = results.slice();
  const chainable: QueryChain = {
    withIndex: () => chainable,
    filter: () => chainable,
    order: () => chainable,
    collect: () => Promise.resolve(filtered),
    first: () => Promise.resolve(filtered[0] || null),
  };
  return chainable;
}

interface MockCtx {
  db: {
    query: (table: string) => QueryChain;
    patch: (id: string, data: Record<string, unknown>) => Promise<void>;
    insert: (table: string, data: Record<string, unknown>) => Promise<string>;
  };
}

function makeCtx(options?: {
  subscriptions?: unknown[];
}): MockCtx & {
  _patchCalls: Array<{ id: string; data: Record<string, unknown> }>;
  _insertCalls: Array<{ table: string; data: Record<string, unknown> }>;
} {
  const subscriptions = options?.subscriptions || [];
  const ctx = {
    _patchCalls: [] as Array<{ id: string; data: Record<string, unknown> }>,
    _insertCalls: [] as Array<{ table: string; data: Record<string, unknown> }>,
    db: {
      query: (_table: string) => createQueryChain(subscriptions),
      patch: (id: string, data: Record<string, unknown>) => {
        ctx._patchCalls.push({ id, data });
        return Promise.resolve();
      },
      insert: (table: string, data: Record<string, unknown>) => {
        ctx._insertCalls.push({ table, data });
        return Promise.resolve("mock_sub_id");
      },
    },
  };
  return ctx;
}

describe("subscriptions:getStatus", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.unstubAllEnvs();
    vi.stubEnv("STRIPE_SECRET_KEY", undefined);
  });

  it("returns free/inactive when no subscription exists", async () => {
    requireAuthenticatedOrg.mockResolvedValue({ userId: "user_1", orgId: "org_1" });

    const { getStatus } = await import("../../convex/functions/subscriptions");
    const ctx = makeCtx({ subscriptions: [] });
    const result = await getStatus.handler(ctx as never, {}) as Record<string, unknown>;
    expect(result.plan).toBe("free");
    expect(result.status).toBe("inactive");
    expect(result.currentPeriodEnd).toBeUndefined();
  });

  it("returns active subscription data when subscription exists", async () => {
    requireAuthenticatedOrg.mockResolvedValue({ userId: "user_1", orgId: "org_1" });

    const { getStatus } = await import("../../convex/functions/subscriptions");
    const ctx = makeCtx({
      subscriptions: [{ _id: "sub_1", orgId: "org_1", plan: "pro", status: "active", currentPeriodEnd: 1234567890 }],
    });
    const result = await getStatus.handler(ctx as never, {}) as Record<string, unknown>;
    expect(result.plan).toBe("pro");
    expect(result.status).toBe("active");
    expect(result.currentPeriodEnd).toBe(1234567890);
  });

  it("returns canceled subscription status", async () => {
    requireAuthenticatedOrg.mockResolvedValue({ userId: "user_1", orgId: "org_1" });

    const { getStatus } = await import("../../convex/functions/subscriptions");
    const ctx = makeCtx({
      subscriptions: [{ _id: "sub_1", orgId: "org_1", plan: "free", status: "canceled" }],
    });
    const result = await getStatus.handler(ctx as never, {}) as Record<string, unknown>;
    expect(result.plan).toBe("free");
    expect(result.status).toBe("canceled");
  });

  it("returns local_test subscription status", async () => {
    requireAuthenticatedOrg.mockResolvedValue({ userId: "user_1", orgId: "org_1" });

    const { getStatus } = await import("../../convex/functions/subscriptions");
    const ctx = makeCtx({
      subscriptions: [{ _id: "sub_1", orgId: "org_1", plan: "pro", status: "local_test", currentPeriodEnd: 1234567890 }],
    });
    const result = await getStatus.handler(ctx as never, {}) as Record<string, unknown>;
    expect(result.plan).toBe("pro");
    expect(result.status).toBe("local_test");
  });

  it("throws when unauthenticated", async () => {
    requireAuthenticatedOrg.mockRejectedValue(new Error("Unauthenticated"));

    const { getStatus } = await import("../../convex/functions/subscriptions");
    const ctx = makeCtx();
    await expect(getStatus.handler(ctx as never, {})).rejects.toThrow("Unauthenticated");
  });
});

describe("subscriptions:createCheckout", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.unstubAllEnvs();
    vi.stubEnv("STRIPE_SECRET_KEY", undefined);
    assertOrgWriteAccess.mockResolvedValue(undefined);
  });

  it("creates a new subscription in local_test mode when no STRIPE_SECRET_KEY and STRIPE_LOCAL_MOCK=1", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", undefined);
    vi.stubEnv("STRIPE_LOCAL_MOCK", "1");
    requireAuthenticatedOrg.mockResolvedValue({ userId: "user_1", orgId: "org_1" });

    const { createCheckout } = await import("../../convex/functions/subscriptions");
    const ctx = makeCtx({ subscriptions: [] });
    const result = await createCheckout.handler(ctx as never, { priceId: "price_test_123" }) as Record<string, unknown>;

    expect(ctx._insertCalls).toHaveLength(1);
    const insertCall = ctx._insertCalls[0];
    expect(insertCall.table).toBe("subscriptions");
    expect(insertCall.data.plan).toBe("pro");
    expect(insertCall.data.status).toBe("local_test");
    expect(insertCall.data.stripePriceId).toBe("price_test_123");
    expect(result).toHaveProperty("sessionUrl");
    expect(result).toHaveProperty("subscriptionId");
    expect((result.sessionUrl as string)).toContain("local_test=1");
  });

  it("creates a new subscription in local_test mode with sk_test_ key and STRIPE_LOCAL_MOCK=1", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_abc123");
    vi.stubEnv("STRIPE_LOCAL_MOCK", "1");
    requireAuthenticatedOrg.mockResolvedValue({ userId: "user_1", orgId: "org_1" });

    const { createCheckout } = await import("../../convex/functions/subscriptions");
    const ctx = makeCtx({ subscriptions: [] });
    const result = await createCheckout.handler(ctx as never, { priceId: "price_test_456" }) as Record<string, unknown>;

    expect(ctx._insertCalls).toHaveLength(1);
    const insertCall = ctx._insertCalls[0];
    expect(insertCall.data.status).toBe("local_test");
    expect((result.sessionUrl as string)).toContain("local_test=1");
  });

  it("creates a new subscription in active mode with production key", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_live_abc123");
    requireAuthenticatedOrg.mockResolvedValue({ userId: "user_1", orgId: "org_1" });

    const { createCheckout } = await import("../../convex/functions/subscriptions");
    const ctx = makeCtx({ subscriptions: [] });
    const result = await createCheckout.handler(ctx as never, { priceId: "price_live_789" }) as Record<string, unknown>;

    expect(ctx._insertCalls).toHaveLength(1);
    const insertCall = ctx._insertCalls[0];
    expect(insertCall.data.status).toBe("pending");
    expect((result.sessionUrl as string)).toContain("pending=1");
  });

  it("updates an existing subscription instead of inserting new", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_live_abc123");
    requireAuthenticatedOrg.mockResolvedValue({ userId: "user_1", orgId: "org_1" });

    const existing = [{
      _id: "sub_existing",
      orgId: "org_1",
      plan: "free",
      status: "inactive",
      createdAt: 1000,
      updatedAt: 1000,
    }];

    const { createCheckout } = await import("../../convex/functions/subscriptions");
    const ctx = makeCtx({ subscriptions: existing });
    await createCheckout.handler(ctx as never, { priceId: "price_new_999" });

    expect(ctx._insertCalls).toHaveLength(0);
    expect(ctx._patchCalls).toHaveLength(1);
    expect(ctx._patchCalls[0].data.plan).toBe("pro");
    expect(ctx._patchCalls[0].data.status).toBe("pending");
    expect(ctx._patchCalls[0].data.stripePriceId).toBe("price_new_999");
  });

  it("throws when user lacks write access to org", async () => {
    requireAuthenticatedOrg.mockResolvedValue({ userId: "user_1", orgId: "org_1" });
    assertOrgWriteAccess.mockRejectedValue(new Error("Access denied"));

    const { createCheckout } = await import("../../convex/functions/subscriptions");
    const ctx = makeCtx();
    await expect(createCheckout.handler(ctx as never, { priceId: "price_test" })).rejects.toThrow("Access denied");
  });

  it("throws when unauthenticated", async () => {
    requireAuthenticatedOrg.mockRejectedValue(new Error("Unauthenticated"));

    const { createCheckout } = await import("../../convex/functions/subscriptions");
    const ctx = makeCtx();
    await expect(createCheckout.handler(ctx as never, { priceId: "price_test" })).rejects.toThrow("Unauthenticated");
  });

  it("sets currentPeriodEnd to 30 days from now", async () => {
    vi.stubEnv("STRIPE_LOCAL_MOCK", "1");
    vi.setSystemTime(new Date("2026-11-21T12:00:00Z"));
    requireAuthenticatedOrg.mockResolvedValue({ userId: "user_1", orgId: "org_1" });

    const { createCheckout } = await import("../../convex/functions/subscriptions");
    const ctx = makeCtx({ subscriptions: [] });
    await createCheckout.handler(ctx as never, { priceId: "price_test" });

    const expectedPeriodEnd = new Date("2026-11-21T12:00:00Z").getTime() + 30 * 24 * 60 * 60 * 1000;
    expect(ctx._insertCalls[0].data.currentPeriodEnd).toBe(expectedPeriodEnd);
    vi.useRealTimers();
  });

  it("generates stripe customer ID scoped to org", async () => {
    requireAuthenticatedOrg.mockResolvedValue({ userId: "user_1", orgId: "org_42" });

    const { createCheckout } = await import("../../convex/functions/subscriptions");
    const ctx = makeCtx({ subscriptions: [] });
    await createCheckout.handler(ctx as never, { priceId: "price_test" });

    expect(ctx._insertCalls[0].data.stripeCustomerId).toBe("cus_local_org_42");
    expect(ctx._insertCalls[0].data.stripeSubscriptionId).toBe("sub_local_org_42");
  });
});

describe("subscriptions:webhook", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.unstubAllEnvs();
  });

  it("returns localTest true in local mode (no key) when STRIPE_LOCAL_MOCK=1", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", undefined);
    vi.stubEnv("STRIPE_LOCAL_MOCK", "1");

    const { webhook } = await import("../../convex/functions/subscriptions");
    const ctx = makeCtx();
    const result = await webhook.handler(ctx as never, {
      eventType: "invoice.paid",
      payload: { data: {} },
    }) as Record<string, unknown>;

    expect(result.received).toBe(true);
    expect(result.localTest).toBe(true);
  });

  it("returns localTest true with sk_test_ key and STRIPE_LOCAL_MOCK=1", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_abc123");
    vi.stubEnv("STRIPE_LOCAL_MOCK", "1");

    const { webhook } = await import("../../convex/functions/subscriptions");
    const ctx = makeCtx();
    const result = await webhook.handler(ctx as never, {
      eventType: "invoice.paid",
      payload: { data: {} },
    }) as Record<string, unknown>;

    expect(result.received).toBe(true);
    expect(result.localTest).toBe(true);
  });

  it("returns received without localTest flag with production key", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_live_abc123");
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_testkey");

    const { webhook } = await import("../../convex/functions/subscriptions");
    const ctx = makeCtx();

    // Build a real HMAC-SHA256 signature for the payload
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      enc.encode("whsec_testkey"),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const payloadStr = JSON.stringify({ type: "customer.subscription.created", data: {} });
    const signedPayload = `${new Date().toISOString().slice(0, 19)}.${payloadStr}`;
    const sig = await crypto.subtle.sign("HMAC", key, enc.encode(signedPayload));
    const hex = Array.from(new Uint8Array(sig))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    const ts = new Date().toISOString().slice(0, 19);
    const signature = `t=${ts},v1=${hex}`;

    const result = await webhook.handler(ctx as never, {
      eventType: "customer.subscription.created",
      payload: payloadStr,
      signature,
      timestamp: ts,
    }) as Record<string, unknown>;

    expect(result.received).toBe(true);
    expect(result.localTest).toBeUndefined();
  });
});

describe("subscriptions:cancel", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.unstubAllEnvs();
    vi.stubEnv("STRIPE_SECRET_KEY", undefined);
    assertOrgWriteAccess.mockResolvedValue(undefined);
  });

  it("cancels an existing subscription by patching status and plan", async () => {
    requireAuthenticatedOrg.mockResolvedValue({ userId: "user_1", orgId: "org_1" });

    const existing = [{
      _id: "sub_1",
      orgId: "org_1",
      plan: "pro",
      status: "active",
      createdAt: 1000,
      updatedAt: 1000,
    }];

    const { cancel } = await import("../../convex/functions/subscriptions");
    const ctx = makeCtx({ subscriptions: existing });
    const result = await cancel.handler(ctx as never, {}) as Record<string, unknown>;

    expect(result.success).toBe(true);
    expect(ctx._patchCalls).toHaveLength(1);
    expect(ctx._patchCalls[0].data.status).toBe("canceled");
    expect(ctx._patchCalls[0].data.plan).toBe("free");
  });

  it("returns success even if no subscription exists", async () => {
    requireAuthenticatedOrg.mockResolvedValue({ userId: "user_1", orgId: "org_1" });

    const { cancel } = await import("../../convex/functions/subscriptions");
    const ctx = makeCtx({ subscriptions: [] });
    const result = await cancel.handler(ctx as never, {}) as Record<string, unknown>;

    expect(result.success).toBe(true);
    expect(ctx._patchCalls).toHaveLength(0);
  });

  it("throws when user lacks write access to org", async () => {
    requireAuthenticatedOrg.mockResolvedValue({ userId: "user_1", orgId: "org_1" });
    assertOrgWriteAccess.mockRejectedValue(new Error("Access denied"));

    const { cancel } = await import("../../convex/functions/subscriptions");
    const ctx = makeCtx();
    await expect(cancel.handler(ctx as never, {})).rejects.toThrow("Access denied");
  });

  it("throws when unauthenticated", async () => {
    requireAuthenticatedOrg.mockRejectedValue(new Error("Unauthenticated"));

    const { cancel } = await import("../../convex/functions/subscriptions");
    const ctx = makeCtx();
    await expect(cancel.handler(ctx as never, {})).rejects.toThrow("Unauthenticated");
  });
});

describe("subscriptions:ensureSubscription", () => {
  it("creates a free/inactive subscription when none exists", async () => {
    const { ensureSubscription } = await import("../../convex/functions/subscriptions");
    const ctx = makeCtx({ subscriptions: [] });
    await ensureSubscription.handler(ctx as never, { orgId: "org_99" });

    expect(ctx._insertCalls).toHaveLength(1);
    const insertCall = ctx._insertCalls[0];
    expect(insertCall.table).toBe("subscriptions");
    expect(insertCall.data.orgId).toBe("org_99");
    expect(insertCall.data.plan).toBe("free");
    expect(insertCall.data.status).toBe("inactive");
  });

  it("does not insert when subscription already exists", async () => {
    const existing = [{
      _id: "sub_1",
      orgId: "org_99",
      plan: "pro",
      status: "active",
      createdAt: 1000,
      updatedAt: 1000,
    }];

    const { ensureSubscription } = await import("../../convex/functions/subscriptions");
    const ctx = makeCtx({ subscriptions: existing });
    await ensureSubscription.handler(ctx as never, { orgId: "org_99" });

    expect(ctx._insertCalls).toHaveLength(0);
  });
});