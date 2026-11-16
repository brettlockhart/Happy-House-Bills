/**
 * @vitest-env happy-dom
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { computed } from "vue";
import { mount } from "@vue/test-utils";
import ReportHistoryList from "../../app/components/ReportHistoryList.vue";

interface MockReport {
  _id: string;
  name: string;
  type: string;
  format: string;
  status: string;
  createdAt: string;
}

const { mockReports } = vi.hoisted(() => ({
  mockReports: { value: [] as MockReport[] },
}));

vi.mock("~/composables/useReports", () => ({
  useReports: () => ({
    data: computed(() => mockReports.value),
    isLoading: false,
    getDownloadUrl: vi.fn(),
    delete: vi.fn(),
    schedule: vi.fn(),
    unschedule: vi.fn(),
  }),
}));

function makeReport(overrides: Partial<MockReport> = {}): MockReport {
  return {
    _id: "report1",
    name: "Monthly Summary",
    type: "monthly_summary",
    format: "csv",
    status: "ready",
    createdAt: Date.now().toString(),
    ...overrides,
  };
}

describe("ReportHistoryList.vue", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockReports.value = [];
  });

  it("renders empty state when no reports", () => {
    const wrapper = mount(ReportHistoryList);

    expect(wrapper.find(".empty-title").text()).toBe("No reports generated yet");
    expect(wrapper.find(".empty-subtitle").text()).toContain("Create a report");
  });

  it("renders report table when reports exist", () => {
    mockReports.value = [makeReport()];

    const wrapper = mount(ReportHistoryList);

    expect(wrapper.find(".report-table").exists()).toBe(true);
    expect(wrapper.findAll(".report-row")).toHaveLength(1);
  });

  it("shows download button for ready reports", () => {
    mockReports.value = [makeReport()];

    const wrapper = mount(ReportHistoryList);

    const downloadBtn = wrapper.find(".btn-secondary.btn-small");
    expect(downloadBtn.text()).toBe("Download");
    expect(downloadBtn.attributes("disabled")).toBeUndefined();
  });

  it("shows delete button", () => {
    mockReports.value = [makeReport()];

    const wrapper = mount(ReportHistoryList);

    const deleteBtn = wrapper.find(".btn-danger.btn-small");
    expect(deleteBtn.text()).toBe("Delete");
  });

  it("shows opening state when downloading", async () => {
    mockReports.value = [makeReport()];

    const wrapper = mount(ReportHistoryList);

    // Trigger download
    const downloadBtn = wrapper.find(".btn-secondary.btn-small").element as HTMLElement;
    downloadBtn.dispatchEvent(new Event("click", { bubbles: true }));

    await wrapper.vm.$nextTick();

    expect(wrapper.find(".btn-secondary.btn-small").text()).toBe("Opening...");
  });
});