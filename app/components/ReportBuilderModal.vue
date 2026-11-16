<script setup lang="ts">
import { ref, computed } from "vue";
import { useReports } from "~/composables/useReports";
import { useReportBuilder } from "~/composables/useReportBuilder";

defineProps<{ visible: boolean }>();

const emit = defineEmits<{
  (e: "close"): void;
  (e: "created", reportId: string): void;
}>();

const { generate } = useReports();

const {
  config,
  format,
  scheduleCron,
  reportName,
  isScheduled,
  templates,
} = useReportBuilder();

type Step = "template" | "config" | "format" | "schedule";
const step = ref<Step>("template");
const selectedTemplate = ref<string>("");
const isSubmitting = ref(false);

const nameError = computed(() => {
  if (!selectedTemplate.value && !reportName.value) {
    return "Select a template or enter a name";
  }
  return "";
});

function nextStep() {
  if (step.value === "template") {
    if (selectedTemplate.value) {
      step.value = "config";
    }
  } else if (step.value === "config") {
    step.value = "format";
  } else if (step.value === "format") {
    step.value = "schedule";
  }
}

function prevStep() {
  if (step.value === "config") step.value = "template";
  else if (step.value === "format") step.value = "config";
  else if (step.value === "schedule") step.value = "format";
}

function selectTemplate(templateId: string) {
  selectedTemplate.value = templateId;
  const template = templates.find((t) => t.id === templateId);
  if (template) {
    reportName.value = template.label;
  }
}

async function submitReport() {
  if (!selectedTemplate.value && !reportName.value) {
    return;
  }
  isSubmitting.value = true;
  try {
    const report = await generate({
      name: reportName.value || templates.find((t) => t.id === selectedTemplate.value)?.label || "Report",
      type: selectedTemplate.value || "custom",
      config: {
        dateRange: config.value.dateRange || "month",
        dateFrom: config.value.dateFrom,
        dateTo: config.value.dateTo,
      },
      format: format.value,
      scheduleCron: isScheduled.value ? scheduleCron.value : undefined,
    });
    emit("created", report.id);
  } finally {
    isSubmitting.value = false;
  }
}

const canSubmit = computed(() => selectedTemplate.value || reportName.value);
</script>

<template>
  <transition name="fade">
    <div v-if="visible" class="report-builder-modal">
      <div class="modal-overlay" @click="$emit('close')"/>
      <div class="modal-content">
        <header class="modal-header">
          <h3 class="modal-title">Create Custom Report</h3>
          <button class="modal-close" @click="$emit('close')">×</button>
        </header>

        <section v-if="step === 'template'" class="modal-body">
          <p class="modal-description">Select a report template or build a custom report.</p>

          <div
            v-for="template in templates"
            :key="template.id"
            class="template-option"
            :class="{ selected: selectedTemplate === template.id }"
            @click="selectTemplate(template.id)"
          >
            <input
              :id="template.id"
              v-model="selectedTemplate"
              type="radio"
              name="template"
              :value="template.id"
              class="template-radio"
            >
            <label :for="template.id" class="template-label">
              <span class="template-name">{{ template.label }}</span>
              <span class="template-desc">{{ template.description }}</span>
            </label>
          </div>

          <p v-if="selectedTemplate" class="template-selected">
            Selected: {{ templates.find((t) => t.id === selectedTemplate)?.label }}
          </p>
          <p v-if="nameError" class="form-error">{{ nameError }}</p>
        </section>

        <section v-if="step === 'config'" class="modal-body">
          <p class="modal-description">Set the date range and filters for your report.</p>

          <div class="form-group">
            <label class="form-label">Date Range</label>
            <select v-model="config.dateRange" class="form-select">
              <option value="week">Week</option>
              <option value="month" selected>Month</option>
              <option value="quarter">Quarter</option>
              <option value="year">Year</option>
              <option value="custom">Custom range</option>
            </select>
          </div>

          <div v-if="config.dateRange === 'custom'" class="form-group">
            <label class="form-label">Date From</label>
            <input v-model="config.dateFrom" type="date" class="form-input" >
          </div>

          <div v-if="config.dateRange === 'custom'" class="form-group">
            <label class="form-label">Date To</label>
            <input v-model="config.dateTo" type="date" class="form-input" >
          </div>

          <div v-else class="form-hint">
            Using preset: {{ config.dateRange }}
          </div>
        </section>

        <section v-if="step === 'format'" class="modal-body">
          <p class="modal-description">Choose the output format for your report.</p>

          <div class="format-option">
            <input id="csv" v-model="format" type="radio" name="format" value="csv" class="format-radio" >
            <label for="csv" class="format-label">CSV (spreadsheets)</label>
          </div>

          <div class="format-option">
            <input id="json" v-model="format" type="radio" name="format" value="json" class="format-radio" >
            <label for="json" class="format-label">JSON (programmatic)</label>
          </div>

          <p v-if="format === 'csv'" class="format-hint">
            CSV includes headers and is compatible with Excel/Google Sheets.
          </p>
          <p v-if="format === 'json'" class="format-hint">
            JSON format includes metadata and is suitable for programmatic consumption.
          </p>
        </section>

        <section v-if="step === 'schedule'" class="modal-body">
          <p class="modal-description">Schedule when the report should be generated and emailed.</p>

          <div class="form-group">
            <label class="form-label">Report Name</label>
            <input
              v-model="reportName"
              type="text"
              class="form-input"
              :placeholder="selectedTemplate ? templates.find(t => t.id === selectedTemplate)?.label : 'Enter a name for your custom report'"
            >
          </div>

          <div class="form-group">
            <label class="form-label">
              <input v-model="isScheduled" type="checkbox" > Schedule this report
            </label>
          </div>

          <div v-if="isScheduled" class="form-group">
            <label class="form-label">Cron Schedule</label>
            <input v-model="scheduleCron" type="text" class="form-input" placeholder="e.g. 0 6 * * *" >
            <p class="form-hint">
              Leave blank for one-time report. Enter a cron expression (e.g. "0 6 * * *" for daily at 6am).
            </p>
          </div>

          <div v-if="nameError" class="form-error">{{ nameError }}</div>
        </section>

        <div class="modal-footer">
          <button v-if="step !== 'template'" class="btn btn-secondary" @click="prevStep">Back</button>
          <button v-if="step !== 'schedule'" class="btn btn-primary" @click="nextStep">Next</button>
          <button v-else class="btn btn-primary" :disabled="isSubmitting || !canSubmit" @click="submitReport">
            {{ isScheduled ? "Export & Schedule" : "Export" }}
          </button>
          <button class="btn btn-secondary" @click="$emit('close')">Cancel</button>
        </div>
      </div>
    </div>
  </transition>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.report-builder-modal .modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.report-builder-modal .modal-content {
  background: white;
  border-radius: 12px;
  width: 90%;
  max-width: 500px;
  max-height: 90vh;
  overflow-y: auto;
}

.report-builder-modal .modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  border-bottom: 1px solid #e5e7eb;
}

.report-builder-modal .modal-title {
  font-size: 1.25rem;
  font-weight: 600;
  color: #1f2937;
}

.report-builder-modal .modal-close {
  background: none;
  border: none;
  font-size: 1.5rem;
  color: #6b7280;
  cursor: pointer;
  padding: 4px;
}

.report-builder-modal .modal-body {
  padding: 24px;
}

.report-builder-modal .modal-footer {
  display: flex;
  justify-content: flex-end;
  padding: 16px 24px;
  border-top: 1px solid #e5e7eb;
  gap: 8px;
}

.report-builder-modal .template-option {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  margin-bottom: 8px;
  cursor: pointer;
  transition: border-color 0.2s, background-color 0.2s;
}

.report-builder-modal .template-option:hover {
  border-color: #d1d5db;
}

.report-builder-modal .template-option.selected {
  border-color: #10b981;
  background: rgba(16, 185, 129, 0.05);
}

.report-builder-modal .template-radio {
  accent-color: #10b981;
}

.report-builder-modal .template-label {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.report-builder-modal .template-name {
  font-size: 0.875rem;
  font-weight: 500;
  color: #374151;
}

.report-builder-modal .template-desc {
  font-size: 0.75rem;
  color: #6b7280;
}

.report-builder-modal .template-selected {
  margin-top: 8px;
  font-size: 0.875rem;
  color: #10b981;
}

.report-builder-modal .format-option {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  margin-bottom: 8px;
  cursor: pointer;
}

.report-builder-modal .format-option:hover {
  border-color: #d1d5db;
}

.report-builder-modal .format-radio {
  accent-color: #10b981;
}

.report-builder-modal .format-label {
  font-size: 0.875rem;
  color: #4b5563;
}

.report-builder-modal .format-hint {
  font-size: 0.75rem;
  color: #6b7280;
  margin-top: 8px;
}

.report-builder-modal .form-group {
  margin-bottom: 16px;
}

.report-builder-modal .form-label {
  display: block;
  font-size: 0.875rem;
  font-weight: 500;
  color: #374151;
  margin-bottom: 8px;
}

.report-builder-modal .form-select,
.report-builder-modal .form-input {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 0.875rem;
  color: #1f2937;
  background: white;
  transition: border-color 0.2s;
}

.report-builder-modal .form-select:focus,
.report-builder-modal .form-input:focus {
  outline: none;
  border-color: #10b981;
  box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.1);
}

.report-builder-modal .form-hint {
  font-size: 0.75rem;
  color: #6b7280;
  margin-top: 8px;
}

.report-builder-modal .form-error {
  font-size: 0.75rem;
  color: #ef4444;
  margin-top: 8px;
  display: block;
}
</style>