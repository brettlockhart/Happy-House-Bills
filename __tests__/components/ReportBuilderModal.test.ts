/**
 * @vitest-env happy-dom
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";
import ReportBuilderModal from "../../app/components/ReportBuilderModal.vue";

vi.mock("~/composables/useReports", () => ({
  useReports: () => ({
    generate: vi.fn(),
    isGenerating: false,
  }),
}));

vi.mock("~/composables/useReportBuilder", () => ({
  useReportBuilder: () => ({
    config: { dateRange: "month" },
    format: "csv",
    scheduleCron: "0 6 * * *",
    reportName: "",
    isScheduled: false,
    templates: [
      { id: "monthly_summary", label: "Monthly Summary", description: "Spending totals by month" },
      { id: "category_breakdown", label: "Category Breakdown", description: "Spending by category" },
      { id: "settlement_history", label: "Settlement History", description: "All settlements between members" },
      { id: "budget_variance", label: "Budget Variance", description: "Budget vs actual spending" },
      { id: "custom", label: "Custom Report", description: "Build your own report" },
    ],
  }),
}));

describe("ReportBuilderModal.vue", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("renders template selection step when visible", () => {
    const wrapper = mount(ReportBuilderModal, {
      props: { visible: true },
    });

    expect(wrapper.find(".modal-title").text()).toBe("Create Custom Report");
    expect(wrapper.findAll(".template-option")).toHaveLength(5);
  });

  it("emits close when clicking overlay", () => {
    const wrapper = mount(ReportBuilderModal, {
      props: { visible: true },
    });

    const el = wrapper.find(".modal-overlay").element as HTMLElement;
    el.dispatchEvent(new Event("click", { bubbles: true }));

    expect(wrapper.emitted("close")).toBeTruthy();
  });

  it("emits close when clicking close button", () => {
    const wrapper = mount(ReportBuilderModal, {
      props: { visible: true },
    });

    const el = wrapper.find(".modal-close").element as HTMLElement;
    el.dispatchEvent(new Event("click", { bubbles: true }));

    expect(wrapper.emitted("close")).toBeTruthy();
  });

  it("selects template and advances to config step", async () => {
    const wrapper = mount(ReportBuilderModal, {
      props: { visible: true },
    });

    // Click monthly summary template
    const el = wrapper.find("#monthly_summary").element as HTMLInputElement;
    el.checked = true;
    el.dispatchEvent(new Event("change", { bubbles: true }));

    await wrapper.vm.$nextTick();

    // Click next
    const btnEl = wrapper.find(".btn-primary").element as HTMLElement;
    btnEl.dispatchEvent(new Event("click", { bubbles: true }));

    await wrapper.vm.$nextTick();

    // Should show config step
    expect(wrapper.find(".form-label").text()).toContain("Date Range");
  });

  it("shows export button on schedule step with csv format", async () => {
    const wrapper = mount(ReportBuilderModal, {
      props: { visible: true },
    });

    // Navigate to schedule step
    const el = wrapper.find("#monthly_summary").element as HTMLInputElement;
    el.checked = true;
    el.dispatchEvent(new Event("change", { bubbles: true }));

    await wrapper.vm.$nextTick();

    const btnEl = wrapper.find(".btn-primary").element as HTMLElement;
    btnEl.dispatchEvent(new Event("click", { bubbles: true })); // config
    await wrapper.vm.$nextTick();
    btnEl.dispatchEvent(new Event("click", { bubbles: true })); // format
    await wrapper.vm.$nextTick();
    btnEl.dispatchEvent(new Event("click", { bubbles: true })); // schedule
    await wrapper.vm.$nextTick();

    // Should show export button
    expect(wrapper.find(".btn-primary").text()).toBe("Export");
  });
});