/**
 * @vitest-env happy-dom
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { computed } from "vue";
import { mount } from "@vue/test-utils";
import AnalyticsDashboard from "../../app/components/AnalyticsDashboard.vue";

const { mockBudgets, mockInsights } = vi.hoisted(() => ({
  mockBudgets: { value: [] as unknown[] },
  mockInsights: { value: [] as unknown[] },
}));

vi.mock("~/composables/useAnalytics", () => ({
  useAnalytics: () => ({
    period: computed(() => "month"),
    totalSpent: computed(() => 500),
    averagePerExpense: computed(() => 50),
    expenseCount: computed(() => 10),
    categories: computed(() => [
      { category: "Groceries", amount: 200 },
      { category: "Transport", amount: 150 },
      { category: "Dining", amount: 150 },
    ]),
    topCategory: computed(() => ({ category: "Groceries", amount: 200 })),
    dailyTotals: computed(() => []),
    forecastAmount: computed(() => 600),
    forecastConfidence: computed(() => "high"),
    insightsList: computed(() => mockInsights.value),
    isPending: computed(() => false),
    error: computed(() => null),
    setPeriod: vi.fn(),
  }),
}));

vi.mock("~/composables/useAdvancedFeatures", () => ({
  useBudgets: () => ({
    data: computed(() => mockBudgets.value),
    isLoading: computed(() => false),
  }),
}));

vi.mock("~/components/ReportBuilderModal.vue", () => ({
  default: {
    name: "ReportBuilderModal",
    render: () => null,
    setup() {
      return { visible: false };
    },
  },
}));

describe("AnalyticsDashboard.vue", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockBudgets.value = [
      { _id: "bud_1", category: "Groceries", amount: 25000, period: "monthly", alertThreshold: 80, alertSent: false },
      { _id: "bud_2", category: "Transport", amount: 20000, period: "monthly", alertThreshold: 80, alertSent: true },
      { _id: "bud_3", category: "Dining", amount: 10000, period: "monthly", alertThreshold: 80, alertSent: false },
    ];
    mockInsights.value = [];
  });

  it("renders summary grid with correct values", () => {
    const comp = mount(AnalyticsDashboard);
    expect(comp.find(".summary-card").exists()).toBe(true);
    expect(comp.text()).toContain("Total Spent");
    expect(comp.text()).toContain("$500.00");
  });

  it("renders category breakdown chart", () => {
    const comp = mount(AnalyticsDashboard);
    expect(comp.find(".category-list").exists()).toBe(true);
    expect(comp.text()).toContain("Groceries");
    expect(comp.text()).toContain("$200.00");
  });

  it("renders budget progress section with monthly budgets", () => {
    const comp = mount(AnalyticsDashboard);
    expect(comp.find(".budget-list").exists()).toBe(true);
  });

  it("shows green bar for budget < 80%", () => {
    const comp = mount(AnalyticsDashboard);
    const bars = comp.findAll(".budget-bar-fill");
    const transportBar = bars.find(b => b.element.classList.contains("hhb-progress-fill--ok"));
    expect(transportBar).toBeDefined();
  });

  it("shows yellow bar for budget 80-100%", () => {
    const comp = mount(AnalyticsDashboard);
    const bars = comp.findAll(".budget-bar-fill");
    const diningBar = bars.find(b => b.element.classList.contains("hhb-progress-fill--warn"));
    expect(diningBar).toBeDefined();
  });

  it("shows red bar for budget >= 100%", () => {
    const comp = mount(AnalyticsDashboard);
    const bars = comp.findAll(".budget-bar-fill");
    const overBudgetBar = bars.find(b => b.element.classList.contains("hhb-progress-fill--over"));
    expect(overBudgetBar).toBeDefined();
  });

  it("displays 'Over budget' warning when over 100%", () => {
    const comp = mount(AnalyticsDashboard);
    expect(comp.text()).toContain("Over budget");
  });

  it("displays 'Near limit' warning when 80-100%", () => {
    const comp = mount(AnalyticsDashboard);
    expect(comp.text()).toContain("Near limit");
  });

  it("filters budgets by monthly period only", () => {
    const comp = mount(AnalyticsDashboard);
    const rows = comp.findAll(".budget-row");
    expect(rows.length).toBe(3);
  });

  it("handles empty budgets gracefully", () => {
    mockBudgets.value = [];
    const comp = mount(AnalyticsDashboard);
    expect(comp.find(".budget-list").exists()).toBe(false);
  });

  it("renders insights list", () => {
    mockInsights.value = [{ type: "info", severity: "info", message: "Test insight" }];
    const comp = mount(AnalyticsDashboard);
    expect(comp.find(".insights-list").exists()).toBe(true);
    expect(comp.text()).toContain("Test insight");
    mockInsights.value = [];
  });
});