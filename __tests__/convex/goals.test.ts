import { describe, it, expect, vi, beforeEach } from "vitest";

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
  internalAction: (config: { handler: (ctx: unknown, args: unknown) => Promise<unknown> }) => ({
    ...config,
    handler: config.handler.bind(config),
  }),
}));

vi.mock("convex/values", () => ({
  v: {
    string: () => ({ _isValidator: true }),
    number: () => ({ _isValidator: true }),
    boolean: () => ({ _isValidator: true }),
    union: () => ({ _isValidator: true }),
    literal: () => ({ _isValidator: true }),
    optional: () => ({ _isValidator: true }),
    id: () => ({ _isValidator: true }),
    object: () => ({ _isValidator: true }),
    array: () => ({ _isValidator: true }),
  },
}));

vi.mock("../../convex/auth", () => ({
  requireAuthenticatedOrg: vi.fn(),
}));

vi.mock("../../convex/functions/permissions", () => ({
  assertOrgWriteAccess: vi.fn(),
}));

vi.mock("../../convex/_generated/api", () => ({
  internal: {
    functions: {
      goals: {
        sendGoalAlert: "goals.sendGoalAlert",
        updateProgress: "goals.updateProgress",
        checkVariance: "goals.checkVariance",
        listOrgs: "goals.listOrgs",
      },
      notifications: {
        createInternal: "notifications.createInternal",
      },
    },
  },
}));

const auth = await import("../../convex/auth");
const permissions = await import("../../convex/functions/permissions");
const goals = await import("../../convex/functions/goals");

const requireAuthenticatedOrg = auth.requireAuthenticatedOrg as unknown as ReturnType<typeof vi.fn>;
const assertOrgWriteAccess = permissions.assertOrgWriteAccess as unknown as ReturnType<typeof vi.fn>;

function makeCtx() {
  const collect = vi.fn().mockResolvedValue([]);
  const first = vi.fn().mockResolvedValue(null);
  const withIndex = vi.fn().mockReturnValue({
    order: vi.fn().mockReturnValue({ collect }),
    collect,
    first,
  });
  const query = vi.fn().mockReturnValue({ withIndex });
  const runMutation = vi.fn().mockResolvedValue({ updated: 0 });
  return {
    db: {
      insert: vi.fn().mockResolvedValue("goal-new"),
      get: vi.fn().mockResolvedValue(null),
      patch: vi.fn().mockResolvedValue(undefined),
      query,
    },
    runMutation,
    runQuery: vi.fn().mockResolvedValue([]),
    scheduler: { runAfter: vi.fn().mockResolvedValue(undefined) },
    _collect: collect,
    _first: first,
    _withIndex: withIndex,
    _query: query,
  };
}

const validArgs = {
  name: "Emergency Fund",
  type: "savings_target" as const,
  targetAmount: 1000,
  currentAmount: 250,
};

describe("goals: create", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAuthenticatedOrg.mockResolvedValue({ userId: "user-1", orgId: "org-1" });
    assertOrgWriteAccess.mockResolvedValue(undefined);
  });

  it("rejects an empty name", async () => {
    const ctx = makeCtx();
    await expect(
      goals.create.handler(ctx, { ...validArgs, name: "   " }),
    ).rejects.toThrow("Goal name must be 1-200 characters");
  });

  it("rejects a name longer than 200 characters", async () => {
    const ctx = makeCtx();
    await expect(
      goals.create.handler(ctx, { ...validArgs, name: "a".repeat(201) }),
    ).rejects.toThrow("Goal name must be 1-200 characters");
  });

  it("rejects a non-positive target amount", async () => {
    const ctx = makeCtx();
    await expect(
      goals.create.handler(ctx, { ...validArgs, targetAmount: 0 }),
    ).rejects.toThrow("Target amount must be a positive number");
  });

  it("rejects a negative current amount", async () => {
    const ctx = makeCtx();
    await expect(
      goals.create.handler(ctx, { ...validArgs, currentAmount: -1 }),
    ).rejects.toThrow("Current amount must be a non-negative number");
  });

  it("rejects an out-of-range alert threshold", async () => {
    const ctx = makeCtx();
    await expect(
      goals.create.handler(ctx, { ...validArgs, alertAtPercent: 0 }),
    ).rejects.toThrow("alertAtPercent must be between 1 and 99");
    await expect(
      goals.create.handler(ctx, { ...validArgs, alertAtPercent: 100 }),
    ).rejects.toThrow("alertAtPercent must be between 1 and 99");
  });

  it("rejects a category that does not belong to the organisation", async () => {
    const ctx = makeCtx();
    ctx.db.get.mockResolvedValueOnce({ _id: "cat-1", orgId: "other-org" });
    await expect(
      goals.create.handler(ctx, { ...validArgs, categoryId: "cat-1" }),
    ).rejects.toThrow("Category not found in this organisation");
  });

  it("inserts a goal with computed progress and variance", async () => {
    const ctx = makeCtx();
    const result = await goals.create.handler(ctx, { ...validArgs, targetAmount: 1000, currentAmount: 250 });
    expect(result).toBe("goal-new");

    const inserted = ctx.db.insert.mock.calls[0][1] as Record<string, unknown>;
    expect(inserted.orgId).toBe("org-1");
    expect(inserted.userId).toBe("user-1");
    expect(inserted.name).toBe("Emergency Fund");
    expect(inserted.progressPercent).toBe(25);
    expect(inserted.varianceAmount).toBe(-750);
    expect(inserted.status).toBe("active");
    expect(inserted.alertSent).toBe(false);
    expect(inserted.periodStart).toBeTypeOf("number");
  });

  it("accepts a category from the same organisation", async () => {
    const ctx = makeCtx();
    ctx.db.get.mockResolvedValueOnce({ _id: "cat-1", orgId: "org-1" });
    await expect(
      goals.create.handler(ctx, { ...validArgs, categoryId: "cat-1" }),
    ).resolves.toBe("goal-new");
  });
});

describe("goals: update", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAuthenticatedOrg.mockResolvedValue({ userId: "user-1", orgId: "org-1" });
    assertOrgWriteAccess.mockResolvedValue(undefined);
  });

  const existingGoal = {
    _id: "goal-1",
    orgId: "org-1",
    userId: "user-1",
    name: "Vacation",
    type: "savings_target" as const,
    targetAmount: 2000,
    currentAmount: 500,
    progressPercent: 25,
    varianceAmount: -1500,
    variancePercent: -75,
    status: "active" as const,
    alertAtPercent: 80,
    alertSent: false,
    createdAt: 1,
    updatedAt: 1,
  };

  it("rejects when the goal is not found", async () => {
    const ctx = makeCtx();
    ctx.db.get.mockResolvedValueOnce(null);
    await expect(
      goals.update.handler(ctx, { goalId: "goal-1", name: "New" }),
    ).rejects.toThrow("Goal not found in this organisation");
  });

  it("rejects when the goal belongs to another organisation", async () => {
    const ctx = makeCtx();
    ctx.db.get.mockResolvedValueOnce({ ...existingGoal, orgId: "other-org" });
    await expect(
      goals.update.handler(ctx, { goalId: "goal-1", name: "New" }),
    ).rejects.toThrow("Goal not found in this organisation");
  });

  it("allows a second household member to update when org write access is granted", async () => {
    const ctx = makeCtx();
    ctx.db.get.mockResolvedValueOnce({ ...existingGoal, userId: "someone-else" });
    const result = await goals.update.handler(ctx, { goalId: "goal-1", name: "New" });
    expect(result).toEqual({ id: "goal-1" });
  });

  it("recomputes progress and variance on update", async () => {
    const ctx = makeCtx();
    ctx.db.get.mockResolvedValueOnce(existingGoal);
    const result = await goals.update.handler(ctx, { goalId: "goal-1", currentAmount: 1000 });
    expect(result).toEqual({ id: "goal-1" });

    const patch = ctx.db.patch.mock.calls[0][1] as Record<string, unknown>;
    expect(patch.currentAmount).toBe(1000);
    expect(patch.progressPercent).toBe(50);
    expect(patch.varianceAmount).toBe(-1000);
    expect(patch.status).toBe("active");
  });
});

describe("goals: remove", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAuthenticatedOrg.mockResolvedValue({ userId: "user-1", orgId: "org-1" });
    assertOrgWriteAccess.mockResolvedValue(undefined);
  });

  it("archives the goal by setting status to paused", async () => {
    const ctx = makeCtx();
    ctx.db.get.mockResolvedValueOnce({
      _id: "goal-1",
      orgId: "org-1",
      userId: "user-1",
      name: "Monthly Budget",
      type: "monthly_spending_limit",
      targetAmount: 2000,
      currentAmount: 500,
      progressPercent: 25,
      varianceAmount: -1500,
      variancePercent: -75,
      status: "active" as const,
      alertAtPercent: 80,
      alertSent: false,
      createdAt: 1,
      updatedAt: 1,
    });
    const result = await goals.remove.handler(ctx, { goalId: "goal-1" });
    expect(result).toEqual({ id: "goal-1", archived: true });
    expect(ctx.db.patch).toHaveBeenCalledWith("goal-1", expect.objectContaining({ status: "paused" }));
  });

  it("allows a second household member to delete when org write access is granted", async () => {
    const ctx = makeCtx();
    ctx.db.get.mockResolvedValueOnce({
      _id: "goal-1",
      orgId: "org-1",
      userId: "someone-else",
      status: "active",
    });
    const result = await goals.remove.handler(ctx, { goalId: "goal-1" });
    expect(result).toEqual({ id: "goal-1", archived: true });
    expect(ctx.db.patch).toHaveBeenCalledWith("goal-1", expect.objectContaining({ status: "paused" }));
  });
});

describe("goals: list", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAuthenticatedOrg.mockResolvedValue({ userId: "user-1", orgId: "org-1" });
  });

  it("returns all goals when no status filter is provided", async () => {
    const ctx = makeCtx();
    ctx._collect.mockResolvedValueOnce([
      { _id: "g1", orgId: "org-1", status: "active", progressPercent: 50 },
      { _id: "g2", orgId: "org-1", status: "achieved", progressPercent: 100 },
    ]);
    const result = (await goals.list.handler(ctx, {})) as Array<{ _id: string }>;
    expect(result).toHaveLength(2);
  });

  it("filters goals by status", async () => {
    const ctx = makeCtx();
    ctx._collect.mockResolvedValueOnce([
      { _id: "g1", orgId: "org-1", status: "active", progressPercent: 50 },
      { _id: "g2", orgId: "org-1", status: "achieved", progressPercent: 100 },
    ]);
    const result = (await goals.list.handler(ctx, { status: "achieved" })) as Array<{ _id: string }>;
    expect(result).toHaveLength(1);
    expect(result[0]._id).toBe("g2");
  });
});

describe("goals: status derivation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAuthenticatedOrg.mockResolvedValue({ userId: "user-1", orgId: "org-1" });
    assertOrgWriteAccess.mockResolvedValue(undefined);
  });

  it("derives achieved status on create when a savings goal already meets its target", async () => {
    const ctx = makeCtx();
    await goals.create.handler(ctx, {
      name: "Emergency Fund",
      type: "savings_target",
      targetAmount: 500,
      currentAmount: 500,
    });
    const inserted = ctx.db.insert.mock.calls[0][1] as Record<string, unknown>;
    expect(inserted.status).toBe("achieved");
  });

  it("derives over_budget on create for a spending limit already exceeded", async () => {
    const ctx = makeCtx();
    await goals.create.handler(ctx, {
      name: "Monthly Budget",
      type: "monthly_spending_limit",
      targetAmount: 1000,
      currentAmount: 1000,
    });
    const inserted = ctx.db.insert.mock.calls[0][1] as Record<string, unknown>;
    expect(inserted.status).toBe("over_budget");
  });

  it("recomputes status to over_budget when an update pushes progress past the target", async () => {
    const ctx = makeCtx();
    ctx.db.get.mockResolvedValueOnce({
      _id: "goal-1",
      orgId: "org-1",
      userId: "user-1",
      name: "Monthly Budget",
      type: "monthly_spending_limit",
      targetAmount: 1000,
      currentAmount: 100,
      progressPercent: 10,
      varianceAmount: -900,
      variancePercent: -90,
      status: "active" as const,
      alertAtPercent: 80,
      alertSent: false,
      createdAt: 1,
      updatedAt: 1,
    });
    await goals.update.handler(ctx, { goalId: "goal-1", currentAmount: 1100 });
    const patch = ctx.db.patch.mock.calls[0][1] as Record<string, unknown>;
    expect(patch.status).toBe("over_budget");
  });
});

describe("goals: updateProgress", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("recomputes progress and variance for active goals", async () => {
    const ctx = makeCtx();
    ctx._collect.mockResolvedValueOnce([
      {
        _id: "goal-1",
        orgId: "org-1",
        userId: "user-1",
        name: "Vacation",
        type: "savings_target",
        targetAmount: 1000,
        currentAmount: 500,
        progressPercent: 50,
        varianceAmount: -500,
        variancePercent: -50,
        status: "active",
        alertAtPercent: 80,
        alertSent: false,
      },
    ]);
    const result = await goals.updateProgress.handler(ctx, { orgId: "org-1" });
    expect(result).toEqual({ updated: 1 });
    expect(ctx.db.patch).toHaveBeenCalledTimes(1);
  });

  it("does not update paused goals", async () => {
    const ctx = makeCtx();
    ctx._collect.mockResolvedValueOnce([
      {
        _id: "goal-1",
        orgId: "org-1",
        userId: "user-1",
        name: "Vacation",
        type: "savings_target",
        targetAmount: 1000,
        currentAmount: 500,
        progressPercent: 50,
        varianceAmount: -500,
        variancePercent: -50,
        status: "paused",
        alertAtPercent: 80,
        alertSent: false,
      },
    ]);
    const result = await goals.updateProgress.handler(ctx, { orgId: "org-1" });
    expect(result).toEqual({ updated: 0 });
    expect(ctx.db.patch).not.toHaveBeenCalled();
  });
});

describe("goals: sendGoalAlert", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sends a goal alert and marks the goal as alerted", async () => {
    const ctx = makeCtx();
    ctx.db.get.mockResolvedValueOnce({
      _id: "goal-1",
      orgId: "org-1",
      userId: "user-1",
      name: "Vacation",
      type: "savings_target",
      targetAmount: 1000,
      currentAmount: 1000,
      progressPercent: 100,
      status: "achieved",
    });
    const result = await goals.sendGoalAlert.handler(ctx, { goalId: "goal-1" });
    expect(result).toEqual({ sent: true });
    const notificationArgs = ctx.runMutation.mock.calls[0][1] as Record<string, unknown>;
    expect(notificationArgs.type).toBe("goal_alert");
    expect(ctx.db.patch).toHaveBeenCalledWith("goal-1", { alertSent: true });
  });

  it("returns sent:false for a missing goal", async () => {
    const ctx = makeCtx();
    ctx.db.get.mockResolvedValueOnce(null);
    const result = await goals.sendGoalAlert.handler(ctx, { goalId: "goal-missing" });
    expect(result).toEqual({ sent: false });
    expect(ctx.runMutation).not.toHaveBeenCalled();
  });
});
