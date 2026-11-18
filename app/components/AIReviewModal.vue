<script setup lang="ts">
import { computed } from "vue";

export interface OcrReviewItem {
  _id: string;
  store?: string;
  date: string;
  amount: number;
  suggestion?: {
    store?: string;
    date?: string;
    amount?: number;
    confidence?: number;
    lineItems?: Array<{ description: string; totalPrice?: number }>;
  };
}

const props = withDefaults(defineProps<{
  isOpen: boolean;
  reviews: OcrReviewItem[];
  busyIds?: string[];
}>(), {
  busyIds: () => [],
});

const emit = defineEmits<{
  (e: "close"): void;
  (e: "apply" | "dismiss", id: string): void;
}>();

const current = computed(() => props.reviews[0]);
const remaining = computed(() => Math.max(0, props.reviews.length - 1));
</script>

<template>
  <div v-if="isOpen && current" class="hhb-modal-overlay" @click.self="emit('close')">
    <div class="hhb-modal review-modal" role="dialog" aria-modal="true" aria-labelledby="review-title">
      <h2 id="review-title" class="hhb-modal-title">Review AI suggestion</h2>
      <p class="hhb-text-secondary review-intro">
        Compare the saved values with the new AI reading. Nothing changes until you choose.
      </p>

      <div class="review-grid">
        <div class="review-heading">Field</div>
        <div class="review-heading">Saved</div>
        <div class="review-heading">AI suggestion</div>

        <div class="review-label">Store</div>
        <div>{{ current.store || "—" }}</div>
        <div :class="{ changed: current.suggestion?.store && current.suggestion.store !== current.store }">
          {{ current.suggestion?.store || "—" }}
        </div>

        <div class="review-label">Date</div>
        <div>{{ current.date }}</div>
        <div :class="{ changed: current.suggestion?.date && current.suggestion.date !== current.date }">
          {{ current.suggestion?.date || "—" }}
        </div>

        <div class="review-label">Amount</div>
        <div>${{ current.amount.toFixed(2) }}</div>
        <div :class="{ changed: current.suggestion?.amount !== undefined && current.suggestion.amount !== current.amount }">
          {{ current.suggestion?.amount !== undefined ? `$${current.suggestion.amount.toFixed(2)}` : "—" }}
        </div>

        <div class="review-label">Line items</div>
        <div>Saved values preserved</div>
        <div>{{ current.suggestion?.lineItems?.length || 0 }} items</div>
      </div>

      <p v-if="current.suggestion?.confidence !== undefined" class="review-confidence">
        AI confidence: {{ Math.round(current.suggestion.confidence) }}%
      </p>
      <p v-if="remaining > 0" class="hhb-text-muted">+ {{ remaining }} more after this review</p>

      <div class="hhb-modal-actions review-actions">
        <button
          type="button"
          class="hhb-btn hhb-btn--secondary"
          :disabled="busyIds.includes(current._id)"
          @click="emit('dismiss', current._id)"
        >
          Keep original
        </button>
        <button
          type="button"
          class="hhb-btn hhb-btn--primary"
          :disabled="busyIds.includes(current._id)"
          @click="emit('apply', current._id)"
        >
          {{ busyIds.includes(current._id) ? "Applying…" : "Apply suggestion" }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.review-modal { max-width: 34rem; }
.review-intro { margin-bottom: var(--hhb-space-4); }
.review-grid {
  display: grid;
  grid-template-columns: 0.7fr 1fr 1fr;
  gap: var(--hhb-space-2) var(--hhb-space-3);
  padding: var(--hhb-space-3);
  background: var(--hhb-color-bg-alt);
  border-radius: var(--hhb-radius-lg);
  font-size: var(--hhb-text-sm);
}
.review-heading { font-weight: var(--hhb-font-semibold); color: var(--hhb-color-text-secondary); }
.review-label { font-weight: var(--hhb-font-medium); }
.changed { color: var(--hhb-color-primary-dark); font-weight: var(--hhb-font-semibold); }
.review-confidence { margin-top: var(--hhb-space-3); font-size: var(--hhb-text-sm); color: var(--hhb-color-text-secondary); }
.review-actions { flex-wrap: wrap; }
</style>
