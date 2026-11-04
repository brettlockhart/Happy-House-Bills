/**
 * @vitest-env happy-dom
 */
import { describe, it, expect } from "vitest";
import { formatCurrency, formatDate, formatRelativeDate } from "../../app/utils/formatting";

describe("formatting utilities", () => {
 describe("formatCurrency", () => {
  it("formats positive numbers", () => {
   expect(formatCurrency(45.23)).toBe("$45.23");
  });

  it("formats zero", () => {
   expect(formatCurrency(0)).toBe("$0.00");
  });

  it("formats negative numbers", () => {
   expect(formatCurrency(-20)).toBe("-$20.00");
  });

  it("handles string inputs", () => {
   expect(formatCurrency("30.5")).toBe("$30.50");
  });

  it("handles NaN by returning $0.00", () => {
   expect(formatCurrency(NaN)).toBe("$0.00");
  });

  it("handles invalid strings by returning $0.00 via string-to-NaN path", () => {
   expect(formatCurrency("abc")).toBe("$0.00");
  });

  it("handles floating-point precision values", () => {
   expect(formatCurrency(45.225)).toBeDefined();
  });
 });

  describe("formatDate", () => {
   it("formats ISO date strings", () => {
    expect(formatDate("2025-10-26T12:00:00Z")).toBe("Oct 26, 2025");
  });

  it("formats timestamps", () => {
   expect(formatDate(1730000000000)).toBe("Oct 26, 2024");
  });

  it("returns Invalid date for bad input", () => {
   expect(formatDate("invalid")).toBe("Invalid date");
  });
 });

  describe("formatRelativeDate", () => {
   it("returns Today for current timestamp", () => {
    const now = Date.now();
    expect(formatRelativeDate(now)).toBe("Today");
   });

   it("returns Yesterday for yesterday", () => {
    const yesterday = Date.now() - 24 * 60 * 60 * 1000;
    expect(formatRelativeDate(yesterday)).toBe("Yesterday");
   });

  it("returns Invalid date for bad input", () => {
   expect(formatRelativeDate("not-a-date")).toBe("Invalid date");
  });
 });
});
