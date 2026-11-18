<script setup lang="ts">
import { computed, ref } from "vue";
import { useReports } from "~/composables/useReports";
import type { Doc } from "~~/convex/_generated/dataModel";

type Report = Doc<"reports">;

const emit = defineEmits<{
  (e: "delete", reportId: string): void;
}>();

const {
  data: reportsData,
  isLoading: reportsIsLoading,
  getDownloadUrl,
} = useReports();

const downloadingId = ref<string | null>(null);

const reportData = computed<Report[]>(() => reportsData.value ?? []);

function formatStatus(status: string): { text: string; color: string } {
  const statusMap: Record<string, { text: string; color: string }> = {
    generating: { text: "Generating...", color: "#f59e0b" },
    ready: { text: "Ready", color: "#10b981" },
    failed: { text: "Failed", color: "#ef4444" },
  };
  return statusMap[status] ?? { text: status, color: "#6b7280" };
}

async function downloadReport(reportId: string) {
  downloadingId.value = reportId;
  try {
    const result = (await getDownloadUrl({ reportId })) as { downloadUrl?: string } | undefined;
    const url = result?.downloadUrl;
    if (url && typeof window !== "undefined") {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  } finally {
    downloadingId.value = null;
  }
}

function handleDelete(reportId: string) {
  emit("delete", reportId);
}
</script>

<template>
  <section class="report-history-list">
    <header class="report-history-header">
      <h2 class="report-history-title">Report History</h2>
    </header>

    <div v-if="reportsIsLoading" class="loading-state">
      <p>Loading report history...</p>
    </div>

    <div v-else-if="reportData.length === 0" class="empty-state">
      <p class="empty-title">No reports generated yet</p>
      <p class="empty-subtitle">Create a report using the Export button above.</p>
    </div>

    <table v-else class="report-table">
      <thead>
        <tr>
          <th>Name</th>
          <th>Type</th>
          <th>Format</th>
          <th>Status</th>
          <th>Created</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="report in reportData" :key="report._id" class="report-row">
          <td class="report-name">{{ report.name }}</td>
          <td class="report-type">{{ report.type }}</td>
          <td class="report-format">{{ report.format }}</td>
          <td>
            <span class="status-badge" :style="{ color: formatStatus(report.status).color }">
              {{ formatStatus(report.status).text }}
            </span>
          </td>
          <td class="report-date">{{ report.createdAt ? new Date(report.createdAt).toLocaleDateString() : "-" }}</td>
          <td class="report-actions">
            <button
              v-if="report.status === 'ready'"
              class="btn btn-secondary btn-small"
              :disabled="downloadingId === report._id"
              @click="downloadReport(report._id)"
            >
              {{ downloadingId === report._id ? "Opening..." : "Download" }}
            </button>
            <button
              class="btn btn-danger btn-small"
              @click="handleDelete(report._id)"
            >
              Delete
            </button>
          </td>
        </tr>
      </tbody>
    </table>
  </section>
</template>

<style scoped>
.report-history-list {
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  overflow: hidden;
}

.report-history-header {
  padding: 16px 20px;
  border-bottom: 1px solid #e5e7eb;
}

.report-history-title {
  font-size: 1rem;
  font-weight: 600;
  color: #111827;
  margin: 0;
}

.loading-state,
.empty-state {
  padding: 40px 20px;
  text-align: center;
  color: #6b7280;
}

.empty-title {
  font-size: 0.875rem;
  font-weight: 500;
  color: #374151;
  margin: 0 0 4px;
}

.empty-subtitle {
  font-size: 0.75rem;
  margin: 0;
}

.report-table {
  width: 100%;
  border-collapse: collapse;
}

.report-table th,
.report-table td {
  padding: 12px 20px;
  text-align: left;
  font-size: 0.875rem;
  color: #4b5563;
}

.report-table th {
  font-weight: 600;
  color: #111827;
  background: #f9fafb;
}

.report-row {
  border-bottom: 1px solid #f3f4f6;
}

.report-row:last-child {
  border-bottom: none;
}

.report-name {
  font-weight: 500;
  color: #111827;
}

.report-type,
.report-format,
.report-date {
  font-size: 0.75rem;
  color: #6b7280;
}

.report-actions {
  display: flex;
  gap: 6px;
}

.btn {
  padding: 6px 12px;
  border: none;
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.2s;
}

.btn-secondary {
  background: #f3f4f6;
  color: #374151;
}

.btn-secondary:hover {
  background: #e5e7eb;
}

.btn-danger {
  background: #fee2e2;
  color: #ef4444;
}

.btn-danger:hover {
  background: #fecaca;
}

.btn-small {
  padding: 4px 8px;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.status-badge {
  font-size: 0.75rem;
  font-weight: 500;
  padding: 2px 8px;
  border-radius: 9999px;
  background: rgba(0, 0, 0, 0.05);
}
</style>