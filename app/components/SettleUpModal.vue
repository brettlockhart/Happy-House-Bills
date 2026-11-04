<script setup lang="ts">
import { reactive } from "vue";

const props = withDefaults(defineProps<{
  isOpen?: boolean;
  currentUserId: string;
  partnerUserId: string;
  partnerName?: string;
}>(), {
  isOpen: false,
  partnerName: "your partner",
});

const emit = defineEmits<{
  (e: "close"): void;
  (e: "submit", settlement: {
    amount: number;
    fromUser: string;
    toUser: string;
  }): void;
}>();

const form = reactive({
  amount: 0,
  fromUser: props.currentUserId,
  toUser: props.partnerUserId,
});

function handleSubmit() {
  if (form.amount <= 0) return;
  emit("submit", { ...form });
  form.amount = 0;
}
</script>

<template>
  <div v-if="isOpen" class="hhb-modal-overlay" @click.self="() => emit('close')">
    <div class="hhb-modal" role="dialog" aria-modal="true" aria-labelledby="settle-title">
      <h2 id="settle-title">Settle Up</h2>
      <form @submit.prevent="handleSubmit">
        <label>
          Amount
          <input v-model.number="form.amount" type="number" step="0.01" min="0.01" required>
        </label>
        <p class="settle-to">
          You are settling with {{ props.partnerName || "your partner" }}
        </p>
        <div class="hhb-modal-actions">
          <button type="button" @click="() => emit('close')">Cancel</button>
          <button type="submit">Confirm Settlement</button>
        </div>
      </form>
    </div>
  </div>
</template>

<style scoped>
.hhb-modal-label {
  display: flex;
  flex-direction: column;
  gap: var(--hhb-space-1);
  font-size: var(--hhb-text-sm);
}

.hhb-modal-input {
  padding: var(--hhb-space-2);
  border: 1px solid var(--hhb-color-border);
  border-radius: var(--hhb-radius-sm);
  background: var(--hhb-color-bg);
  color: var(--hhb-color-text);
  font-size: var(--hhb-text-base);
}

.settle-to {
  color: var(--hhb-color-text-secondary);
  font-size: var(--hhb-text-sm);
  margin-top: var(--hhb-space-2);
}
</style>
