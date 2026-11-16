/**
 * @vitest-env happy-dom
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";

const { mockInsights } = vi.hoisted(() => ({
  mockInsights: { value: [] as { type: string; severity: string; message: string }[] },
}));

vi.mock("~/composables/useAnalytics", async () => {
  const { computed } = await import("vue");
  return {
    useAnalytics: () => ({
      isPending: computed(() => false),
      error: computed(() => null),
      insightsList: computed(() => mockInsights.value),
    }),
  };
});

vi.mock("~/components/ReportBuilderModal.vue", () => ({
  default: {
    name: "ReportBuilderModal",
    render: () => null,
  },
}));

describe("InsightsPanel.vue", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockInsights.value = [];
  });

  it("renders panel with no insights", async () => {
    const { default: InsightsPanel } = await import("../../app/components/InsightsPanel.vue");
    const wrapper = mount(InsightsPanel);
    expect(wrapper.text()).toContain("No insights available.");
    expect(wrapper.find(".error-state").exists()).toBe(false);
  });

  it("renders insights list with items", async () => {
    mockInsights.value = [
      { type: "spending_pattern", severity: "info", message: "High spending on groceries" },
    ];
    const { default: InsightsPanel } = await import("../../app/components/InsightsPanel.vue");
    const wrapper = mount(InsightsPanel);
    expect(wrapper.find(".insights-list").exists()).toBe(true);
    expect(wrapper.text()).toContain("High spending on groceries");
  });

  it("renders warning and positive severity classes", async () => {
    mockInsights.value = [
      { type: "warning", severity: "warning", message: "Test warning" },
      { type: "positive", severity: "positive", message: "Test positive" },
    ];
    const { default: InsightsPanel } = await import("../../app/components/InsightsPanel.vue");
    const wrapper = mount(InsightsPanel);
    const items = wrapper.findAll(".insight-item");
    expect(items.length).toBe(2);
    expect(items[0].classes()).toContain("warning");
    expect(items[1].classes()).toContain("positive");
  });

  it("renders export button when insights present", async () => {
    mockInsights.value = [{ type: "info", severity: "info", message: "Test" }];
    const { default: InsightsPanel } = await import("../../app/components/InsightsPanel.vue");
    const wrapper = mount(InsightsPanel);
    expect(wrapper.find(".export-insights-btn").exists()).toBe(true);
    expect(wrapper.find(".export-insights-btn").text()).toBe("Export Insights");
  });

  it("shows warning icon for warning severity and info icon otherwise", async () => {
    mockInsights.value = [
      { type: "warning", severity: "warning", message: "Warn" },
      { type: "info", severity: "info", message: "Info" },
    ];
    const { default: InsightsPanel } = await import("../../app/components/InsightsPanel.vue");
    const wrapper = mount(InsightsPanel);
    const icons = wrapper.findAll(".insight-icon");
    expect(icons[0].text()).toContain("⚠");
    expect(icons[1].text()).toContain("ℹ");
  });

  it("unknown severity falls back to info class", async () => {
    mockInsights.value = [{ type: "custom", severity: "critical", message: "Critical" }];
    const { default: InsightsPanel } = await import("../../app/components/InsightsPanel.vue");
    const wrapper = mount(InsightsPanel);
    const item = wrapper.find(".insight-item");
    expect(item.classes()).toContain("info");
  });
});