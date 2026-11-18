import { computed } from "vue";
import { useConvexClient, useConvexQuery } from "convex-vue";
import { api } from "~~/convex/_generated/api";
import type { Doc, Id } from "~~/convex/_generated/dataModel";

type Report = Doc<"reports">;
type ReportId = Id<"reports">;
type ReportFormat = "csv" | "json";

export function useReports() {
  const client = useConvexClient();
  const reportsQuery = useConvexQuery(api.functions.reports.listReports, {});

  return {
    data: computed(() => (reportsQuery.data.value as Report[] | undefined) ?? []),
    isLoading: reportsQuery.isPending,
    error: reportsQuery.error,
    generate: (args: {
      name: string;
      type: string;
      config: Record<string, unknown>;
      format: string;
      scheduleCron?: string;
    }) =>
      client.mutation(api.functions.reports.createReport, {
        name: args.name,
        type: args.type as Report["type"],
        config: args.config,
        format: args.format as ReportFormat,
        scheduleCron: args.scheduleCron,
      }),
    isGenerating: false,
    delete: (args: { reportId: string }) =>
      client.mutation(api.functions.reports.deleteReport, { reportId: args.reportId as ReportId }),
    isDeleting: false,
    schedule: (args: {
      name: string;
      type: string;
      config: Record<string, unknown>;
      format: string;
      scheduleCron: string;
    }) =>
      client.mutation(api.functions.reports.scheduleReport, {
        name: args.name,
        type: args.type as Report["type"],
        config: args.config,
        format: args.format as ReportFormat,
        scheduleCron: args.scheduleCron,
      }),
    isScheduling: false,
    unschedule: (args: { reportId: string }) =>
      client.mutation(api.functions.reports.unscheduleReport, { reportId: args.reportId as ReportId }),
    isUnscheduling: false,
    getDownloadUrl: (args: { reportId: string }) =>
      client.mutation(api.functions.reports.getDownloadUrl, { reportId: args.reportId as ReportId }),
    isGettingUrl: false,
  };
}