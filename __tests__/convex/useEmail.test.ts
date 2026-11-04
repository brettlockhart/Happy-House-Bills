import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("convex-vue", () => ({
  useConvexClient: vi.fn(),
}));

vi.mock("~/utils/email-templates", () => ({
  emailSubjects: {
    invite: "Invitation",
    expenseNotification: "New Expense",
    settlementNotification: "Settlement",
    expenseApproved: "Expense Approved",
    expenseRejected: "Expense Rejected",
  },
  EmailType: "",
}));

const mockClient = {
  action: vi.fn(),
};

const { useConvexClient } = await import("convex-vue");
(useConvexClient as unknown as ReturnType<typeof vi.fn>).mockReturnValue(mockClient);

const { useEmail } = await import("../../app/composables/useEmail");

describe("useEmail composable", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    (useConvexClient as unknown as ReturnType<typeof vi.fn>).mockReturnValue(mockClient);
  });

  describe("getDefaultSubject", () => {
    it("returns correct subject for each email type", () => {
      const { getDefaultSubject } = useEmail();

      expect(getDefaultSubject("invite")).toBe("Invitation");
      expect(getDefaultSubject("expenseNotification")).toBe("New Expense");
      expect(getDefaultSubject("settlementNotification")).toBe("Settlement");
      expect(getDefaultSubject("expenseApproved")).toBe("Expense Approved");
      expect(getDefaultSubject("expenseRejected")).toBe("Expense Rejected");
    });
  });

  describe("getDefaultSettings", () => {
    it("returns default email settings with all true", () => {
      const { getDefaultSettings } = useEmail();
      const settings = getDefaultSettings();

      expect(settings).toEqual({
        expenseNotifications: true,
        settlementNotifications: true,
        weeklySummary: true,
        securityAlerts: true,
      });

      expect(settings).not.toBe(getDefaultSettings());
    });
  });

  describe("hasUnsubscribed", () => {
    it("returns true when settings is null", () => {
      const { hasUnsubscribed } = useEmail();
      expect(hasUnsubscribed(null)).toBe(true);
    });

    it("returns true when settings is undefined", () => {
      const { hasUnsubscribed } = useEmail();
      expect(hasUnsubscribed(undefined)).toBe(true);
    });

    it("returns false when settings object provided", () => {
      const { hasUnsubscribed } = useEmail();
      expect(hasUnsubscribed({ expenseNotifications: false, settlementNotifications: true, weeklySummary: true, securityAlerts: true })).toBe(false);
    });
  });

  describe("isSendingEmail", () => {
    it("returns false initially", () => {
      const { isSendingEmail } = useEmail();
      expect(isSendingEmail.value).toBe(false);
    });
  });

  describe("error", () => {
    it("is null initially", () => {
      const { error } = useEmail();
      expect(error.value).toBeNull();
    });
  });
});
