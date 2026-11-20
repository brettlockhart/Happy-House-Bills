import { describe, it, expect } from "vitest";
import { parseTimeToMinutes, isWithinQuietHours, isTypeEnabled } from "../../app/composables/useNotificationPreferences";

describe("notificationPreferences helpers", () => {
  describe("parseTimeToMinutes", () => {
    it("parses HH:MM to minutes", () => {
      expect(parseTimeToMinutes("22:00")).toBe(1320);
      expect(parseTimeToMinutes("08:00")).toBe(480);
      expect(parseTimeToMinutes("00:00")).toBe(0);
      expect(parseTimeToMinutes("23:59")).toBe(1439);
    });
  });

  describe("isWithinQuietHours", () => {
    it("returns false when no quiet hours set", () => {
      const prefs = { quietHoursStart: undefined, quietHoursEnd: undefined };
      const now = new Date(2026, 10, 20, 10, 0);
      expect(isWithinQuietHours(prefs, now)).toBe(false);
    });

    it("returns false when start and end are the same", () => {
      const prefs = { quietHoursStart: "22:00", quietHoursEnd: "22:00" };
      const now = new Date(2026, 10, 20, 10, 0);
      expect(isWithinQuietHours(prefs, now)).toBe(false);
    });

    it("detects same-day quiet hours (09:00 to 17:00)", () => {
      const prefs = { quietHoursStart: "09:00", quietHoursEnd: "17:00" };
      const within = new Date(2026, 10, 20, 10, 0);
      const outside = new Date(2026, 10, 20, 20, 0);
      expect(isWithinQuietHours(prefs, within)).toBe(true);
      expect(isWithinQuietHours(prefs, outside)).toBe(false);
    });

    it("detects overnight quiet hours (22:00 to 08:00)", () => {
      const prefs = { quietHoursStart: "22:00", quietHoursEnd: "08:00" };
      const withinMorning = new Date(2026, 10, 20, 23, 30);
      const withinNight = new Date(2026, 10, 21, 2, 0);
      const outside = new Date(2026, 10, 20, 12, 0);
      expect(isWithinQuietHours(prefs, withinMorning)).toBe(true);
      expect(isWithinQuietHours(prefs, withinNight)).toBe(true);
      expect(isWithinQuietHours(prefs, outside)).toBe(false);
    });

    it("handles edge case at start boundary", () => {
      const prefs = { quietHoursStart: "22:00", quietHoursEnd: "08:00" };
      const atStart = new Date(2026, 10, 20, 22, 0);
      expect(isWithinQuietHours(prefs, atStart)).toBe(true);
    });

    it("handles edge case at end boundary", () => {
      const prefs = { quietHoursStart: "22:00", quietHoursEnd: "08:00" };
      const atEnd = new Date(2026, 10, 20, 8, 0);
      expect(isWithinQuietHours(prefs, atEnd)).toBe(false);
    });
  });

  describe("isTypeEnabled", () => {
    it("returns true when preference is undefined (default enabled)", () => {
      const prefs = {};
      expect(isTypeEnabled(prefs, "expense_pending")).toBe(true);
      expect(isTypeEnabled(prefs, "expense_approved")).toBe(true);
      expect(isTypeEnabled(prefs, "expense_rejected")).toBe(true);
      expect(isTypeEnabled(prefs, "settlement_created")).toBe(true);
      expect(isTypeEnabled(prefs, "invite_sent")).toBe(true);
      expect(isTypeEnabled(prefs, "goal_alert")).toBe(true);
    });

    it("returns false when explicitly disabled", () => {
      const prefs = { expensePending: false, expenseApproved: false };
      expect(isTypeEnabled(prefs, "expense_pending")).toBe(false);
      expect(isTypeEnabled(prefs, "expense_approved")).toBe(false);
      expect(isTypeEnabled(prefs, "expense_rejected")).toBe(true);
    });

    it("returns true for goal_alert always", () => {
      const prefs = { expensePending: false };
      expect(isTypeEnabled(prefs, "goal_alert")).toBe(true);
    });
  });
});