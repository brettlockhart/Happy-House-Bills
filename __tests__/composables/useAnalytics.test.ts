import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("convex-vue", () => ({
  useConvexQuery: vi.fn((_api, _args) => ({
    data: { value: null },
    isPending: { value: false },
    error: { value: null },
  })),
}));

vi.mock("~/convex/_generated/api", () => ({
  api: {
    functions: {
      analytics: {
        summary: {},
      },
      predictions: {
        forecast: {},
      },
      insights: {
        insights: {},
      },
    },
  },
}));

describe("useAnalytics", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns correct initial state", async () => {
    const { useAnalytics } = await import("../../app/composables/useAnalytics");
    const result = useAnalytics();

    expect(result.period).toBeDefined();
    expect(result.period.value).toBe("month");
    expect(result.totalSpent).toBeDefined();
    expect(result.averagePerExpense).toBeDefined();
    expect(result.expenseCount).toBeDefined();
    expect(result.categories).toBeDefined();
    expect(result.topCategory).toBeDefined();
    expect(result.dailyTotals).toBeDefined();
    expect(result.forecastAmount).toBeDefined();
    expect(result.forecastConfidence).toBeDefined();
    expect(result.insightsList).toBeDefined();
    expect(result.isPending).toBeDefined();
    expect(result.error).toBeDefined();
    expect(result.setPeriod).toBeDefined();
  });

  it("setPeriod updates period", async () => {
    const { useAnalytics } = await import("../../app/composables/useAnalytics");
    const result = useAnalytics();

    result.setPeriod("week");
    expect(result.period.value).toBe("week");

    result.setPeriod("quarter");
    expect(result.period.value).toBe("quarter");

    result.setPeriod("year");
    expect(result.period.value).toBe("year");
  });

  it("computes totalSpent from summary", async () => {
    const { useAnalytics } = await import("../../app/composables/useAnalytics");
    const { useConvexQuery } = await import("convex-vue");

    const mockSummary = {
      data: { value: { totalSpent: 123.45 } },
      isPending: false,
      error: null,
    };
    (useConvexQuery as vi.Mock).mockReturnValueOnce(mockSummary);
    (useConvexQuery as vi.Mock).mockReturnValueOnce({ data: { value: null }, isPending: false, error: null });
    (useConvexQuery as vi.Mock).mockReturnValueOnce({ data: { value: null }, isPending: false, error: null });

    const result = useAnalytics();
    expect(result.totalSpent.value).toBe(123.45);
  });

  it("computes averagePerExpense from summary", async () => {
    const { useAnalytics } = await import("../../app/composables/useAnalytics");
    const { useConvexQuery } = await import("convex-vue");

    const mockSummary = {
      data: { value: { averagePerExpense: 45.67 } },
      isPending: false,
      error: null,
    };
    (useConvexQuery as vi.Mock).mockReturnValueOnce(mockSummary);
    (useConvexQuery as vi.Mock).mockReturnValueOnce({ data: { value: null }, isPending: false, error: null });
    (useConvexQuery as vi.Mock).mockReturnValueOnce({ data: { value: null }, isPending: false, error: null });

    const result = useAnalytics();
    expect(result.averagePerExpense.value).toBe(45.67);
  });

  it("computes expenseCount from summary", async () => {
    const { useAnalytics } = await import("../../app/composables/useAnalytics");
    const { useConvexQuery } = await import("convex-vue");

    const mockSummary = {
      data: { value: { expenseCount: 10 } },
      isPending: false,
      error: null,
    };
    (useConvexQuery as vi.Mock).mockReturnValueOnce(mockSummary);
    (useConvexQuery as vi.Mock).mockReturnValueOnce({ data: { value: null }, isPending: false, error: null });
    (useConvexQuery as vi.Mock).mockReturnValueOnce({ data: { value: null }, isPending: false, error: null });

    const result = useAnalytics();
    expect(result.expenseCount.value).toBe(10);
  });

  it("computes categories from summary", async () => {
    const { useAnalytics } = await import("../../app/composables/useAnalytics");
    const { useConvexQuery } = await import("convex-vue");

    const mockSummary = {
      data: { value: { categories: [{ category: "groceries", amount: 100 }, { category: "utilities", amount: 50 }] } },
      isPending: false,
      error: null,
    };
    (useConvexQuery as vi.Mock).mockReturnValueOnce(mockSummary);
    (useConvexQuery as vi.Mock).mockReturnValueOnce({ data: { value: null }, isPending: false, error: null });
    (useConvexQuery as vi.Mock).mockReturnValueOnce({ data: { value: null }, isPending: false, error: null });

    const result = useAnalytics();
    expect(result.categories.value).toEqual([
      { category: "groceries", amount: 100 },
      { category: "utilities", amount: 50 },
    ]);
  });

  it("computes topCategory from summary", async () => {
    const { useAnalytics } = await import("../../app/composables/useAnalytics");
    const { useConvexQuery } = await import("convex-vue");

    const mockSummary = {
      data: { value: { topCategory: { category: "groceries", amount: 100 } } },
      isPending: false,
      error: null,
    };
    (useConvexQuery as vi.Mock).mockReturnValueOnce(mockSummary);
    (useConvexQuery as vi.Mock).mockReturnValueOnce({ data: { value: null }, isPending: false, error: null });
    (useConvexQuery as vi.Mock).mockReturnValueOnce({ data: { value: null }, isPending: false, error: null });

    const result = useAnalytics();
    expect(result.topCategory.value).toEqual({ category: "groceries", amount: 100 });
  });

  it("computes dailyTotals from summary", async () => {
    const { useAnalytics } = await import("../../app/composables/useAnalytics");
    const { useConvexQuery } = await import("convex-vue");

    const mockSummary = {
      data: { value: { dailyTotals: [{ date: "2024-01-15", amount: 50 }, { date: "2024-01-16", amount: 30 }] } },
      isPending: false,
      error: null,
    };
    (useConvexQuery as vi.Mock).mockReturnValueOnce(mockSummary);
    (useConvexQuery as vi.Mock).mockReturnValueOnce({ data: { value: null }, isPending: false, error: null });
    (useConvexQuery as vi.Mock).mockReturnValueOnce({ data: { value: null }, isPending: false, error: null });

    const result = useAnalytics();
    expect(result.dailyTotals.value).toEqual([
      { date: "2024-01-15", amount: 50 },
      { date: "2024-01-16", amount: 30 },
    ]);
  });

  it("computes forecastAmount from forecast", async () => {
    const { useAnalytics } = await import("../../app/composables/useAnalytics");
    const { useConvexQuery } = await import("convex-vue");

    (useConvexQuery as vi.Mock).mockReturnValueOnce({ data: { value: null }, isPending: { value: false }, error: { value: null } });
    const mockForecast = {
      data: { value: { forecast: 250.75, confidence: "medium" } },
      isPending: { value: false },
      error: { value: null },
    };
    (useConvexQuery as vi.Mock).mockReturnValueOnce(mockForecast);
    (useConvexQuery as vi.Mock).mockReturnValueOnce({ data: { value: null }, isPending: { value: false }, error: { value: null } });

    const result = useAnalytics();
    expect(result.forecastAmount.value).toBe(250.75);
    expect(result.forecastConfidence.value).toBe("medium");
  });

  it("computes insightsList from insights", async () => {
    const { useAnalytics } = await import("../../app/composables/useAnalytics");
    const { useConvexQuery } = await import("convex-vue");

    (useConvexQuery as vi.Mock).mockReturnValueOnce({ data: { value: null }, isPending: { value: false }, error: { value: null } });
    (useConvexQuery as vi.Mock).mockReturnValueOnce({ data: { value: null }, isPending: { value: false }, error: { value: null } });
    const mockInsights = {
      data: { value: { insights: [{ type: "spending_pattern", severity: "info", message: "Test insight" }] } },
      isPending: { value: false },
      error: { value: null },
    };
    (useConvexQuery as vi.Mock).mockReturnValueOnce(mockInsights);

    const result = useAnalytics();
    expect(result.insightsList.value).toEqual([{ type: "spending_pattern", severity: "info", message: "Test insight" }]);
  });

  it("computes isPending from any pending query", async () => {
    const { useAnalytics } = await import("../../app/composables/useAnalytics");
    const { useConvexQuery } = await import("convex-vue");

    const mockSummary = { data: { value: null }, isPending: { value: true }, error: { value: null } };
    const mockForecast = { data: { value: null }, isPending: { value: false }, error: { value: null } };
    const mockInsights = { data: { value: null }, isPending: { value: false }, error: { value: null } };
    (useConvexQuery as vi.Mock).mockReturnValueOnce(mockSummary);
    (useConvexQuery as vi.Mock).mockReturnValueOnce(mockForecast);
    (useConvexQuery as vi.Mock).mockReturnValueOnce(mockInsights);

    const result = useAnalytics();
    expect(result.isPending.value).toBe(true);
  });

  it("computes error from any errored query", async () => {
    const { useAnalytics } = await import("../../app/composables/useAnalytics");
    const { useConvexQuery } = await import("convex-vue");

    const mockSummary = { data: { value: null }, isPending: { value: false }, error: { value: "Test error" } };
    const mockForecast = { data: { value: null }, isPending: { value: false }, error: { value: null } };
    const mockInsights = { data: { value: null }, isPending: { value: false }, error: { value: null } };
    (useConvexQuery as vi.Mock).mockReturnValueOnce(mockSummary);
    (useConvexQuery as vi.Mock).mockReturnValueOnce(mockForecast);
    (useConvexQuery as vi.Mock).mockReturnValueOnce(mockInsights);

    const result = useAnalytics();
    expect(result.error.value).toBe("Test error");
  });

  it("falls back to defaults when data is undefined", async () => {
    const { useAnalytics } = await import("../../app/composables/useAnalytics");
    const { useConvexQuery } = await import("convex-vue");

    const mockSummary = { data: { value: undefined }, isPending: { value: false }, error: { value: null } };
    const mockForecast = { data: { value: undefined }, isPending: { value: false }, error: { value: null } };
    const mockInsights = { data: { value: undefined }, isPending: { value: false }, error: { value: null } };
    (useConvexQuery as vi.Mock).mockReturnValueOnce(mockSummary);
    (useConvexQuery as vi.Mock).mockReturnValueOnce(mockForecast);
    (useConvexQuery as vi.Mock).mockReturnValueOnce(mockInsights);

    const result = useAnalytics();
    expect(result.totalSpent.value).toBe(0);
    expect(result.averagePerExpense.value).toBe(0);
    expect(result.expenseCount.value).toBe(0);
    expect(result.categories.value).toEqual([]);
    expect(result.topCategory.value).toBeNull();
    expect(result.dailyTotals.value).toEqual([]);
    expect(result.forecastAmount.value).toBe(0);
    expect(result.forecastConfidence.value).toBe("low");
    expect(result.insightsList.value).toEqual([]);
  });

  it("forecastPeriod maps week to month for forecast query", async () => {
    const { useAnalytics } = await import("../../app/composables/useAnalytics");
    const { useConvexQuery } = await import("convex-vue");

    const mockSummary = { data: { value: null }, isPending: { value: false }, error: { value: null } };
    const mockForecast = { data: { value: { forecast: 100, confidence: "medium" } }, isPending: { value: false }, error: { value: null } };
    const mockInsights = { data: { value: null }, isPending: { value: false }, error: { value: null } };
    (useConvexQuery as vi.Mock).mockReturnValueOnce(mockSummary);
    (useConvexQuery as vi.Mock).mockReturnValueOnce(mockForecast);
    (useConvexQuery as vi.Mock).mockReturnValueOnce(mockInsights);

    const result = useAnalytics();
    result.setPeriod("week");
    expect(result.period.value).toBe("week");

    // The second call (index 1) is the forecast query with args getter
    const forecastCall = (useConvexQuery as vi.Mock).mock.calls[1];
    expect(forecastCall).toBeDefined();
    // The second arg is a getter function; call it to get the args
    const forecastArgs = forecastCall![1]();
    expect(forecastArgs).toEqual({ period: "month" });
  });

  it("error priority: summary > forecast > insights", async () => {
    const { useAnalytics } = await import("../../app/composables/useAnalytics");
    const { useConvexQuery } = await import("convex-vue");

    const mockSummary = { data: { value: null }, isPending: { value: false }, error: { value: "summary error" } };
    const mockForecast = { data: { value: null }, isPending: { value: false }, error: { value: "forecast error" } };
    const mockInsights = { data: { value: null }, isPending: { value: false }, error: { value: "insights error" } };
    (useConvexQuery as vi.Mock).mockReturnValueOnce(mockSummary);
    (useConvexQuery as vi.Mock).mockReturnValueOnce(mockForecast);
    (useConvexQuery as vi.Mock).mockReturnValueOnce(mockInsights);

    const result = useAnalytics();
    expect(result.error.value).toBe("summary error");
  });

  it("forecast pending state", async () => {
    const { useAnalytics } = await import("../../app/composables/useAnalytics");
    const { useConvexQuery } = await import("convex-vue");

    const mockSummary = { data: { value: null }, isPending: { value: false }, error: { value: null } };
    const mockForecast = { data: { value: null }, isPending: { value: true }, error: { value: null } };
    const mockInsights = { data: { value: null }, isPending: { value: false }, error: { value: null } };
    (useConvexQuery as vi.Mock).mockReturnValueOnce(mockSummary);
    (useConvexQuery as vi.Mock).mockReturnValueOnce(mockForecast);
    (useConvexQuery as vi.Mock).mockReturnValueOnce(mockInsights);

    const result = useAnalytics();
    expect(result.isPending.value).toBe(true);
  });

  it("insights pending state", async () => {
    const { useAnalytics } = await import("../../app/composables/useAnalytics");
    const { useConvexQuery } = await import("convex-vue");

    const mockSummary = { data: { value: null }, isPending: { value: false }, error: { value: null } };
    const mockForecast = { data: { value: null }, isPending: { value: false }, error: { value: null } };
    const mockInsights = { data: { value: null }, isPending: { value: true }, error: { value: null } };
    (useConvexQuery as vi.Mock).mockReturnValueOnce(mockSummary);
    (useConvexQuery as vi.Mock).mockReturnValueOnce(mockForecast);
    (useConvexQuery as vi.Mock).mockReturnValueOnce(mockInsights);

    const result = useAnalytics();
    expect(result.isPending.value).toBe(true);
  });
});