import { describe, it, expect, vi, beforeEach } from "vitest";

const { requireAuthenticatedOrg } = vi.hoisted(() => ({
  requireAuthenticatedOrg: vi.fn(),
}));

vi.mock("../../convex/_generated/server", () => ({
  mutationGeneric: (config: { handler: (ctx: unknown, args: unknown) => Promise<unknown> }) => ({
    ...config,
    handler: config.handler.bind(config),
  }),
  queryGeneric: (config: { handler: (ctx: unknown, args: unknown) => Promise<unknown> }) => ({
    ...config,
    handler: config.handler.bind(config),
  }),
  action: (config: { handler: (ctx: unknown, args: unknown) => Promise<unknown> }) => ({
    ...config,
    handler: config.handler.bind(config),
  }),
  mutation: (config: { handler: (ctx: unknown, args: unknown) => Promise<unknown> }) => ({
    ...config,
    handler: config.handler.bind(config),
  }),
  query: (config: { handler: (ctx: unknown, args: unknown) => Promise<unknown> }) => ({
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
    optional: () => ({ _isValidator: true }),
    id: () => ({ _isValidator: true }),
  },
}));

vi.mock("../../convex/auth", () => ({
  requireAuthenticatedOrg,
}));

interface IndexQueryBuilder {
  field: (name: string) => unknown;
  eq: (field: string, value: unknown) => IndexQueryBuilder;
  neq: (field: string, value: unknown) => IndexQueryBuilder;
}

interface FilterQueryBuilder {
  field: (name: string) => string;
  eq: (field: string, value: unknown) => boolean;
  neq: (field: string, value: unknown) => boolean;
  or: (...predicates: boolean[]) => boolean;
  and: (...predicates: boolean[]) => boolean;
}

function createFilterBuilder(doc: Record<string, unknown>): FilterQueryBuilder {
  return {
    field: (name: string) => name,
    eq: (field: string, value: unknown) => (doc[field] === value),
    neq: (field: string, value: unknown) => (doc[field] !== value),
    or: (...predicates: boolean[]) => predicates.some(Boolean),
    and: (...predicates: boolean[]) => predicates.every(Boolean),
  };
}

interface QueryChain {
  withIndex: (name: string, fn?: (q: IndexQueryBuilder) => IndexQueryBuilder) => QueryChain;
  filter: (fn: (q: FilterQueryBuilder) => boolean) => QueryChain;
  order: (direction: string) => QueryChain;
  collect: () => unknown[];
  first: () => unknown | null;
  unique: () => unknown | null;
  get: () => Promise<unknown | null>;
}

function createQueryChain(results: unknown[] = []): QueryChain {
  let filtered = results.slice();
  const chainable: QueryChain = {
    withIndex: (_name: string, fn?: (q: IndexQueryBuilder) => IndexQueryBuilder) => {
      if (fn) {
        const { builder, constraints } = createIndexBuilder();
        fn(builder);
        if (constraints.length > 0) {
          filtered = filtered.filter((doc) =>
            constraints.every((c) => (doc as Record<string, unknown>)[c.field] === c.value)
          );
        }
      }
      return chainable;
    },
    filter: (fn: (q: FilterQueryBuilder) => boolean) => {
      filtered = filtered.filter((doc) =>
        fn(createFilterBuilder(doc as Record<string, unknown>))
      );
      return chainable;
    },
    order: (_direction: string) => chainable,
    collect: () => filtered,
    first: () => filtered[0] || null,
    unique: () => filtered[0] || null,
    get: () => Promise.resolve(filtered[0] || null),
  };
  return chainable;
}

function createIndexBuilder(): { builder: IndexQueryBuilder; constraints: Array<{ field: string; value: unknown }> } {
  const constraints: Array<{ field: string; value: unknown }> = [];
  const builder: IndexQueryBuilder = {
    field: (name: string) => name,
    eq: (field: string, value: unknown) => {
      constraints.push({ field, value });
      return builder;
    },
    neq: () => builder,
  };
  return { builder, constraints };
}

function createMockCtx(
  user: { subject: string; org_id: string } | null,
  options?: { expenses?: unknown[] },
) {
  return {
    auth: {
      getUserIdentity: () => Promise.resolve(user),
    },
    db: {
      query: () => createQueryChain(options?.expenses || []),
      get: () => Promise.resolve(null),
      patch: () => Promise.resolve(),
      insert: () => Promise.resolve("mock_id"),
    },
  };
}

function validIdentity() {
  return { subject: "user_1", org_id: "org_1" };
}

describe("duplicateDetection.hammingDistance", () => {
  it("returns 0 for identical hashes", async () => {
    const { hammingDistance } = await import("../../convex/functions/duplicateDetection");
    expect(hammingDistance("abcdef", "abcdef")).toBe(0);
  });

  it("returns count of differing bits for different hashes", async () => {
    const { hammingDistance } = await import("../../convex/functions/duplicateDetection");
    expect(hammingDistance("abcdef", "abceef")).toBe(1);
  });

  it("returns correct distance for completely different hashes", async () => {
    const { hammingDistance } = await import("../../convex/functions/duplicateDetection");
    expect(hammingDistance("0000", "ffff")).toBe(4);
  });

  it("handles different length hashes by comparing to max length", async () => {
    const { hammingDistance } = await import("../../convex/functions/duplicateDetection");
    expect(hammingDistance("abc", "abcdef")).toBe(3);
  });
});

describe("duplicateDetection.runDuplicateCheck", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    requireAuthenticatedOrg.mockResolvedValue({ userId: "user_1", orgId: "org_1" });
  });

  it("returns no matches when no receipt data provided", async () => {
    const { runDuplicateCheck } = await import("../../convex/functions/duplicateDetection");
    const ctx = createMockCtx(validIdentity(), { expenses: [] });
    const result = await runDuplicateCheck(ctx as never, {
      orgId: "org_1",
    });
    expect(result.isDuplicate).toBe(false);
    expect(result.matches).toHaveLength(0);
  });

  it("returns no matches when expenses array is empty", async () => {
    const { runDuplicateCheck } = await import("../../convex/functions/duplicateDetection");
    const ctx = createMockCtx(validIdentity(), { expenses: [] });
    const result = await runDuplicateCheck(ctx as never, {
      orgId: "org_1",
      receiptPHash: "a1b2c3d4e5f6a7b8",
    });
    expect(result.isDuplicate).toBe(false);
    expect(result.matches).toHaveLength(0);
  });

  it("detects fingerprint exact match", async () => {
    const { runDuplicateCheck } = await import("../../convex/functions/duplicateDetection");
    const existing = [{
      _id: "exp1",
      orgId: "org_1",
      receiptFingerprint: "Walmart|2024-01-01|45.99",
      receiptPHash: undefined,
      notes: "Test receipt",
      date: "2024-01-01",
      amount: 45.99,
      status: "approved",
    }];
    const ctx = createMockCtx(validIdentity(), { expenses: existing });
    const result = await runDuplicateCheck(ctx as never, {
      orgId: "org_1",
      receiptFingerprint: "Walmart|2024-01-01|45.99",
    });
    expect(result.isDuplicate).toBe(true);
    expect(result.matches).toHaveLength(1);
    expect(result.matches[0].id).toBe("exp1");
  });

  it("detects dHash match within Hamming threshold (≤10)", async () => {
    const { runDuplicateCheck, hammingDistance } = await import("../../convex/functions/duplicateDetection");
    const existing = [{
      _id: "exp1",
      orgId: "org_1",
      receiptPHash: "a1b2c3d4e5f6a7b8",
      receiptFingerprint: undefined,
      notes: "Test",
      date: "2024-01-01",
      amount: 45.99,
      status: "approved",
    }];
    const ctx = createMockCtx(validIdentity(), { expenses: existing });

    const newHash = "a1b2c3d4e5f6a7b9";
    expect(hammingDistance("a1b2c3d4e5f6a7b8", newHash)).toBe(1);

    const result = await runDuplicateCheck(ctx as never, {
      orgId: "org_1",
      receiptPHash: newHash,
    });
    expect(result.isDuplicate).toBe(true);
    expect(result.matches).toHaveLength(1);
  });

  it("does not match dHash beyond Hamming threshold (>10)", async () => {
    const { runDuplicateCheck, hammingDistance } = await import("../../convex/functions/duplicateDetection");
    const existing = [{
      _id: "exp1",
      orgId: "org_1",
      receiptPHash: "0000000000000000",
      receiptFingerprint: undefined,
      notes: "Test",
      date: "2024-01-01",
      amount: 45.99,
      status: "approved",
    }];
    const ctx = createMockCtx(validIdentity(), { expenses: existing });

    const newHash = "ffffffffffffffff";
    expect(hammingDistance("0000000000000000", newHash)).toBe(16);

    const result = await runDuplicateCheck(ctx as never, {
      orgId: "org_1",
      receiptPHash: newHash,
    });
    expect(result.isDuplicate).toBe(false);
  });

  it("detects near-duplicate by date and amount (±0.01)", async () => {
    const { runDuplicateCheck } = await import("../../convex/functions/duplicateDetection");
    const existing = [{
      _id: "exp1",
      orgId: "org_1",
      receiptPHash: undefined,
      receiptFingerprint: undefined,
      notes: "Test",
      date: "2024-01-01",
      amount: 45.99,
      status: "approved",
    }];
    const ctx = createMockCtx(validIdentity(), { expenses: existing });
    const result = await runDuplicateCheck(ctx as never, {
      orgId: "org_1",
      amount: 45.99,
      date: "2024-01-01",
    });
    expect(result.isDuplicate).toBe(true);
    expect(result.matches).toHaveLength(1);
  });

  it("does not flag near-duplicate when amount differs by more than 0.01", async () => {
    const { runDuplicateCheck } = await import("../../convex/functions/duplicateDetection");
    const existing = [{
      _id: "exp1",
      orgId: "org_1",
      receiptPHash: undefined,
      receiptFingerprint: undefined,
      notes: "Test",
      date: "2024-01-01",
      amount: 45.99,
      status: "approved",
    }];
    const ctx = createMockCtx(validIdentity(), { expenses: existing });
    const result = await runDuplicateCheck(ctx as never, {
      orgId: "org_1",
      amount: 50.00,
      date: "2024-01-01",
    });
    expect(result.isDuplicate).toBe(false);
  });

  it("deduplication: does not double-count expense matched by both dHash and near-duplicate", async () => {
    const { runDuplicateCheck } = await import("../../convex/functions/duplicateDetection");
    const existing = [{
      _id: "exp1",
      orgId: "org_1",
      receiptPHash: "a1b2c3d4e5f6a7b8",
      receiptFingerprint: undefined,
      notes: "Test",
      date: "2024-01-01",
      amount: 45.99,
      status: "approved",
    }];
    const ctx = createMockCtx(validIdentity(), { expenses: existing });
    const result = await runDuplicateCheck(ctx as never, {
      orgId: "org_1",
      receiptPHash: "a1b2c3d4e5f6a7b9",
      amount: 45.99,
      date: "2024-01-01",
    });
    expect(result.isDuplicate).toBe(true);
    expect(result.matches).toHaveLength(1);
    expect(result.matches[0].id).toBe("exp1");
  });

  it("scopes duplicate check by orgId only", async () => {
    const { runDuplicateCheck } = await import("../../convex/functions/duplicateDetection");
    const existing = [{
      _id: "exp1",
      orgId: "org_1",
      receiptPHash: "a1b2c3d4e5f6a7b8",
      receiptFingerprint: undefined,
      notes: "Test",
      date: "2024-01-01",
      amount: 45.99,
      status: "approved",
    }];
    const ctx = createMockCtx(validIdentity(), { expenses: existing });
    const result = await runDuplicateCheck(ctx as never, {
      orgId: "org_other",
      receiptPHash: "a1b2c3d4e5f6a7b8",
    });
    expect(result.isDuplicate).toBe(false);
  });

  it("excludes soft-deleted expenses from duplicate check (SEC-002)", async () => {
    const { runDuplicateCheck } = await import("../../convex/functions/duplicateDetection");
    const existing = [
      {
        _id: "exp1",
        orgId: "org_1",
        receiptPHash: "a1b2c3d4e5f6a7b8",
        receiptFingerprint: undefined,
        notes: "Test",
        date: "2024-01-01",
        amount: 45.99,
        status: "approved",
        deletedAt: Date.now(),
      },
    ];
    const ctx = createMockCtx(validIdentity(), { expenses: existing });
    const result = await runDuplicateCheck(ctx as never, {
      orgId: "org_1",
      receiptPHash: "a1b2c3d4e5f6a7b8",
    });
    expect(result.isDuplicate).toBe(false);
  });

  // SEC-005: Finding — duplicate detection query could return cross-org matches if withIndex orgId scoping is bypassed
  it("ST-D5-001: DUP-Q1 — runDuplicateCheck returns only same-org matches with identical dHash in two orgs (DUP-Q1)", async () => {
    const { runDuplicateCheck } = await import("../../convex/functions/duplicateDetection");
    const existing = [
      {
        _id: "exp_org1",
        orgId: "org_1",
        receiptPHash: "a1b2c3d4e5f6a7b8",
        receiptFingerprint: undefined,
        notes: "Org 1 receipt",
        date: "2024-01-01",
        amount: 45.99,
        status: "approved",
      },
      {
        _id: "exp_org2",
        orgId: "org_2",
        receiptPHash: "a1b2c3d4e5f6a7b8",
        receiptFingerprint: undefined,
        notes: "Org 2 same hash",
        date: "2024-01-01",
        amount: 45.99,
        status: "approved",
      },
    ];
    const ctx = createMockCtx(validIdentity(), { expenses: existing });
    const result = await runDuplicateCheck(ctx as never, {
      orgId: "org_1",
      receiptPHash: "a1b2c3d4e5f6a7b8",
    });
    expect(result.isDuplicate).toBe(true);
    expect(result.matches).toHaveLength(1);
    expect(result.matches[0].id).toBe("exp_org1");
    expect(result.matches.some((m) => m.id === "exp_org2")).toBe(false);
  });

  // SEC-002: Finding — soft-deleted expenses with matching fingerprint still queried and matched if deletedAt filter fails
  it("ST-D5-002: SEC-002 — soft-deleted expense excluded from fingerprint exact match (SEC-002)", async () => {
    const { runDuplicateCheck } = await import("../../convex/functions/duplicateDetection");
    const existing = [
      {
        _id: "exp1",
        orgId: "org_1",
        receiptFingerprint: "Walmart|2024-01-01|45.99",
        receiptPHash: undefined,
        notes: "Test receipt",
        date: "2024-01-01",
        amount: 45.99,
        status: "approved",
        deletedAt: Date.now(),
      },
    ];
    const ctx = createMockCtx(validIdentity(), { expenses: existing });
    const result = await runDuplicateCheck(ctx as never, {
      orgId: "org_1",
      receiptFingerprint: "Walmart|2024-01-01|45.99",
    });
    expect(result.isDuplicate).toBe(false);
    expect(result.matches).toHaveLength(0);
  });

  // SEC-002: Finding — soft-deleted expenses with matching date+amount still queried and matched if deletedAt filter fails
  it("ST-D5-003: SEC-002 — soft-deleted expense excluded from near-duplicate date+amount match (SEC-002)", async () => {
    const { runDuplicateCheck } = await import("../../convex/functions/duplicateDetection");
    const existing = [
      {
        _id: "exp1",
        orgId: "org_1",
        receiptPHash: undefined,
        receiptFingerprint: undefined,
        notes: "Test",
        date: "2024-01-01",
        amount: 45.99,
        status: "approved",
        deletedAt: Date.now(),
      },
    ];
    const ctx = createMockCtx(validIdentity(), { expenses: existing });
    const result = await runDuplicateCheck(ctx as never, {
      orgId: "org_1",
      amount: 45.99,
      date: "2024-01-01",
    });
    expect(result.isDuplicate).toBe(false);
    expect(result.matches).toHaveLength(0);
  });
});
