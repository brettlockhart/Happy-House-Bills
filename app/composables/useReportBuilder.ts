import { ref } from "vue";

interface ReportConfig {
  dateRange?: string;
  dateFrom?: string;
  dateTo?: string;
}

interface ReportTemplate {
  id: string;
  label: string;
  description: string;
}

export function useReportBuilder() {
  const config = ref<ReportConfig>({
    dateRange: "month",
  });

  const format = ref<"csv" | "json">("csv");

  const scheduleCron = ref<string>("0 6 * * *");

  const reportName = ref<string>("");

  const isScheduled = ref(false);

  const templates: ReportTemplate[] = [
    { id: "monthly_summary", label: "Monthly Summary", description: "Spending totals by month" },
    { id: "category_breakdown", label: "Category Breakdown", description: "Spending by category" },
    { id: "settlement_history", label: "Settlement History", description: "All settlements between members" },
    { id: "budget_variance", label: "Budget Variance", description: "Budget vs actual spending" },
    { id: "custom", label: "Custom Report", description: "Build your own report" },
  ];

  return {
    config,
    format,
    scheduleCron,
    reportName,
    isScheduled,
    templates,
  };
}