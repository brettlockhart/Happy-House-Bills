import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const requireAuthenticatedOrg = vi.fn();
vi.mock("../../convex/auth", () => ({ requireAuthenticatedOrg }));
vi.mock("../../convex/_generated/server", () => ({
  action: (def: unknown) => def,
  query: (def: unknown) => def,
  mutation: (def: unknown) => def,
  internalQuery: (def: unknown) => def,
  internalMutation: (def: unknown) => def,
}));
vi.mock("../../convex/_generated/api", () => ({
  internal: {
    functions: {
      receiptUpgrades: {
        assertReceiptWrite: "assertReceiptWrite",
        consumeOcrQuota: "consumeOcrQuota",
        assertReceiptsOwned: "assertReceiptsOwned",
        getExpense: "getExpense",
        applyOcrUpgrade: "applyOcrUpgrade",
      },
    },
  },
}));
vi.mock("../../convex/functions/uploadReceipt", () => ({ stripExifJpeg: (value: unknown) => value }));

function png(): string {
  return Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]).toString("base64");
}

function chain(result: unknown) {
  return {
    withIndex: () => ({ first: async () => result }),
  };
}

function providerResponse(payload: unknown) {
  return {
    ok: true,
    status: 200,
    text: async () => JSON.stringify({ choices: [{ message: { content: JSON.stringify(payload) } }] }),
  };
}

const originalEnv = { ...process.env };
beforeEach(() => {
  vi.resetAllMocks();
  process.env.OPENROUTER_API_KEY = "test-key";
  process.env.AUTH_BYPASS = "0";
  requireAuthenticatedOrg.mockResolvedValue({ userId: "user_1", orgId: "org_1" });
  globalThis.fetch = vi.fn();
});
afterEach(() => {
  process.env = { ...originalEnv };
});

describe("receipt tenant isolation and write permissions", () => {
  it("rejects an upload ID that is not owned by the organisation", async () => {
    const { assertReceiptUploadsOwned } = await import("../../convex/functions/receiptUpgrades");
    const ctx = { db: { query: () => chain(null) } };
    await expect(assertReceiptUploadsOwned(ctx as never, ["storage_other" as never], "org_1"))
      .rejects.toThrow("not found or not authorised");
  });

  it("accepts an upload owned by the organisation", async () => {
    const { assertReceiptUploadsOwned } = await import("../../convex/functions/receiptUpgrades");
    const ctx = { db: { query: () => chain({ storageId: "storage_1", orgId: "org_1" }) } };
    await expect(assertReceiptUploadsOwned(ctx as never, ["storage_1" as never], "org_1"))
      .resolves.toBeUndefined();
  });

  it("rejects viewers and suspended members from paid receipt operations", async () => {
    const { assertReceiptWriteAccess } = await import("../../convex/functions/receiptUpgrades");
    for (const membership of [
      { role: "viewer", status: "active" },
      { role: "member", status: "suspended" },
      { role: "member", status: "pending" },
      null,
    ]) {
      const ctx = { db: { query: () => chain(membership) } };
      await expect(assertReceiptWriteAccess(ctx as never, "org_1", "user_1"))
        .rejects.toThrow("permission");
    }
  });

  it("allows an active member", async () => {
    const { assertReceiptWriteAccess } = await import("../../convex/functions/receiptUpgrades");
    const ctx = { db: { query: () => chain({ role: "member", status: "active" }) } };
    await expect(assertReceiptWriteAccess(ctx as never, "org_1", "user_1"))
      .resolves.toBeUndefined();
  });
});

describe("OpenRouter OCR provider hardening", () => {
  function actionCtx() {
    return {
      runQuery: vi.fn().mockResolvedValue(true),
      runMutation: vi.fn().mockResolvedValue(undefined),
    };
  }

  it("uses privacy routing and returns validated receipt data", async () => {
    const { processReceipt } = await import("../../convex/functions/ocrOpenRouter");
    const fetchMock = vi.mocked(globalThis.fetch);
    fetchMock.mockResolvedValue(providerResponse({
      store: "Target",
      date: "2024-12-25",
      total: 45.99,
      confidence: 90,
      raw_text: "Target\nTotal 45.99",
      line_items: [{ description: "Milk", quantity: 2, unit_price: 6, total_price: 12, category_hint: "groceries" }],
    }) as never);
    const ctx = actionCtx();
    const result = await processReceipt.handler(ctx as never, { images: [{ image: png(), contentType: "image/png" }] });

    expect(result.total).toBe("45.99");
    expect(result.lowConfidence).toBe(false);
    expect(result.lineItems?.[0]?.description).toBe("Milk");
    expect(ctx.runMutation).toHaveBeenCalledWith("consumeOcrQuota", { orgId: "org_1", userId: "user_1" });
    const body = JSON.parse((fetchMock.mock.calls[0]?.[1] as RequestInit).body as string);
    expect(body.provider.data_collection).toBe("deny");
    expect(body.max_tokens).toBe(4000);
    expect(body.messages[0].content[0].text).toContain("untrusted data");
  });

  it("sanitises invalid financial values and marks unknown confidence for review", async () => {
    const { processReceipt } = await import("../../convex/functions/ocrOpenRouter");
    vi.mocked(globalThis.fetch).mockResolvedValue(providerResponse({
      store: 42,
      date: "not-a-date",
      total: -100,
      line_items: null,
    }) as never);
    const result = await processReceipt.handler(actionCtx() as never, {
      images: [{ image: png(), contentType: "image/png" }],
    });
    expect(result.total).toBeUndefined();
    expect(result.date).toBeUndefined();
    expect(result.confidence).toBeUndefined();
    expect(result.lowConfidence).toBe(true);
    expect(result.lineItems).toEqual([]);
  });

  it("rejects excessive frames before calling the paid provider", async () => {
    const { processReceipt } = await import("../../convex/functions/ocrOpenRouter");
    const images = Array.from({ length: 9 }, () => ({ image: png(), contentType: "image/png" }));
    await expect(processReceipt.handler(actionCtx() as never, { images }))
      .rejects.toThrow("maximum 8");
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("returns a safe rate-limit error without raw provider details", async () => {
    const { processReceipt } = await import("../../convex/functions/ocrOpenRouter");
    vi.mocked(globalThis.fetch).mockResolvedValue({ ok: false, status: 429, text: async () => "secret provider details" } as never);
    await expect(processReceipt.handler(actionCtx() as never, {
      images: [{ image: png(), contentType: "image/png" }],
    })).rejects.toThrow("rate limited");
  });
});

describe("safe AI upgrades", () => {
  it("preserves user financial values and keeps conflicts under review", async () => {
    const { applyOcrUpgrade } = await import("../../convex/functions/receiptUpgrades");
    const expense = {
      _id: "expense_1",
      status: "pending",
      amount: 50,
      date: "2024-01-01",
      store: "User Store",
      updatedAt: 100,
      createdAt: 100,
    };
    const patch = vi.fn();
    const ctx = { db: { get: async () => expense, patch } };
    const result = await applyOcrUpgrade.handler(ctx as never, {
      expenseId: "expense_1",
      amount: 45,
      date: "2024-02-02",
      store: "AI Store",
      confidence: 95,
      expectedUpdatedAt: 100,
    });
    expect(result).toEqual({ applied: true, hasConflict: true });
    expect(patch).toHaveBeenCalledWith("expense_1", expect.objectContaining({
      amount: 50,
      date: "2024-01-01",
      store: "User Store",
      ocrNeedsReview: true,
    }));
  });

  it("does not apply stale or approved upgrades", async () => {
    const { applyOcrUpgrade } = await import("../../convex/functions/receiptUpgrades");
    const patch = vi.fn();
    const staleCtx = { db: { get: async () => ({ status: "pending", updatedAt: 200 }), patch } };
    expect(await applyOcrUpgrade.handler(staleCtx as never, {
      expenseId: "expense_1", expectedUpdatedAt: 100, amount: 10,
    })).toEqual({ applied: false });

    const approvedCtx = { db: { get: async () => ({ status: "approved", updatedAt: 100 }), patch } };
    expect(await applyOcrUpgrade.handler(approvedCtx as never, {
      expenseId: "expense_1", expectedUpdatedAt: 100, amount: 10,
    })).toEqual({ applied: false });
    expect(patch).not.toHaveBeenCalled();
  });

  it("enforces the daily OCR quota", async () => {
    const { consumeOcrQuota } = await import("../../convex/functions/receiptUpgrades");
    const ctx = { db: { query: () => chain({ _id: "rate_1", count: 50 }) } };
    await expect(consumeOcrQuota.handler(ctx as never, { orgId: "org_1", userId: "user_1" }))
      .rejects.toThrow("Daily OCR limit");
  });
});
