<template>
  <div v-if="isOpen" class="hhb-modal-overlay" @click.self="() => emit('close')">
    <div class="hhb-modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <h2 id="modal-title">{{ props.expense ? "Edit Expense" : "Add Expense" }}</h2>
      <form @submit.prevent="handleSubmit">
        <div v-if="ocrState.status !== 'idle'" class="ocr-status">
          <div class="ocr-progress">
            <span>{{ ocrStatusText }}</span>
            <progress :value="ocrState.progress" max="100" />
          </div>
          <p v-if="ocrState.status === 'error'" class="ocr-error">{{ ocrState.error }}</p>
          <p v-if="ocrState.result?.lowConfidence" class="ocr-warning">
            ⚠️ OCR confidence is low ({{ ocrState.result.confidence }}%) — please verify all fields
          </p>
        </div>

        <ReceiptUploader
          v-model="receiptFile"
          @change="handleReceiptChange"
        />

        <label>
          Store (optional)
          <input v-model="form.store" type="text" placeholder="e.g. Walmart" >
        </label>

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
          <div class="hhb-flex hhb-gap-2 hhb-items-center">
            <input
              v-model="form.category"
              type="text"
              placeholder="Type category name"
              class="hhb-input hhb-flex-1"
            >
            <button
              type="button"
              class="hhb-btn hhb-btn-secondary"
              @click="categoryPickerOpen = true"
            >
              Browse
            </button>
          </div>
          <div v-if="selectedCategory" class="hhb-mt-1">
            <CategoryBadge
              :category="selectedCategory.name"
              :color="selectedCategory.color"
              :icon="selectedCategory.icon"
            />
          </div>
        </label>

        <CategoryPicker
          v-model="categoryPickerOpen"
          @select="handleCategorySelect"
        />

        <label>
          Notes
          <textarea v-model="form.notes" />
        </label>

        <div class="hhb-modal-actions">
          <button type="button" @click="() => emit('close')">Cancel</button>
          <button type="submit" :disabled="ocrState.status === 'processing' || ocrState.status === 'uploading'">
            {{ props.expense ? "Save" : "Add" }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, reactive } from "vue";
import { useGoogleOCR } from "~/composables/useGoogleOCR";
import ReceiptUploader from "~/components/ReceiptUploader.vue";
import CategoryPicker from "~/components/CategoryPicker.vue";
import CategoryBadge from "~/components/CategoryBadge.vue";
import type { Doc, Id } from "~/convex/_generated/dataModel";

type Category = Doc<"categories">;

interface Expense {
  _id: string;
  amount: number;
  date: string;
  category: string;
  categoryId?: Id<"categories">;
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
    category: string;
    categoryId?: Id<"categories">;
    notes?: string;
    paidBy: string;
    receiptImageId?: string;
    receiptPHash?: string;
    receiptFingerprint?: string;
    store?: string;
  }): void;
}>();

const form = reactive({
  amount: 0,
  date: new Date().toISOString().split("T")[0] as string,
  category: "other" as string,
  categoryId: undefined as Id<"categories"> | undefined,
  notes: "",
  paidBy: props.currentUserId,
  store: "",
});

const receiptFile = ref<File | null>(null);
const { state: ocrState, processReceipt, reset: resetOcr } = useGoogleOCR();

const categoryPickerOpen = ref(false);
const selectedCategory = ref<Category | null>(null);

const ocrStatusText = computed(() => {
  const status = ocrState.value.status;
  if (status === "preprocessing") return "Preprocessing image...";
  if (status === "uploading") return "Uploading receipt...";
  if (status === "processing") return "Running OCR...";
  if (status === "done") return "OCR complete — review fields";
  if (status === "error") return "OCR failed";
  return "";
});

watch(() => props.isOpen, (open) => {
  if (open) {
    resetForm();
    selectedCategory.value = null;
  }
});

watch(() => props.expense, (expense) => {
  if (expense) {
    form.amount = expense.amount;
    form.date = expense.date;
    form.category = expense.category || "other";
    form.categoryId = expense.categoryId;
    form.notes = expense.notes || "";
    form.paidBy = expense.paidBy;
    form.store = "";
    selectedCategory.value = null;
  } else {
    resetForm();
    selectedCategory.value = null;
  }
}, { immediate: true });

function resetForm() {
  form.amount = 0;
  form.date = new Date().toISOString().split("T")[0] as string;
  form.category = "other";
  form.categoryId = undefined;
  form.notes = "";
  form.paidBy = props.currentUserId;
  form.store = "";
  receiptFile.value = null;
  resetOcr();
}

async function handleReceiptChange(file: File | null) {
  receiptFile.value = file;
  if (!file) {
    resetOcr();
    return;
  }

  try {
    await processReceipt(file, form);
  } catch {
    // Error handled in UI
  }
}

function handleCategorySelect(category: Category) {
  form.category = category.name;
  form.categoryId = category._id;
  selectedCategory.value = category;
}

function handleSubmit() {
  if (ocrState.value.status === "processing" || ocrState.value.status === "uploading") return;

  emit("submit", {
    ...form,
    receiptImageId: ocrState.value.result?.storageId,
  });
  resetForm();
}
</script>

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

.hhb-modal-actions {
  display: flex;
  gap: var(--hhb-space-2);
  justify-content: flex-end;
  margin-top: var(--hhb-space-2);
}

.ocr-status {
  padding: var(--hhb-space-2);
  background: var(--hhb-color-bg-elevated);
  border-radius: var(--hhb-radius-sm);
  border: 1px solid var(--hhb-color-border);
}

.ocr-progress {
  display: flex;
  flex-direction: column;
  gap: var(--hhb-space-1);
  font-size: var(--hhb-text-sm);
}

.ocr-progress progress {
  width: 100%;
  height: 4px;
}

.ocr-error {
  color: var(--hhb-color-error, #ef4444);
  font-size: var(--hhb-text-sm);
  margin-top: var(--hhb-space-1);
}

.ocr-warning {
  color: var(--hhb-color-warning, #f59e0b);
  font-size: var(--hhb-text-sm);
  margin-top: var(--hhb-space-1);
}
</style>