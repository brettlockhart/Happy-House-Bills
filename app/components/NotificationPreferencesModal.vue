<script setup lang="ts">
import { ref, watch } from "vue";
import { useNotificationPreferences } from "~/composables/useNotificationPreferences";

interface Props {
  isOpen: boolean;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: "close"): void;
}>();

const {
  preferences,
  isLoading,
  updatePreferences,
  resetPreferences,
} = useNotificationPreferences();

const isSaving = ref(false);

type ToggleKey =
  | "expensePending"
  | "expenseApproved"
  | "expenseRejected"
  | "settlementCreated"
  | "inviteSent";

const typeToggles: Array<{ key: ToggleKey; label: string }> = [
  { key: "expensePending", label: "Expense pending" },
  { key: "expenseApproved", label: "Expense approved" },
  { key: "expenseRejected", label: "Expense rejected" },
  { key: "settlementCreated", label: "Settlement created" },
  { key: "inviteSent", label: "Invite sent" },
];

const localQuietStart = ref("");
const localQuietEnd = ref("");
const localBatchSeconds = ref(2);

watch(
  () => preferences.value,
  (prefs) => {
    localQuietStart.value = prefs.quietHoursStart ?? "";
    localQuietEnd.value = prefs.quietHoursEnd ?? "";
    localBatchSeconds.value = Math.round((prefs.batchWindowMs ?? 2000) / 1000);
  },
  { immediate: true },
);

const persist = async (patch: Record<string, unknown>) => {
  isSaving.value = true;
  try {
    await updatePreferences(patch);
  } finally {
    isSaving.value = false;
  }
};

const handleToggle = (key: ToggleKey, value: boolean) => {
  void persist({ [key]: value });
};

const handleEmailFallbackChange = (value: boolean) => {
  void persist({ emailFallback: value });
};

const handleQuietHoursBlur = () => {
  const start = localQuietStart.value;
  const end = localQuietEnd.value;
  if (!start || !end) return;
  if (start === (preferences.value.quietHoursStart ?? "") && end === (preferences.value.quietHoursEnd ?? "")) {
    return;
  }
  void persist({ quietHoursStart: start, quietHoursEnd: end });
};

const handleBatchBlur = () => {
  const ms = Math.max(0, Math.min(60, Number(localBatchSeconds.value) || 0)) * 1000;
  if (ms === preferences.value.batchWindowMs) return;
  void persist({ batchWindowMs: ms });
};

const handleReset = async () => {
  await resetPreferences({});
};

const handleClose = () => {
  emit("close");
};

const batchWindowSeconds = localBatchSeconds;
</script>

<template>
  <Teleport to="body">
    <div v-if="props.isOpen" class="hhb-modal-overlay" @click.self="handleClose">
      <div
        class="hhb-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="notification-prefs-title"
        @keydown.esc="handleClose"
      >
        <h2 id="notification-prefs-title" class="hhb-modal-title">Notification Preferences</h2>

        <div v-if="isLoading" class="hhb-empty">
          <p class="hhb-text-secondary">Loading preferences…</p>
        </div>

        <div v-else class="hhb-stack">
          <p class="hhb-text-secondary">Choose which notifications you receive.</p>

          <div v-for="t in typeToggles" :key="t.key" class="notification-prefs__row">
            <span class="notification-prefs__label">{{ t.label }}</span>
            <label class="hhb-switch">
              <input
                type="checkbox"
                :checked="preferences[t.key]"
                @change="handleToggle(t.key, ($event.target as HTMLInputElement).checked)"
              >
              <span class="hhb-switch__track" aria-hidden="true" />
            </label>
          </div>

          <div class="hhb-field">
            <label class="hhb-label" for="notif-quiet-start">Quiet hours start</label>
            <input
              id="notif-quiet-start"
              v-model="localQuietStart"
              class="hhb-input"
              type="time"
              @blur="handleQuietHoursBlur"
            >
          </div>

          <div class="hhb-field">
            <label class="hhb-label" for="notif-quiet-end">Quiet hours end</label>
            <input
              id="notif-quiet-end"
              v-model="localQuietEnd"
              class="hhb-input"
              type="time"
              @blur="handleQuietHoursBlur"
            >
          </div>

          <div class="hhb-field">
            <label class="hhb-label" for="notif-batch">Batch window (seconds)</label>
            <input
              id="notif-batch"
              v-model.number="batchWindowSeconds"
              class="hhb-input"
              type="number"
              min="0"
              max="60"
              @blur="handleBatchBlur"
            >
          </div>

          <div class="hhb-field notification-prefs__row">
            <span class="hhb-label">Email fallback</span>
            <label class="hhb-switch">
              <input
                type="checkbox"
                :checked="preferences.emailFallback"
                @change="handleEmailFallbackChange(($event.target as HTMLInputElement).checked)"
              >
              <span class="hhb-switch__track" aria-hidden="true" />
            </label>
          </div>

          <div class="hhb-modal__actions">
            <button type="button" class="hhb-btn hhb-btn--secondary" :disabled="isSaving" @click="handleReset">
              Reset to defaults
            </button>
            <button type="button" class="hhb-btn hhb-btn--primary" :disabled="isSaving" @click="handleClose">
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.notification-prefs__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--hhb-space-3);
}

.notification-prefs__label {
  font-size: var(--hhb-text-sm);
  color: var(--hhb-color-text-secondary);
}

.hhb-switch {
  position: relative;
  display: inline-flex;
  align-items: center;
}

.hhb-switch input {
  position: absolute;
  opacity: 0;
  width: 0;
  height: 0;
}

.hhb-switch__track {
  width: 2.5rem;
  height: 1.4rem;
  border-radius: var(--hhb-radius-full);
  background: var(--hhb-color-border);
  transition: background var(--hhb-transition-base);
  position: relative;
  flex-shrink: 0;
}

.hhb-switch__track::after {
  content: "";
  position: absolute;
  top: 0.15rem;
  left: 0.15rem;
  width: 1.1rem;
  height: 1.1rem;
  border-radius: var(--hhb-radius-full);
  background: #fff;
  transition: transform var(--hhb-transition-base);
}

.hhb-switch input:checked + .hhb-switch__track {
  background: var(--hhb-color-primary);
}

.hhb-switch input:checked + .hhb-switch__track::after {
  transform: translateX(1.1rem);
}

.hhb-modal__actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--hhb-space-2);
  margin-top: var(--hhb-space-4);
}
</style>
