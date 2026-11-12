import { it, expect, describe } from "vitest";
import { formatCurrency, groupByCategory, generateDailySeries } from "~/app/utils/data-visualization";

describe("data-visualization utils", () => {
  describe("formatCurrency", () => {
    it("formats positive amounts", () => {
      expect(formatCurrency(1234.56)).toBe("$1,234.56");
      expect(formatCurrency(0.99)).toBe("$0.99");
    });

    it("formats zero", () => {
      expect(formatCurrency(0)).toBe("$0.00");
    });

    it("formats large amounts", () => {
      expect(formatCurrency(1000000)).toBe("$1,000,000.00");
    });
  });

  describe("groupByCategory", () => {
    it("groups expenses by category", () => {
      const result = groupByCategory([
        { amount: 50, category: "groceries" },
        { amount: 30, category: "groceries" },
        { amount: 20, category: "utilities" },
      ]);
      expect(result).toEqual([
        { category: "groceries", amount: 80, count: 2 },
        { category: "utilities", amount: 20, count: 1 },
      ]);
    });

    it("handles empty array", () => {
      const result = groupByCategory([]);
      expect(result).toEqual([]);
    });

    it("handles single category", () => {
      const result = groupByCategory([
        { amount: 100, category: "groceries" },
      ]);
      expect(result).toEqual([
        { category: "groceries", amount: 100, count: 1 },
      ]);
    });
  });

  describe("generateDailySeries", () => {
    it("generates correct number of days", () => {
      const now = Date.now();
      const expenses = [
        { amount: 10, date: new Date(now - 2 * 24 * 60 * 60 * 1000).toISOString().split("T")[0], createdAt: now - 2 * 24 * 60 * 60 * 1000 },
      ];
      const series = generateDailySeries(expenses, 7);
      expect(series.length).toBe(7);
    });

    it("correctly places expense on right day", () => {
      const now = Date.now();
      const expenses = [
        { amount: 10, date: new Date(now - 2 * 24 * 60 * 60 * 1000).toISOString().split("T")[0], createdAt: now - 2 * 24 * 60 * 60 * 1000 },
      ];
      const series = generateDailySeries(expenses, 7);
      expect(series[4].amount).toBe(10);
    });

    it("returns zero for days without expenses", () => {
      const now = Date.now();
      const expenses = [
        { amount: 10, date: new Date(now - 5 * 24 * 60 * 60 * 1000).toISOString().split("T")[0], createdAt: now - 5 * 24 * 60 * 60 * 1000 },
      ];
      const series = generateDailySeries(expenses, 7);
      expect(series[0].amount).toBe(0);
    });

    it("sums multiple expenses on same day", () => {
      const now = Date.now();
      const day = new Date(now - 2 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
      const expenses = [
        { amount: 10, date: day, createdAt: now - 2 * 60 * 60 * 1000 },
        { amount: 5, date: day, createdAt: now - 2 * 60 * 60 * 1000 },
      ];
      const series = generateDailySeries(expenses, 7);
      expect(series[4].amount).toBe(15);
    });
  });
});