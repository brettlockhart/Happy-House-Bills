import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockMutation, mockAction } = vi.hoisted(() => ({
  mockMutation: vi.fn(),
  mockAction: vi.fn(),
}));

vi.mock("convex-vue", () => ({
  useConvexQuery: vi.fn(() => ({
    data: { value: [] },
    isPending: { value: false },
    error: { value: null },
  })),
  useConvexClient: vi.fn(() => ({
    mutation: mockMutation,
    action: mockAction,
  })),
}));

vi.mock("~~/convex/_generated/api", () => ({
  api: {
    functions: {
      reports: {
        listReports: {},
        createReport: {},
        deleteReport: {},
        scheduleReport: {},
        unscheduleReport: {},
        getDownloadUrl: {},
      },
    },
  },
}));

describe("useReports", () => {
  beforeEach(() => {
    mockMutation.mockReset();
    mockAction.mockReset();
  });

  it("returns correct initial state", async () => {
    const { useReports } = await import("../../app/composables/useReports");
    const result = useReports();
    expect(result.data).toBeDefined();
    expect(result.isLoading).toBeDefined();
    expect(result.error).toBeDefined();
    expect(result.isGenerating).toBe(false);
    expect(result.isDeleting).toBe(false);
    expect(result.isScheduling).toBe(false);
    expect(result.isGettingUrl).toBe(false);
  });

  it("data defaults to empty array when undefined", async () => {
    const { useConvexQuery } = await import("convex-vue");
    (useConvexQuery as vi.Mock).mockReturnValueOnce({ data: { value: undefined }, isPending: { value: false }, error: { value: null } });
    const { useReports } = await import("../../app/composables/useReports");
    const result = useReports();
    expect(result.data.value).toEqual([]);
  });

  it("isLoading reflects pending state", async () => {
    const { useConvexQuery } = await import("convex-vue");
    (useConvexQuery as vi.Mock).mockReturnValueOnce({ data: { value: null }, isPending: { value: true }, error: { value: null } });
    const { useReports } = await import("../../app/composables/useReports");
    const result = useReports();
    expect(result.isLoading.value).toBe(true);
  });

  it("error reflects query error", async () => {
    const { useConvexQuery } = await import("convex-vue");
    (useConvexQuery as vi.Mock).mockReturnValueOnce({ data: { value: null }, isPending: { value: false }, error: { value: "Query failed" } });
    const { useReports } = await import("../../app/composables/useReports");
    const result = useReports();
    expect(result.error.value).toBe("Query failed");
  });

  it("data reflects query result", async () => {
    const { useConvexQuery } = await import("convex-vue");
    const mockReports = [{ _id: "r1", name: "Report 1" }, { _id: "r2", name: "Report 2" }];
    (useConvexQuery as vi.Mock).mockReturnValueOnce({ data: { value: mockReports }, isPending: { value: false }, error: { value: null } });
    const { useReports } = await import("../../app/composables/useReports");
    const result = useReports();
    expect(result.data.value).toEqual(mockReports);
  });

  it("generate calls createReport with mapped args", async () => {
    mockMutation.mockResolvedValue({ id: "mock_id", downloadUrl: "https://example.com/r.csv" });
    const { api } = await import("~~/convex/_generated/api");
    const { useReports } = await import("../../app/composables/useReports");
    const result = useReports();
    await result.generate({ name: "Monthly", type: "monthly_summary", config: { dateRange: "month" }, format: "csv" });
    expect(mockMutation).toHaveBeenCalledTimes(1);
    expect(mockMutation).toHaveBeenCalledWith(api.functions.reports.createReport, {
      name: "Monthly",
      type: "monthly_summary",
      config: { dateRange: "month" },
      format: "csv",
      scheduleCron: undefined,
    });
  });

  it("delete calls deleteReport with reportId", async () => {
    mockMutation.mockResolvedValue({ success: true });
    const { api } = await import("~~/convex/_generated/api");
    const { useReports } = await import("../../app/composables/useReports");
    const result = useReports();
    await result.delete({ reportId: "report1" });
    expect(mockMutation).toHaveBeenCalledWith(api.functions.reports.deleteReport, { reportId: "report1" });
  });

  it("schedule calls scheduleReport with scheduleCron", async () => {
    mockMutation.mockResolvedValue({ id: "mock_id" });
    const { api } = await import("~~/convex/_generated/api");
    const { useReports } = await import("../../app/composables/useReports");
    const result = useReports();
    await result.schedule({ name: "Scheduled", type: "category_breakdown", config: {}, format: "json", scheduleCron: "0 6 * * *" });
    expect(mockMutation).toHaveBeenCalledWith(api.functions.reports.scheduleReport, {
      name: "Scheduled",
      type: "category_breakdown",
      config: {},
      format: "json",
      scheduleCron: "0 6 * * *",
    });
  });

  it("unschedule calls unscheduleReport with reportId", async () => {
    mockMutation.mockResolvedValue({ success: true });
    const { api } = await import("~~/convex/_generated/api");
    const { useReports } = await import("../../app/composables/useReports");
    const result = useReports();
    await result.unschedule({ reportId: "report1" });
    expect(mockMutation).toHaveBeenCalledWith(api.functions.reports.unscheduleReport, { reportId: "report1" });
  });

  it("getDownloadUrl returns mutation result", async () => {
    mockMutation.mockResolvedValue({ downloadUrl: "https://example.com/signed?expires=123" });
    const { api } = await import("~~/convex/_generated/api");
    const { useReports } = await import("../../app/composables/useReports");
    const result = useReports();
    const res = await result.getDownloadUrl({ reportId: "report1" });
    expect(res.downloadUrl).toBe("https://example.com/signed?expires=123");
    expect(mockMutation).toHaveBeenCalledWith(api.functions.reports.getDownloadUrl, { reportId: "report1" });
  });
});