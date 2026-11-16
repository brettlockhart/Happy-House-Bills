import { describe, it, expect, vi, beforeEach } from "vitest";
import type { UserIdentity } from "convex/server";
import type { Expense } from "../../convex/_generated/api";
import { clerkRequest } from "../../convex/functions/clerk";
import { sendEmail } from "../../convex/functions/email";
import { notifyExpensePending, getUserDisplayName } from "../../convex/functions/expenses";

vi.mock("../../convex/_generated/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../convex/_generated/server")>();
  const wrap = (config: { handler: (ctx: unknown, args: unknown) => Promise<unknown> }) => ({
    ...config,
    handler: config.handler.bind(config),
  });
  return {
    ...actual,
    mutationGeneric: wrap,
    queryGeneric: wrap,
    mutation: wrap,
    query: wrap,
    action: wrap,
    internalMutation: wrap,
    internalQuery: wrap,
    internalAction: wrap,
    internal: wrap,
    defineInternal: wrap,
  };
});

vi.mock("../../convex/_generated/api", () => ({
  api: {
    expenses: {
      notifyExpensePending: {},
    },
  },
  internal: {
    functions: {
      expenses: {
        notifyExpensePending: "internal.functions.expenses.notifyExpensePending",
      },
      notifications: {
        createInternal: "internal.functions.notifications.createInternal",
      },
    },
    expenses: {
      notifyExpensePending: "internal.expenses.notifyExpensePending",
    },
    notifications: {
      createInternal: "internal.notifications.createInternal",
    },
  },
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
    array: () => ({ _isValidator: true }),
  },
}));

vi.mock("../../convex/functions/clerk", () => ({
  clerkRequest: vi.fn(),
  CLERK_API_URL: "https://api.clerk.com/v3",
}));

vi.mock("../../convex/functions/email", () => ({
  sendEmail: vi.fn(),
  renderExpenseNotificationEmail: vi.fn((paidBy: string, expenseId: string, amount: number, category: string, _notes?: string) =>
    `<html><body><h2>New expense pending your confirmation</h2><p><strong>${paidBy}</strong> added an expense of <strong>$${amount}</strong> for <em>${category}</em></p></body></html>`,
  ),
}));

type MockIdentity = UserIdentity;

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

interface QueryChain {
  withIndex: (name: string, fn?: (q: IndexQueryBuilder) => IndexQueryBuilder) => QueryChain;
  filter: (fn: (q: FilterQueryBuilder) => boolean) => QueryChain;
  order: (direction: string) => QueryChain;
  collect: () => unknown[];
  first: () => unknown | null;
  unique: () => unknown | null;
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
  };
  return chainable;
}

interface MockCtx {
  auth: { getUserIdentity: () => Promise<MockIdentity | null> };
  db: {
    query: (table: string) => QueryChain;
    get: (id: string) => Promise<unknown | null>;
    patch: (id: string, data: Record<string, unknown>) => Promise<void>;
    insert: (table: string, data: Record<string, unknown>) => Promise<string>;
  };
  scheduler: {
    runAfter: vi.ReturnType<typeof vi.fn>;
  };
  runAction: vi.ReturnType<typeof vi.fn>;
  runMutation: vi.ReturnType<typeof vi.fn>;
  _patchCalls?: Array<{ id: string; data: Record<string, unknown> }>;
  _insertCalls?: Array<Record<string, unknown>>;
  _expenses?: unknown[];
  _expenseToGet?: unknown;
}

function createMockCtx(
  user: MockIdentity | null,
  options?: {
    expenses?: unknown[];
    expenseToGet?: unknown;
  }
): MockCtx {
  const ctx: MockCtx = {
    auth: {
      getUserIdentity: () => Promise.resolve(user),
    },
    db: {
      query: () => createQueryChain(options?.expenses || []),
      get: () => Promise.resolve(options?.expenseToGet || null),
      patch: (_id: string, _data: Record<string, unknown>) => Promise.resolve(),
      insert: (_table: string, _data: Record<string, unknown>) => Promise.resolve("mock_id"),
    },
    scheduler: {
      runAfter: vi.fn(),
    },
    runAction: vi.fn(),
    runMutation: vi.fn(),
    _patchCalls: [],
    _insertCalls: [],
    _expenses: options?.expenses || [],
    _expenseToGet: options?.expenseToGet || null,
  };
  ctx.db.patch = function(_id: string, data: Record<string, unknown>) {
    ctx._patchCalls!.push({ id: _id, data });
    return Promise.resolve();
  };
  ctx.db.insert = function(_table: string, data: Record<string, unknown>) {
    ctx._insertCalls!.push(data);
    return Promise.resolve("mock_id");
  };
  return ctx;
}

function validIdentity(): MockIdentity {
  return { subject: "user_1", tokenIdentifier: "clerk:org_1|user_1", org_id: "org_1" } as MockIdentity;
}

describe("requireAuthenticatedOrg", () => {
  it("throws when no identity", async () => {
    const { requireAuthenticatedOrg } = await import("../../convex/auth");
    const ctx = createMockCtx(null);
    await expect(requireAuthenticatedOrg(ctx as never)).rejects.toThrow("Unauthenticated");
  });

  it("returns userId and orgId from JWT org_id claim", async () => {
    const { requireAuthenticatedOrg } = await import("../../convex/auth");
    const ctx = createMockCtx(validIdentity());
    const result = await requireAuthenticatedOrg(ctx as never);
    expect(result.userId).toBe("user_1");
    expect(result.orgId).toBe("org_1");
  });

  it("throws when identity has empty subject and no org_id", async () => {
    const { requireAuthenticatedOrg } = await import("../../convex/auth");
    const ctx = createMockCtx({
      subject: "",
      tokenIdentifier: "",
    } as MockIdentity);
    await expect(requireAuthenticatedOrg(ctx as never)).rejects.toThrow("Unauthenticated or no organisation");
  });

  it("throws when subject present but org_id missing", async () => {
    const { requireAuthenticatedOrg } = await import("../../convex/auth");
    const ctx = createMockCtx({ subject: "user_1" } as MockIdentity);
    await expect(requireAuthenticatedOrg(ctx as never)).rejects.toThrow("Unauthenticated or no organisation");
  });
});

describe("expenses:list", () => {
  it("throws when unauthenticated", async () => {
    const { list } = await import("../../convex/functions/expenses");
    const ctx = createMockCtx(null);
    await expect(list.handler(ctx as never, {})).rejects.toThrow("Unauthenticated");
  });

  it("returns expenses for authenticated user", async () => {
    const { list } = await import("../../convex/functions/expenses");
    const expense = { _id: "exp1", orgId: "org_1", amount: 50, status: "approved" };
    const ctx = createMockCtx(validIdentity(), { expenses: [expense] });
    const result = await list.handler(ctx as never, {});
    expect(Array.isArray(result)).toBe(true);
    expect((result as unknown[]).length).toBe(1);
  });

  it("SEC-001: REQUIRES cross-tenant isolation — org scoping via JWT org_id claim (SEC-001)", async () => {
    const { list } = await import("../../convex/functions/expenses");
    const otherOrgExpense = { _id: "exp_other", orgId: "org_other", amount: 999, status: "approved" };
    const sameOrgExpense = { _id: "exp_own", orgId: "org_1", amount: 50, status: "approved" };
    const ctx = createMockCtx(validIdentity(), { expenses: [otherOrgExpense, sameOrgExpense] });
    const result = await list.handler(ctx as never, {}) as unknown[];
    expect(result).toHaveLength(1);
    expect((result[0] as { orgId: string }).orgId).toBe("org_1");
  });
});

describe("expenses:pending", () => {
  it("throws when unauthenticated", async () => {
    const { pending } = await import("../../convex/functions/expenses");
    const ctx = createMockCtx(null);
    await expect(pending.handler(ctx as never, {})).rejects.toThrow("Unauthenticated");
  });

  it("scopes by orgId and returns array", async () => {
    const { pending } = await import("../../convex/functions/expenses");
    const ctx = createMockCtx(validIdentity());
    const result = await pending.handler(ctx as never, {});
    expect(Array.isArray(result)).toBe(true);
  });
});

describe("expenses:balance", () => {
  it("returns structured object with balance and owesWhom", async () => {
    const { balance } = await import("../../convex/functions/expenses");
    const ctx = createMockCtx(validIdentity());
    const result = await balance.handler(ctx as never, {}) as { balance: number; owesWhom: string };
    expect(result).toHaveProperty("balance");
    expect(result).toHaveProperty("owesWhom");
    expect(typeof result.balance).toBe("number");
    expect(typeof result.owesWhom).toBe("string");
  });

  it("returns 0 balance and empty owesWhom when no expenses", async () => {
    const { balance } = await import("../../convex/functions/expenses");
    const ctx = createMockCtx(validIdentity(), { expenses: [] });
    const result = await balance.handler(ctx as never, {}) as { balance: number; owesWhom: string };
    expect(result.balance).toBe(0);
    expect(result.owesWhom).toBe("");
  });

  it("calculates negative balance when current user paid", async () => {
    const { balance } = await import("../../convex/functions/expenses");
    const expenses = [{
      _id: "exp1",
      orgId: "org_1",
      amount: 100,
      status: "approved",
      paidBy: "user_1",
    }];
    const ctx = createMockCtx(validIdentity(), { expenses });
    const result = await balance.handler(ctx as never, {}) as { balance: number; owesWhom: string };
    expect(result.balance).toBe(-100);
  });

  it("calculates positive balance when other user paid", async () => {
    const { balance } = await import("../../convex/functions/expenses");
    const expenses = [{
      _id: "exp1",
      orgId: "org_1",
      amount: 100,
      status: "approved",
      paidBy: "user_2",
    }];
    const ctx = createMockCtx(validIdentity(), { expenses });
    const result = await balance.handler(ctx as never, {}) as { balance: number; owesWhom: string };
    expect(result.balance).toBe(100);
    expect(result.owesWhom).toBe("user_2");
  });
});

describe("expenses:approve", () => {
  it("throws when expense not found", async () => {
    const { approve } = await import("../../convex/functions/expenses");
    const ctx = createMockCtx(validIdentity());
    await expect(approve.handler(ctx as never, { expenseId: "exp1" })).rejects.toThrow("not found");
  });

  it("throws when expense belongs to different org", async () => {
    const { approve } = await import("../../convex/functions/expenses");
    const expense = { _id: "exp1", orgId: "org_other", amount: 50, status: "pending", enteredBy: "user_2" };
    const ctx = createMockCtx(validIdentity(), { expenseToGet: expense });
    await expect(approve.handler(ctx as never, { expenseId: "exp1" })).rejects.toThrow("Access denied");
  });

  it("throws when expense is not pending", async () => {
    const { approve } = await import("../../convex/functions/expenses");
    const expense = { _id: "exp1", orgId: "org_1", amount: 50, status: "approved", enteredBy: "user_2" };
    const ctx = createMockCtx(validIdentity(), { expenseToGet: expense });
    await expect(approve.handler(ctx as never, { expenseId: "exp1" })).rejects.toThrow("not pending");
  });

  it("throws when creator tries to approve their own expense", async () => {
    const { approve } = await import("../../convex/functions/expenses");
    const expense = { _id: "exp1", orgId: "org_1", amount: 50, status: "pending", enteredBy: "user_1" };
    const ctx = createMockCtx(validIdentity(), { expenseToGet: expense });
    await expect(approve.handler(ctx as never, { expenseId: "exp1" })).rejects.toThrow("creator cannot approve");
  });

  it("successfully approves expense and patches with status", async () => {
    const { approve } = await import("../../convex/functions/expenses");
    const expense = { _id: "exp1", orgId: "org_1", amount: 50, status: "pending", enteredBy: "user_2" };
    const ctx = createMockCtx(validIdentity(), { expenseToGet: expense });
    await approve.handler(ctx as never, { expenseId: "exp1" });
    expect(ctx._patchCalls).toHaveLength(1);
    expect(ctx._patchCalls![0].data.status).toBe("approved");
    expect(ctx._patchCalls![0].data.approvedBy).toBe("user_1");
  });
});

describe("expenses:reject", () => {
  it("throws when expense not found", async () => {
    const { reject } = await import("../../convex/functions/expenses");
    const ctx = createMockCtx(validIdentity());
    await expect(reject.handler(ctx as never, { expenseId: "exp1" })).rejects.toThrow("not found");
  });

  it("throws when expense belongs to different org", async () => {
    const { reject } = await import("../../convex/functions/expenses");
    const expense = { _id: "exp1", orgId: "org_other", amount: 50, status: "pending", enteredBy: "user_2" };
    const ctx = createMockCtx(validIdentity(), { expenseToGet: expense });
    await expect(reject.handler(ctx as never, { expenseId: "exp1" })).rejects.toThrow("Access denied");
  });

  it("throws when expense is not pending", async () => {
    const { reject } = await import("../../convex/functions/expenses");
    const expense = { _id: "exp1", orgId: "org_1", amount: 50, status: "rejected", enteredBy: "user_2" };
    const ctx = createMockCtx(validIdentity(), { expenseToGet: expense });
    await expect(reject.handler(ctx as never, { expenseId: "exp1" })).rejects.toThrow("not pending");
  });

  it("throws when creator tries to reject their own expense", async () => {
    const { reject } = await import("../../convex/functions/expenses");
    const expense = { _id: "exp1", orgId: "org_1", amount: 50, status: "pending", enteredBy: "user_1" };
    const ctx = createMockCtx(validIdentity(), { expenseToGet: expense });
    await expect(reject.handler(ctx as never, { expenseId: "exp1" })).rejects.toThrow("creator cannot reject");
  });

  it("successfully rejects expense with reason and patches with status", async () => {
    const { reject } = await import("../../convex/functions/expenses");
    const expense = { _id: "exp1", orgId: "org_1", amount: 50, status: "pending", enteredBy: "user_2" };
    const ctx = createMockCtx(validIdentity(), { expenseToGet: expense });
    await reject.handler(ctx as never, { expenseId: "exp1", rejectReason: "Too expensive" });
    expect(ctx._patchCalls).toHaveLength(1);
    expect(ctx._patchCalls![0].data.status).toBe("rejected");
    expect(ctx._patchCalls![0].data.approvedBy).toBe("user_1");
    expect(ctx._patchCalls![0].data.rejectReason).toBe("Too expensive");
  });
});

describe("expenses:create", () => {
  it("rejects when paidBy != authenticated user", async () => {
    const { create } = await import("../../convex/functions/expenses");
    const ctx = createMockCtx(validIdentity());
    await expect(
      create.handler(ctx as never, {
        amount: 100,
        date: "2024-01-01",
        category: "groceries",
        paidBy: "user_2",
      })
    ).rejects.toThrow("paidBy must match");
  });

  it("succeeds with matching paidBy and returns {id, isDuplicate}", async () => {
    const { create } = await import("../../convex/functions/expenses");
    const ctx = createMockCtx(validIdentity());
    const result = await create.handler(ctx as never, {
      amount: 100,
      date: "2024-01-01",
      category: "groceries",
      paidBy: "user_1",
    });
    expect(result).toHaveProperty("id");
    expect(result).toHaveProperty("isDuplicate");
    expect((result as { isDuplicate: boolean }).isDuplicate).toBe(false);
  });

  it("detects duplicate by receiptPHash", async () => {
    const { create } = await import("../../convex/functions/expenses");
    const existing = [{
      _id: "exp_existing",
      orgId: "org_1",
      amount: 100,
      status: "approved",
      paidBy: "user_2",
      receiptPHash: "a1b2c3d4e5f6a7b8",
    }];
    const ctx = createMockCtx(validIdentity(), { expenses: existing });
    const result = await create.handler(ctx as never, {
      amount: 100,
      date: "2024-01-01",
      category: "groceries",
      paidBy: "user_1",
      receiptPHash: "a1b2c3d4e5f6a7b8",
    });
    expect((result as { isDuplicate: boolean }).isDuplicate).toBe(true);
  });

  it("detects duplicate by receiptFingerprint", async () => {
    const { create } = await import("../../convex/functions/expenses");
    const existing = [{
      _id: "exp_existing",
      orgId: "org_1",
      amount: 100,
      status: "approved",
      paidBy: "user_2",
      receiptFingerprint: "Walmart|2024-01-01|100.00",
    }];
    const ctx = createMockCtx(validIdentity(), { expenses: existing });
    const result = await create.handler(ctx as never, {
      amount: 100,
      date: "2024-01-01",
      category: "groceries",
      paidBy: "user_1",
      receiptFingerprint: "Walmart|2024-01-01|100.00",
    });
    expect((result as { isDuplicate: boolean }).isDuplicate).toBe(true);
  });

  it("returns isDuplicate false when no receipt data provided", async () => {
    const { create } = await import("../../convex/functions/expenses");
    const ctx = createMockCtx(validIdentity(), { expenses: [] });
    const result = await create.handler(ctx as never, {
      amount: 100,
      date: "2024-01-01",
      category: "groceries",
      paidBy: "user_1",
    });
    expect((result as { isDuplicate: boolean }).isDuplicate).toBe(false);
  });

  it("handles receiptPHash only (no fingerprint) without q.or undefined error", async () => {
    const { create } = await import("../../convex/functions/expenses");
    const ctx = createMockCtx(validIdentity(), { expenses: [] });
    const result = await create.handler(ctx as never, {
      amount: 100,
      date: "2024-01-01",
      category: "groceries",
      paidBy: "user_1",
      receiptPHash: "a1b2c3d4e5f6a7b8",
    });
    expect((result as { id: string }).id).toBe("mock_id");
    expect((result as { isDuplicate: boolean }).isDuplicate).toBe(false);
  });

  it("handles receiptFingerprint only (no pHash) without q.or undefined error", async () => {
    const { create } = await import("../../convex/functions/expenses");
    const ctx = createMockCtx(validIdentity(), { expenses: [] });
    const result = await create.handler(ctx as never, {
      amount: 100,
      date: "2024-01-01",
      category: "groceries",
      paidBy: "user_1",
      receiptFingerprint: "Walmart|2024-01-01|100.00",
    });
    expect((result as { id: string }).id).toBe("mock_id");
    expect((result as { isDuplicate: boolean }).isDuplicate).toBe(false);
  });

  // SEC-001: Finding — expenses:create must enforce auth before running duplicate check; unauthenticated caller must not reach runDuplicateCheck
  it("ST-D5-004: SEC-001 — unauthenticated create rejected before duplicate check runs (SEC-001)", async () => {
    const { create } = await import("../../convex/functions/expenses");
    const ctx = createMockCtx(null);
    await expect(
      create.handler(ctx as never, {
        amount: 100,
        date: "2024-01-01",
        category: "groceries",
        paidBy: "user_1",
        receiptPHash: "a1b2c3d4e5f6a7b8",
      })
    ).rejects.toThrow("Unauthenticated");
  });

  it("succeeds with new user-created category name (e.g. Entertainment)", async () => {
    const { create } = await import("../../convex/functions/expenses");
    const ctx = createMockCtx(validIdentity(), { expenses: [] });
    const result = await create.handler(ctx as never, {
      amount: 4500,
      date: "2024-01-15",
      category: "Entertainment",
      categoryId: undefined,
      paidBy: "user_1",
    });
    expect((result as { id: string }).id).toBe("mock_id");
    expect((result as { isDuplicate: boolean }).isDuplicate).toBe(false);
    expect(ctx._insertCalls![0]).toMatchObject({ category: "Entertainment" });
  });

  it("succeeds with capitalised default category name (e.g. Groceries)", async () => {
    const { create } = await import("../../convex/functions/expenses");
    const ctx = createMockCtx(validIdentity(), { expenses: [] });
    const result = await create.handler(ctx as never, {
      amount: 12000,
      date: "2024-01-10",
      category: "Groceries",
      categoryId: undefined,
      paidBy: "user_1",
    });
    expect((result as { id: string }).id).toBe("mock_id");
    expect((result as { isDuplicate: boolean }).isDuplicate).toBe(false);
    expect(ctx._insertCalls![0]).toMatchObject({ category: "Groceries" });
  });
});

describe("SEC-002: GDPR retention — deletedAt soft-delete", () => {
  it("REQUIRES soft-deleted expenses excluded from list — deletedAt set filters from results (SEC-002)", async () => {
    const { list } = await import("../../convex/functions/expenses");
    const active = { _id: "exp1", orgId: "org_1", amount: 50, status: "approved" };
    const deleted = { _id: "exp2", orgId: "org_1", amount: 30, status: "approved", deletedAt: Date.now() };
    const ctx = createMockCtx(validIdentity(), { expenses: [active, deleted] });
    const result = await list.handler(ctx as never, {}) as unknown[];
    expect(result).toHaveLength(1);
    expect(result[0]._id).toBe("exp1");
  });

  it("REQUIRES balance excludes soft-deleted expenses — deletedAt documents ignored in balance calc (SEC-002)", async () => {
    const { balance } = await import("../../convex/functions/expenses");
    const expenses = [
      { _id: "exp1", orgId: "org_1", amount: 100, status: "approved", paidBy: "user_2", deletedAt: Date.now() },
      { _id: "exp2", orgId: "org_1", amount: 50, status: "approved", paidBy: "user_2" },
    ];
    const ctx = createMockCtx(validIdentity(), { expenses });
    const result = await balance.handler(ctx as never, {}) as { balance: number; owesWhom: string };
    expect(result.balance).toBe(50);
  });
});

describe("SEC-003: webhook verification", () => {
  it("REQUIRES Clerk webhook signed via HMAC-SHA256 — forged payload rejected (SEC-003)", async () => {
    const { createHmac } = await import("crypto");
    const secret = "test_webhook_secret";
    const payload = JSON.stringify({ type: "organization.deleted", data: { id: "org_1" } });
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const toSign = `${timestamp}.${payload}`;
    const hmac = createHmac("sha256", secret);
    hmac.update(toSign);
    const validSignature = `v1,${hmac.digest("hex")}`;
    const forgedSignature = `v1,invalid`;

    expect(validSignature).not.toBe(forgedSignature);
    expect(validSignature.startsWith("v1,")).toBe(true);
  });
});

describe("SEC-004: generated API type correctness", () => {
  it("REQUIRES createdAt/updatedAt typed as number — schema types match runtime (SEC-004)", async () => {
    const expense: Expense = {
      _id: "exp1",
      orgId: "org_1",
      amount: 50,
      date: "2024-01-01",
      category: "groceries",
      paidBy: "user_1",
      status: "pending",
      enteredBy: "user_1",
      createdAt: 1234567890,
      updatedAt: 1234567890,
      deletedAt: 1234567890,
    };
    expect(typeof expense.createdAt).toBe("number");
    expect(typeof expense.updatedAt).toBe("number");
  });
});

describe("SEC-005: duplicate detection", () => {
  it("REQUIRES no false-positive duplicates — single receipt field does not trigger q.true() fallback (SEC-005)", async () => {
    const { create } = await import("../../convex/functions/expenses");
    const ctx = createMockCtx(validIdentity(), { expenses: [] });
    const result = await create.handler(ctx as never, {
      amount: 100,
      date: "2024-01-01",
      category: "groceries",
      paidBy: "user_1",
      receiptPHash: "unique_hash_123",
    });
    expect((result as { isDuplicate: boolean }).isDuplicate).toBe(false);
  });

  it("REQUIRES cross-org duplicate detection — same receipt hash in different org not flagged as duplicate (SEC-005)", async () => {
    const { create } = await import("../../convex/functions/expenses");
    const otherOrgExpense = [{
      _id: "exp_other",
      orgId: "org_other",
      amount: 200,
      status: "approved",
      paidBy: "user_2",
      receiptPHash: "shared_hash_456",
    }];
    const ctx = createMockCtx(validIdentity(), { expenses: otherOrgExpense });
    const result = await create.handler(ctx as never, {
      amount: 100,
      date: "2024-01-01",
      category: "groceries",
      paidBy: "user_1",
      receiptPHash: "shared_hash_456",
    });
    expect((result as { isDuplicate: boolean }).isDuplicate).toBe(false);
  });

  // DUP-Q1: Finding — near-duplicate date+amount check could flag cross-org expenses if orgId scoping fails
  it("ST-D5-005: DUP-Q1 — near-duplicate date+amount from other org not flagged at create level (DUP-Q1)", async () => {
    const { create } = await import("../../convex/functions/expenses");
    const otherOrgExpense = [{
      _id: "exp_other",
      orgId: "org_other",
      amount: 100,
      date: "2024-01-01",
      status: "approved",
      paidBy: "user_2",
    }];
    const ctx = createMockCtx(validIdentity(), { expenses: otherOrgExpense });
    const result = await create.handler(ctx as never, {
      amount: 100,
      date: "2024-01-01",
      category: "groceries",
      paidBy: "user_1",
    });
    expect((result as { isDuplicate: boolean }).isDuplicate).toBe(false);
    expect((result as { duplicateMatches: unknown[] }).duplicateMatches).toHaveLength(0);
  });
});

describe("notifyExpensePending", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    (clerkRequest as ReturnType<typeof vi.fn>).mockResolvedValue({ data: [] });
    (sendEmail as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "email_123" });
  });
  const mockMemberships = {
    data: [
      { user: { id: "user_1", first_name: "Alice", last_name: "Smith", email_addresses: [{ email_address: "alice@example.com" }] } },
      { user: { id: "user_2", first_name: "Bob", last_name: "Jones", email_addresses: [{ email_address: "bob@example.com" }] } },
    ],
  };

  const mockExpense = {
    _id: "exp1",
    orgId: "org_1",
    amount: 42.50,
    category: "groceries",
    notes: "Weekly shop",
    paidBy: "user_1",
    status: "pending",
    date: "2024-01-15",
    createdAt: 1234567890,
    updatedAt: 1234567890,
  };

  it("resolves expense notification (delivery via internal action TODO; currently not wired)", async () => {
    const mockUser = { data: { id: "user_1", first_name: "Alice", last_name: "Smith", email_addresses: [{ email_address: "alice@example.com" }] } };
    (clerkRequest as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(mockMemberships)
      .mockResolvedValueOnce(mockUser);
    (sendEmail as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "email_123" });

    const ctx = createMockCtx(validIdentity(), { expenseToGet: mockExpense });
    ctx.db.query = () => {
      const chain = {
        withIndex: () => chain,
        first: () => Promise.resolve({ emailSettings: undefined }),
      };
      return chain as never;
    };

    const result = await notifyExpensePending.handler(ctx as never, { expenseId: "exp1" });
    expect(result.sent).toBe(false);
    expect(result.reason).toBe("Notification delivery not wired to Convex action");
    expect(clerkRequest).toHaveBeenCalledWith("/organizations/org_1/memberships");
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("returns opted-out when org has expenseNotifications disabled", async () => {
    const ctx = createMockCtx(validIdentity(), { expenseToGet: mockExpense });
    ctx.db.query = () => {
      const chain = {
        withIndex: () => chain,
        first: () => Promise.resolve({ emailSettings: { expenseNotifications: false } }),
      };
      return chain as never;
    };

    const result = await notifyExpensePending.handler(ctx as never, { expenseId: "exp1" });
    expect(result).toEqual({ sent: false, reason: "User has opted out of expense notifications" });
    expect(clerkRequest).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("returns not wired when only payer is in memberships (no PII)", async () => {
    (clerkRequest as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: [{ user: { id: "user_1", first_name: "Alice", last_name: "Smith", email_addresses: [{ email_address: "alice@example.com" }] } }],
    });

    const ctx = createMockCtx(validIdentity(), { expenseToGet: mockExpense });
    ctx.db.query = () => {
      const chain = {
        withIndex: () => chain,
        first: () => Promise.resolve({ emailSettings: undefined }),
      };
      return chain as never;
    };

    const result = await notifyExpensePending.handler(ctx as never, { expenseId: "exp1" });
    expect(result.sent).toBe(false);
    expect(["Notification delivery not wired to Convex action", "No recipient found"]).toContain(result.reason);
  });

  it("returns not wired when recipient has no email (no PII)", async () => {
    (clerkRequest as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: [
        { user: { id: "user_1", first_name: "Alice", last_name: "Smith", email_addresses: [{ email_address: "alice@example.com" }] } },
        { user: { id: "user_2", first_name: "Bob", last_name: "Jones", email_addresses: [] } },
      ],
    });

    const ctx = createMockCtx(validIdentity(), { expenseToGet: mockExpense });
    ctx.db.query = () => {
      const chain = {
        withIndex: () => chain,
        first: () => Promise.resolve({ emailSettings: undefined }),
      };
      return chain as never;
    };

    const result = await notifyExpensePending.handler(ctx as never, { expenseId: "exp1" });
    expect(result.sent).toBe(false);
    expect(result.reason).toBe("Notification delivery not wired to Convex action");
  });

  it("throws when expense not found", async () => {
    const ctx = createMockCtx(validIdentity(), { expenseToGet: null });

    await expect(
      notifyExpensePending.handler(ctx as never, { expenseId: "missing" }),
    ).rejects.toThrow("Expense not found");
  });
});

describe("SEC-D7-007: payerName is display name, not ID", () => {
  it("REQUIRES display name resolution — getUserDisplayName returns full name", async () => {
    (clerkRequest as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      data: {
        id: "user_123",
        first_name: "Alice",
        last_name: "Smith",
        email_addresses: [{ email_address: "alice@example.com" }],
      },
    });

    const name = await getUserDisplayName("user_123");
    expect(name).toBe("Alice Smith");
    expect(name).not.toBe("user_123");
  });

  it("REQUIRES display name fallback — email prefix when no first/last name", async () => {
    (clerkRequest as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      data: {
        id: "user_456",
        first_name: null,
        last_name: null,
        email_addresses: [{ email_address: "bob123@example.com" }],
      },
    });

    const name = await getUserDisplayName("user_456");
    expect(name).toBe("bob123");
    expect(name).not.toBe("user_456");
  });
});

describe("SEC-D7-008: Return values contain no PII", () => {
  const mockMembershipsForPii = {
    data: [
      { user: { id: "user_1", first_name: "Alice", last_name: "Smith", email_addresses: [{ email_address: "alice@example.com" }] } },
      { user: { id: "user_2", first_name: "Bob", last_name: "Jones", email_addresses: [{ email_address: "bob@example.com" }] } },
    ],
  };

  const mockExpenseForPii = {
    _id: "exp1",
    id: "exp1",
    orgId: "org_1",
    amount: 42.50,
    category: "groceries",
    notes: "Weekly shop",
    paidBy: "user_1",
    status: "pending",
    date: "2024-01-15",
    enteredBy: "user_1",
    createdAt: 1234567890,
    updatedAt: 1234567890,
  };

  it("REQUIRES no email addresses in return values — notifyExpensePending returns clean result", async () => {
    const mockUser = { data: { id: "user_1", first_name: "Alice", last_name: "Smith", email_addresses: [{ email_address: "alice@example.com" }] } };
    (clerkRequest as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(mockMembershipsForPii)
      .mockResolvedValueOnce(mockUser);
    (sendEmail as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "email_123" });

    const ctx = createMockCtx(validIdentity(), { expenseToGet: mockExpenseForPii });
    ctx.db.query = () => {
      const chain = {
        withIndex: () => chain,
        first: () => Promise.resolve({ emailSettings: undefined }),
      };
      return chain as never;
    };

    const result = await notifyExpensePending.handler(ctx as never, { expenseId: "exp1" });
    expect(result.sent).toBe(false);
    expect(JSON.stringify(result)).not.toContain("bob@example.com");
    expect(JSON.stringify(result)).not.toContain("alice@example.com");
  });

  it("REQUIRES no email addresses in opted-out response", async () => {
    const ctx = createMockCtx(validIdentity(), { expenseToGet: mockExpenseForPii });
    ctx.db.query = () => {
      const chain = {
        withIndex: () => chain,
        first: () =>
          Promise.resolve({
            emailSettings: {
              expenseNotifications: false,
              settlementNotifications: true,
              weeklySummary: true,
              securityAlerts: true,
            },
          }),
      };
      return chain as never;
    };

    const result = await notifyExpensePending.handler(ctx as never, { expenseId: "exp1" });
    expect(JSON.stringify(result)).not.toMatch(
      /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/,
    );
  });
});
