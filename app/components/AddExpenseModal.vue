<script setup lang="ts">
interface Expense {
  _id: string;
  amount: number;
  date: string;
  category: "groceries" | "utilities" | "other";
  notes?: string;
  paidBy: string;
  status: "pending" | "approved" | "rejected";
  enteredBy: string;
  approvedBy?: string;
  rejectReason?: string;
  receiptImageId?: string;
  receiptPHash?: string;
  receiptFingerprint?: string;
  createdAt: number;
  updatedAt: number;
}

const props = withDefaults(defineProps<{
  isOpen?: boolean;
  expense?: Expense;
  currentUserId: string;
}>(), {
  isOpen: false,
  expense: undefined,
});

const emit = defineEmits<{
  (e: "close"): void;
  (e: "submit", expense: {
    amount: number;
    date: string;
    category: "groceries" | "utilities" | "other";
    notes?: string;
    paidBy: string;
    receiptImageId?: string;
    receiptPHash?: string;
    receiptFingerprint?: string;
  }): void;
}>();

const form = reactive({
  amount: 0,
  date: new Date().toISOString().split("T")[0] as string,
  category: "other" as const,
  notes: "",
  paidBy: props.currentUserId,
});

function handleSubmit() {
  emit("submit", { ...form });
  form.amount = 0;
  form.date = new Date().toISOString().split("T")[0] as string;
  form.category = "other";
  form.notes = "";
  form.paidBy = props.currentUserId;
}
</script>

<template>
  <div v-if="isOpen" class="hhb-modal-overlay" @click.self="() => emit('close')">
    <div class="hhb-modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <h2 id="modal-title">{{ props.expense ? "Edit Expense" : "Add Expense" }}</h2>
      <form @submit.prevent="handleSubmit">
        <label>
          Amount
          <input v-model.number="form.amount" type="number" step="0.01" required >
        </label>
        <label>
          Date
          <input v-model="form.date" type="date" required >
        </label>
        <label>
          Category
          <select v-model="form.category">
            <option value="groceries">Groceries</option>
            <option value="utilities">Utilities</option>
            <option value="other">Other</option>
          </select>
        </label>
        <label>
          Notes
          <textarea v-model="form.notes" />
        </label>
        <div class="hhb-modal-actions">
          <button type="button" @click="() => emit('close')">Cancel</button>
          <button type="submit">{{ props.expense ? "Save" : "Add" }}</button>
        </div>
      </form>
    </div>
  </div>
</template>

<style scoped>
.hhb-modal form {
  display: flex;
  flex-direction: column;
  gap: var(--hhb-space-3);
}

.hhb-modal label {
  display: flex;
  flex-direction: column;
  gap: var(--hhb-space-1);
  font-size: var(--hhb-text-sm);
}

.hhb-modal input,
.hhb-modal select,
.hhb-modal textarea {
  padding: var(--hhb-space-2);
  border: 1px solid var(--hhb-color-border);
  border-radius: var(--hhb-radius-sm);
  background: var(--hhb-color-bg);
  color: var(--hhb-color-text);
  font-size: var(--hhb-text-base);
}

.hhb-modal textarea {
  min-height: 80px;
  resize: vertical;
}
</style>
