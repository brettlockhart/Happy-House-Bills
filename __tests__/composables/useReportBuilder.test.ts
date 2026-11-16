import { describe, it, expect, vi, beforeEach } from "vitest";

describe("useReportBuilder", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns correct initial state", async () => {
    const { useReportBuilder } = await import("../../app/composables/useReportBuilder");
    const result = useReportBuilder();

    expect(result.config).toBeDefined();
    expect(result.format).toBeDefined();
    expect(result.scheduleCron).toBeDefined();
    expect(result.reportName).toBeDefined();
    expect(result.isScheduled).toBeDefined();
    expect(result.templates).toBeDefined();
  });

  it("config defaults to monthly dateRange", async () => {
    const { useReportBuilder } = await import("../../app/composables/useReportBuilder");
    const result = useReportBuilder();
    expect(result.config.value.dateRange).toBe("month");
  });

  it("format defaults to csv", async () => {
    const { useReportBuilder } = await import("../../app/composables/useReportBuilder");
    const result = useReportBuilder();
    expect(result.format.value).toBe("csv");
  });

  it("scheduleCron defaults to 0 6 * * *", async () => {
    const { useReportBuilder } = await import("../../app/composables/useReportBuilder");
    const result = useReportBuilder();
    expect(result.scheduleCron.value).toBe("0 6 * * *");
  });

  it("isScheduled defaults to false", async () => {
    const { useReportBuilder } = await import("../../app/composables/useReportBuilder");
    const result = useReportBuilder();
    expect(result.isScheduled.value).toBe(false);
  });

  it("reportName defaults to empty string", async () => {
    const { useReportBuilder } = await import("../../app/composables/useReportBuilder");
    const result = useReportBuilder();
    expect(result.reportName.value).toBe("");
  });

  it("templates includes all 5 report types", async () => {
    const { useReportBuilder } = await import("../../app/composables/useReportBuilder");
    const result = useReportBuilder();
    expect(result.templates).toHaveLength(5);
    const ids = result.templates.map((t: { id: string }) => t.id);
    expect(ids).toEqual(["monthly_summary", "category_breakdown", "settlement_history", "budget_variance", "custom"]);
  });

  it("config is reactive", async () => {
    const { useReportBuilder } = await import("../../app/composables/useReportBuilder");
    const result = useReportBuilder();
    result.config.value.dateRange = "week";
    expect(result.config.value.dateRange).toBe("week");
  });

  it("format is reactive", async () => {
    const { useReportBuilder } = await import("../../app/composables/useReportBuilder");
    const result = useReportBuilder();
    result.format.value = "json";
    expect(result.format.value).toBe("json");
  });
});