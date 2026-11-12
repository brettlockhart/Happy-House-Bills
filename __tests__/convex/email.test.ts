import { describe, it, expect, vi, beforeEach } from "vitest";

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

vi.mock("convex/values", () => ({
  v: {
    array: () => ({ _isValidator: true }),
    string: () => ({ _isValidator: true }),
    object: () => ({ _isValidator: true }),
    optional: () => ({ _isValidator: true }),
  },
}));

const { sendEmail, renderInviteEmail, renderExpenseNotificationEmail, renderSettlementNotificationEmail, renderExpenseApprovedEmail, renderExpenseRejectedEmail } = await import("../../convex/functions/email");

const mockFetch = vi.fn();
global.fetch = mockFetch as unknown as typeof fetch;

describe("sendEmail", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubEnv("RESEND_API_KEY", "test_key");
    vi.stubEnv("RESEND_FROM_EMAIL", "test@example.com");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://app.happyhousebills.com");
  });

  it("throws when RESEND_API_KEY not configured", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    const { sendEmail: send } = await import("../../convex/functions/email");
    await expect(
      send({
        to: ["test@example.com"],
        subject: "Test",
        html: "<p>Test</p>",
      }),
    ).rejects.toThrow("RESEND_API_KEY not configured");
  });

  it("sends email via Resend API", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: "email_123" }),
    });

    const result = await sendEmail({
      to: ["recipient@example.com"],
      subject: "Test Subject",
      html: "<p>Test HTML</p>",
    });

    expect(result.id).toBe("email_123");
    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.resend.com/emails",
      expect.objectContaining({
        method: "POST",
        headers: {
          Authorization: "Bearer test_key",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "test@example.com",
          to: ["recipient@example.com"],
          subject: "Test Subject",
          html: "<p>Test HTML</p>",
          headers: {
            "List-Unsubscribe": "<https://app.happyhousebills.com/settings/notifications>",
          },
        }),
      }),
    );
  });

  it("throws on Resend API error", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      statusText: "Bad Request",
      json: async () => ({ name: "bad_request", message: "Invalid API key" }),
    });

    await expect(
      sendEmail({
        to: ["test@example.com"],
        subject: "Test",
        html: "<p>Test</p>",
      }),
    ).rejects.toThrow("Resend API error: 400 Invalid API key");
  });

  it("throws when Resend API returns 500 without message", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
      json: async () => ({}),
    });

    await expect(
      sendEmail({
        to: ["test@example.com"],
        subject: "Test",
        html: "<p>Test</p>",
      }),
    ).rejects.toThrow("Resend API error: 500 Internal Server Error");
  });

  it("throws when fetch itself fails (network error)", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network error"));

    await expect(
      sendEmail({
        to: ["test@example.com"],
        subject: "Test",
        html: "<p>Test</p>",
      }),
    ).rejects.toThrow("Network error");
  });

  it("uses default from email when RESEND_FROM_EMAIL not set", async () => {
    vi.stubEnv("RESEND_FROM_EMAIL", "");
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: "email_123" }),
    });

    await sendEmail({
      to: ["test@example.com"],
      subject: "Test",
      html: "<p>Test</p>",
    });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.from).toBe("noreply@happyhousebills.com");
  });

  it("uses default app URL when NEXT_PUBLIC_APP_URL not set", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "");
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: "email_123" }),
    });

    await sendEmail({
      to: ["test@example.com"],
      subject: "Test",
      html: "<p>Test</p>",
    });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.headers["List-Unsubscribe"]).toBe("<https://app.happyhousebills.com/settings/notifications>");
  });

  it("includes List-Unsubscribe header for compliance", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: "email_123" }),
    });

    await sendEmail({
      to: ["test@example.com"],
      subject: "Test",
      html: "<p>Test</p>",
    });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.headers["List-Unsubscribe"]).toContain("/settings/notifications");
  });
});

describe("email templates", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://app.happyhousebills.com");
  });

  describe("renderInviteEmail", () => {
    it("renders invite email with correct content", () => {
      const html = renderInviteEmail("test@example.com", "Alice", "Household", "token_123");
      expect(html).toContain("You're invited to join Happy House Bills");
      expect(html).toContain("Alice");
      expect(html).toContain("token_123");
      expect(html).toContain("Accept Invite");
      expect(html).toContain("expires in 7 days");
    });

    it("renders unsubscribe link", () => {
      const html = renderInviteEmail("test@example.com", "Alice", "", "token_123");
      expect(html).toContain("/settings/notifications");
    });
  });

  describe("renderExpenseNotificationEmail", () => {
    it("renders expense notification with amount and category", () => {
      const html = renderExpenseNotificationEmail("exp123", "Alice", 42.5, "groceries", "Weekly shop");
      expect(html).toContain("New expense pending your confirmation");
      expect(html).toContain("$42.50");
      expect(html).toContain("groceries");
      expect(html).toContain("Weekly shop");
      expect(html).toContain("exp123");
    });

    it("handles missing notes", () => {
      const html = renderExpenseNotificationEmail("exp456", "Bob", 100, "utilities", undefined);
      expect(html).toContain("utilities");
      expect(html).not.toContain('— ""');
    });
  });

  describe("renderSettlementNotificationEmail", () => {
    it("renders settlement email with names and amount", () => {
      const html = renderSettlementNotificationEmail("Alice", "Bob", 25.75);
      expect(html).toContain("Settlement recorded");
      expect(html).toContain("$25.75");
      expect(html).toContain("Alice");
      expect(html).toContain("Bob");
    });
  });

  describe("renderExpenseApprovedEmail", () => {
    it("renders approval email", () => {
      const html = renderExpenseApprovedEmail("Charlie", "exp789", 15.99, "groceries");
      expect(html).toContain("Expense approved");
      expect(html).toContain("$15.99");
      expect(html).toContain("groceries");
      expect(html).toContain("Charlie");
    });
  });

  describe("renderExpenseRejectedEmail", () => {
    it("renders rejection email with reason", () => {
      const html = renderExpenseRejectedEmail("Charlie", "exp999", 50, "utilities", "Too expensive");
      expect(html).toContain("Expense rejected");
      expect(html).toContain("$50.00");
      expect(html).toContain("utilities");
      expect(html).toContain("Too expensive");
      expect(html).toContain("Charlie");
    });

    it("renders rejection email without reason", () => {
      const html = renderExpenseRejectedEmail("Charlie", "exp999", 50, "utilities", undefined);
      expect(html).toContain("Expense rejected");
      expect(html).not.toContain("<p>Reason:");
    });
  });
});

describe("send Convex action", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubEnv("RESEND_API_KEY", "test_key");
    vi.stubEnv("RESEND_FROM_EMAIL", "test@example.com");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://app.happyhousebills.com");
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ id: "email_123" }),
    });
  });

  it("calls sendEmail with correct args through handler", async () => {
    const { send } = await import("../../convex/functions/email");
    await send.handler({ auth: {} }, { to: ["recipient@example.com"], subject: "Test", html: "<p>HTML</p>" });
    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.resend.com/emails",
      expect.objectContaining({
        method: "POST",
        headers: {
          Authorization: "Bearer test_key",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "test@example.com",
          to: ["recipient@example.com"],
          subject: "Test",
          html: "<p>HTML</p>",
          headers: {
            "List-Unsubscribe": "<https://app.happyhousebills.com/settings/notifications>",
          },
        }),
      }),
    );
  });

  it("throws on missing API key from env in handler", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    const { send } = await import("../../convex/functions/email");
    await expect(
      send.handler({ auth: {} }, { to: ["t@e.com"], subject: "S", html: "H" }),
    ).rejects.toThrow("RESEND_API_KEY not configured");
  });
});
