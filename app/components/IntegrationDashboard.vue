<template>
  <div class="integration-dashboard">
    <div class="dashboard-header">
      <h2 class="text-xl font-semibold text-gray-900">Integrations</h2>
      <button
        class="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
        @click="showConnectModal = true"
      >
        Connect Integration
      </button>
    </div>

    <div v-if="integrations.length === 0" class="empty-state">
      <p class="text-gray-500">No integrations configured yet.</p>
      <p class="text-sm text-gray-400 mt-2">
        Connect bank accounts, accounting software, or travel services to sync expenses automatically.
      </p>
    </div>

    <div v-else class="integration-list">
      <div
        v-for="integration in integrations"
        :key="integration.id"
        class="integration-card"
      >
        <div class="integration-header">
          <div class="integration-info">
            <h3 class="font-medium text-gray-900">{{ integration.name }}</h3>
            <p class="text-sm text-gray-500">
              {{ integration.provider }} · {{ integration.type }}
            </p>
          </div>
          <div class="integration-status">
            <span
              class="px-2 py-1 rounded-full text-xs font-medium"
              :class="statusClass(integration.status)"
            >
              {{ integration.status }}
            </span>
          </div>
        </div>

        <div v-if="integration.lastSyncAt" class="integration-meta">
          <p class="text-xs text-gray-400">
            Last synced: {{ new Date(integration.lastSyncAt).toLocaleString() }}
          </p>
        </div>

        <div v-if="integration.errorMessage" class="integration-error">
          <p class="text-xs text-red-600">{{ integration.errorMessage }}</p>
        </div>

        <div class="integration-actions">
          <button
            class="px-3 py-1 text-sm bg-blue-50 text-blue-700 rounded hover:bg-blue-100 transition-colors"
            :disabled="isPending"
            @click="handleSync(integration.id)"
          >
            Sync
          </button>
          <button
            class="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
            :disabled="isPending"
            @click="handleDisconnect(integration.id)"
          >
            Disconnect
          </button>
        </div>
      </div>
    </div>

    <div v-if="showConnectModal" class="modal-overlay" @click.self="showConnectModal = false">
      <div class="modal-content">
        <h3 class="text-lg font-semibold text-gray-900 mb-4">Connect Integration</h3>

        <div class="form-group">
          <label class="block text-sm text-gray-700 mb-2">Integration Type</label>
          <select
            v-model="connectForm.type"
            class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
          >
            <option value="bank">Bank</option>
            <option value="accounting">Accounting</option>
            <option value="travel">Travel</option>
            <option value="payment">Payment</option>
            <option value="ocr">OCR</option>
            <option value="storage">Storage</option>
            <option value="email">Email</option>
            <option value="analytics">Analytics</option>
          </select>
        </div>

        <div class="form-group">
          <label class="block text-sm text-gray-700 mb-2">Provider</label>
          <input
            v-model="connectForm.provider"
            type="text"
            class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            placeholder="e.g. plaid, quickbooks, skyscanner"
          >
        </div>

        <div class="form-group">
          <label class="block text-sm text-gray-700 mb-2">Name</label>
          <input
            v-model="connectForm.name"
            type="text"
            class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            placeholder="Display name"
          >
        </div>

        <div class="form-actions">
          <button
            class="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            @click="showConnectModal = false"
          >
            Cancel
          </button>
          <button
            class="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50"
            :disabled="isPending"
            @click="handleConnect"
          >
            Connect
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { useIntegrations } from "~/composables/useIntegrations";

const { integrations, isPending, connectIntegration, disconnectIntegration, syncIntegration } =
  useIntegrations();

const showConnectModal = ref(false);
const connectForm = ref({
  type: "bank",
  provider: "",
  name: "",
});

function statusClass(status: string): string {
  switch (status) {
    case "connected":
      return "bg-green-100 text-green-800";
    case "disconnected":
      return "bg-gray-100 text-gray-800";
    case "error":
      return "bg-red-100 text-red-800";
    case "pending":
      return "bg-yellow-100 text-yellow-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
}

async function handleConnect() {
  const result = await connectIntegration(
    connectForm.value.type as "bank" | "accounting" | "travel" | "payment" | "ocr" | "storage" | "email" | "analytics",
    connectForm.value.provider,
    connectForm.value.name,
  );

  if (result.success) {
    showConnectModal.value = false;
    connectForm.value = { type: "bank", provider: "", name: "" };
  }
}

async function handleDisconnect(integrationId: string) {
  await disconnectIntegration(integrationId);
}

async function handleSync(integrationId: string) {
  await syncIntegration(integrationId);
}
</script>

<style scoped>
.integration-dashboard {
  @apply p-6 bg-white rounded-lg shadow-sm border border-gray-200;
}

.dashboard-header {
  @apply flex items-center justify-between mb-6;
}

.integration-list {
  @apply space-y-4;
}

.integration-card {
  @apply p-4 border border-gray-200 rounded-lg;
}

.integration-header {
  @apply flex items-center justify-between;
}

.integration-info {
  @apply flex flex-col;
}

.integration-meta {
  @apply mt-2;
}

.integration-error {
  @apply mt-2;
}

.integration-actions {
  @apply flex gap-2 mt-3;
}

.form-group {
  @apply mb-4;
}

.form-actions {
  @apply flex justify-end gap-2 mt-6;
}

.modal-overlay {
  @apply fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50;
}

.modal-content {
  @apply bg-white p-6 rounded-lg shadow-lg max-w-md w-full;
}
</style>
