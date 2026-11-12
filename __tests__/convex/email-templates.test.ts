import { describe, it, expect, beforeEach, vi } from "vitest";

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

const { formatCurrency, renderInviteEmail, renderExpenseNotificationEmail, renderExpenseRejectedEmail } = await import("../../convex/functions/email");
const { emailSubjects, getEmailTypeLabel } = await import("../../app/utils/email-templates");

describe("email template functions", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_APP_URL = "https://app.happyhousebills.com";
  });

  describe("formatCurrency", () => {
    it("formats whole numbers", () => {
      expect(formatCurrency(10)).toBe("$10.00");
    });

    it("formats decimal amounts", () => {
      expect(formatCurrency(12.5)).toBe("$12.50");
    });

    it("formats amounts with cents", () => {
      expect(formatCurrency(12.99)).toBe("$12.99");
    });

    it("rounds to two decimal places", () => {
      expect(formatCurrency(12.999)).toBe("$13.00");
    });

    it("formats zero", () => {
      expect(formatCurrency(0)).toBe("$0.00");
    });

    it("formats negative amounts", () => {
      expect(formatCurrency(-50)).toBe("-$50.00");
    });

    it("formats NaN as zero", () => {
      expect(formatCurrency(NaN)).toBe("$0.00");
    });

    it("formats Infinity", () => {
      expect(formatCurrency(Infinity)).toBe("$∞");
    });
  });

  describe("template XSS protection", () => {
    it("escapes HTML in inviter name", () => {
      const html = renderInviteEmail("a@b.com", "<script>alert('x')</script>", "Org", "token");
      expect(html).toContain("&lt;script&gt;alert(&#39;x&#39;)&lt;/script&gt;");
      expect(html).not.toContain("<script>alert('x')</script>");
    });

    it("escapes HTML in category", () => {
      const html = renderExpenseNotificationEmail("exp1", "Alice", 10, "<script>alert('x')</script>", undefined);
      expect(html).toContain("&lt;script&gt;alert(&#39;x&#39;)&lt;/script&gt;");
      expect(html).not.toContain("<script>alert('x')</script>");
    });

    it("escapes HTML in reject reason", () => {
      const html = renderExpenseRejectedEmail("Bob", "exp2", 10, "groceries", "<img src=x onerror=alert(1)>");
      expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");
      expect(html).not.toContain("<img src=x onerror=alert(1)>");
    });
  });

  describe("emailSubjects", () => {
    it("has all email type subjects", () => {
      expect(emailSubjects.invite).toBe("You're invited to join Happy House Bills");
      expect(emailSubjects.expenseNotification).toBe("New expense pending your confirmation");
      expect(emailSubjects.settlementNotification).toBe("Settlement recorded");
      expect(emailSubjects.expenseApproved).toBe("Expense approved");
      expect(emailSubjects.expenseRejected).toBe("Expense rejected");
    });
  });

  describe("getEmailTypeLabel", () => {
    it("returns human-readable labels", () => {
      expect(getEmailTypeLabel("invite")).toBe("Invitation");
      expect(getEmailTypeLabel("expenseNotification")).toBe("New Expense");
      expect(getEmailTypeLabel("settlementNotification")).toBe("Settlement");
      expect(getEmailTypeLabel("expenseApproved")).toBe("Expense Approved");
      expect(getEmailTypeLabel("expenseRejected")).toBe("Expense Rejected");
    });
  });
});
