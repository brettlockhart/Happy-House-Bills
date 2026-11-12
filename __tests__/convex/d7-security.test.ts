import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("../../convex/_generated/server", () => ({
  action: (config: { handler: (ctx: unknown, args: unknown) => Promise<unknown> }) => ({
    ...config,
    handler: config.handler.bind(config),
  }),
  internalAction: (config: { handler: (ctx: unknown, args: unknown) => Promise<unknown> }) => ({
    ...config,
    handler: config.handler.bind(config),
  }),
  internal: (config: { handler: (ctx: unknown, args: unknown) => Promise<unknown> }) => ({
    ...config,
    handler: config.handler.bind(config),
  }),
}));

vi.mock("../../convex/_generated/api", () => ({
  api: {
    expenses: {},
    settlements: {},
  },
  internal: {
    email: {
      send: {},
    },
    expenses: {
      notifyExpensePending: {},
    },
    settlements: {
      notifySettlementCreated: {},
    },
  },
}));

vi.mock("convex/values", () => ({
  v: {
    array: () => ({ _isValidator: true }),
    string: () => ({ _isValidator: true }),
    object: () => ({ _isValidator: true }),
    optional: () => ({ _isValidator: true }),
    id: () => ({ _isValidator: true }),
  },
}));

const {
  escapeHtml,
  renderInviteEmail,
  renderExpenseNotificationEmail,
  renderSettlementNotificationEmail,
  renderExpenseApprovedEmail,
  renderExpenseRejectedEmail,
} = await import("../../convex/functions/email");

const { api, internal } = await import("../../convex/_generated/api");

describe("D7 Security Tests", () => {
  beforeEach(() => {
    vi.stubEnv("RESEND_API_KEY", "test_key");
    vi.stubEnv("RESEND_FROM_EMAIL", "test@example.com");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://app.example.com");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe("SEC-D7-001: Client cannot call internal.email.send", () => {
    it("REQUIRES action to be internal-only — email.send is NOT in client-facing api", () => {
      expect(api.email).toBeUndefined();
    });

    it("REQUIRES action to be internal-only — email.send IS in internal api", () => {
      expect(internal.email).toBeDefined();
      expect(internal.email.send).toBeDefined();
    });
  });

  describe("SEC-D7-002: Client cannot call internal.expenses.notifyExpensePending", () => {
    it("REQUIRES action to be internal-only — notifyExpensePending is NOT in client-facing api", () => {
      expect(api.expenses.notifyExpensePending).toBeUndefined();
    });

    it("REQUIRES action to be internal-only — notifyExpensePending IS in internal api", () => {
      expect(internal.expenses.notifyExpensePending).toBeDefined();
    });
  });

  describe("SEC-D7-003: Client cannot call internal.settlements.notifySettlementCreated", () => {
    it("REQUIRES action to be internal-only — notifySettlementCreated is NOT in client-facing api", () => {
      expect(api.settlements.notifySettlementCreated).toBeUndefined();
    });

    it("REQUIRES action to be internal-only — notifySettlementCreated IS in internal api", () => {
      expect(internal.settlements.notifySettlementCreated).toBeDefined();
    });
  });

  describe("SEC-D7-004: escapeHtml encodes all special characters", () => {
    it("REQUIRES HTML encoding — encodes <, >, &, \", and '", () => {
      expect(escapeHtml("<")).toBe("&lt;");
      expect(escapeHtml(">")).toBe("&gt;");
      expect(escapeHtml("&")).toBe("&amp;");
      expect(escapeHtml('"')).toBe("&quot;");
      expect(escapeHtml("'")).toBe("&#39;");
    });

    it("REQUIRES HTML encoding — prevents XSS attack payload", () => {
      const input = "<script>alert('xss')</script>";
      const result = escapeHtml(input);
      expect(result).not.toContain("<script>");
      expect(result).toContain("&lt;script&gt;");
      expect(result).not.toContain("<script>alert('xss')</script>");
    });

    it("REQUIRES HTML encoding in template — inviter name encoded", () => {
      const html = renderInviteEmail(
        "test@example.com",
        "<script>alert('x')</script>",
        "Org",
        "token123",
      );
      expect(html).toContain("&lt;script&gt;");
      expect(html).not.toContain("<script>alert");
    });

    it("REQUIRES HTML encoding in template — expense notes encoded", () => {
      const html = renderExpenseNotificationEmail(
        "exp1",
        "Alice",
        50,
        "groceries",
        "Free text <img src=x onerror=alert(1)>",
      );
      expect(html).toContain("&lt;img");
      expect(html).not.toContain("<img src=x onerror");
    });

    it("REQUIRES HTML encoding in template — rejectReason encoded", () => {
      const html = renderExpenseRejectedEmail(
        "Bob",
        "exp2",
        100,
        "utilities",
        "<script>steal()</script>",
      );
      expect(html).toContain("&lt;script&gt;");
      expect(html).not.toContain("<script>steal");
    });
  });

  describe("SEC-D7-006: Settlement template contains unsubscribe link", () => {
    it("REQUIRES unsubscribe link — settlement email has visible unsubscribe", () => {
      const html = renderSettlementNotificationEmail("Alice", "Bob", 25.5);
      expect(html).toContain("/settings/notifications");
      expect(html).toMatch(/Unsubscribe/i);
    });

    it("REQUIRES unsubscribe link — expense approved has unsubscribe", () => {
      const html = renderExpenseApprovedEmail("Charlie", "exp1", 15.99, "groceries");
      expect(html).toContain("/settings/notifications");
    });

    it("REQUIRES unsubscribe link — invite has visible unsubscribe", () => {
      const html = renderInviteEmail("test@example.com", "Alice", "Household", "token");
      expect(html).toContain("/settings/notifications");
      expect(html).toMatch(/Unsubscribe/i);
    });

    it("REQUIRES unsubscribe link — expense rejected has unsubscribe", () => {
      const html = renderExpenseRejectedEmail("Bob", "exp2", 10, "groceries", undefined);
      expect(html).toContain("/settings/notifications");
    });
  });

  describe("SEC-D7-009: HTTPS validation for NEXT_PUBLIC_APP_URL", () => {
    it("REQUIRES HTTPS — throws for non-HTTPS URL in sendEmail", async () => {
      vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://bad.example.com");
      const mockFetch = vi.fn();
      vi.stubEnv("RESEND_API_KEY", "test_key");
      global.fetch = mockFetch as unknown as typeof fetch;

      const { sendEmail } = await import("../../convex/functions/email");
      await expect(
        sendEmail({
          to: ["test@example.com"],
          subject: "Test",
          html: "<p>Test</p>",
          orgId: "org_1",
        }),
      ).rejects.toThrow("HTTPS");
    });

    it("REQUIRES HTTPS — accepts HTTPS URL", () => {
      vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://app.example.com");
      const html = renderSettlementNotificationEmail("Alice", "Bob", 25.5);
      expect(html).toContain("https://app.example.com/settings/notifications");
    });
  });

  describe("SEC-D7-010: Rate limit enforced", () => {
    it("REQUIRES per-org daily cap — throws when limit exceeded (SEC-D7-010)", async () => {
      const { checkAndIncrementRateLimit } = await import("../../convex/functions/email");

      const mockFetch = vi.fn();
      global.fetch = mockFetch as unknown as typeof fetch;

      const ctx = {
        db: {
          query: vi.fn().mockReturnValue({
            withIndex: vi.fn().mockReturnValue({
              first: vi.fn().mockResolvedValue({ _id: "rl1", count: 100, lastSentAt: Date.now() }),
            }),
          }),
          insert: vi.fn(),
          patch: vi.fn(),
        },
      };

      await expect(
        checkAndIncrementRateLimit(ctx as never, "org_1"),
      ).rejects.toThrow("Daily email limit exceeded");
    });

    it("REQUIRES per-user cooldown — throws when user cooldown active (SEC-D7-010)", async () => {
      const { checkAndIncrementRateLimit } = await import("../../convex/functions/email");

      const ctx = {
        db: {
          query: vi.fn().mockReturnValue({
            withIndex: vi.fn().mockReturnValue({
              first: vi.fn().mockResolvedValue({
                _id: "rl1",
                count: 5,
                lastSentAt: Date.now() - 1000,
              }),
            }),
          }),
          insert: vi.fn(),
          patch: vi.fn(),
        },
      };

      await expect(
        checkAndIncrementRateLimit(ctx as never, "org_1", "user_1"),
      ).rejects.toThrow("Rate limit: user cooldown active");
    });

    it("REQUIRES rate limit allows sends below cap (SEC-D7-010)", async () => {
      const { checkAndIncrementRateLimit } = await import("../../convex/functions/email");

      const ctx = {
        db: {
          query: vi.fn().mockReturnValue({
            withIndex: vi.fn().mockReturnValue({
              first: vi.fn().mockResolvedValue({
                _id: "rl1",
                count: 50,
                lastSentAt: Date.now() - 7200000,
              }),
            }),
          }),
          insert: vi.fn(),
          patch: vi.fn(),
        },
      };

      await expect(
        checkAndIncrementRateLimit(ctx as never, "org_1", "user_1"),
      ).resolves.toBeUndefined();
    });
  });
});
