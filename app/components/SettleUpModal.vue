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
      <h2 id="settle-title" class="hhb-modal-title">Settle Up</h2>
      <form class="hhb-stack" @submit.prevent="handleSubmit">
        <div class="hhb-field">
          <label class="hhb-label" for="settle-amount">Amount</label>
          <input id="settle-amount" v-model.number="form.amount" class="hhb-input" type="number" step="0.01" min="0.01" required>
        </div>
        <p class="settle-to">
          You are settling with {{ props.partnerName || "your partner" }}
        </p>
        <div class="hhb-modal-actions">
          <button type="button" class="hhb-btn hhb-btn--secondary" @click="() => emit('close')">Cancel</button>
          <button type="submit" class="hhb-btn hhb-btn--primary">Confirm Settlement</button>
        </div>
      </form>
    </div>
  </div>
</template>

<style scoped>
.settle-to {
  color: var(--hhb-color-text-secondary);
  font-size: var(--hhb-text-sm);
}
</style>
