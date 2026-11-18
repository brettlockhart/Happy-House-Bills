<template>
  <div v-if="isOpen" class="hhb-modal-overlay" @click.self="handleClose">
    <div
      ref="modalRoot"
      class="hhb-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      @keydown.esc="handleClose"
      @keydown="handleModalKeydown"
    >
      <h2 id="modal-title" class="hhb-modal-title">{{ props.expense ? "Edit Expense" : "Add Expense" }}</h2>
      <form class="hhb-stack" @submit.prevent="handleSubmit">
        <div
          v-if="ocrState.status !== 'idle'"
          class="ocr-status"
          role="status"
          aria-live="polite"
        >
          <div class="ocr-progress">
            <span>{{ ocrStatusText }}</span>
            <progress :value="ocrState.progress" max="100" :aria-label="ocrStatusText" />
          </div>
          <p v-if="ocrState.status === 'error'" class="ocr-error" role="alert">{{ ocrState.error }}</p>
          <p v-if="ocrState.result?.lowConfidence" class="ocr-warning">
            ⚠️ Please verify the scanned values before saving.
          </p>
          <div class="ocr-controls">
            <button
              v-if="ocrState.status === 'error' && receiptFiles.length"
              type="button"
              class="hhb-btn hhb-btn--sm hhb-btn--secondary"
              @click="handleReceiptChange(receiptFiles)"
            >
              Retry scan
            </button>
            <button
              v-if="ocrState.status === 'preprocessing' || ocrState.status === 'uploading' || ocrState.status === 'processing'"
              type="button"
              class="hhb-btn hhb-btn--sm hhb-btn--ghost"
              @click="cancelScan"
            >
              Cancel scan
            </button>
          </div>
        </div>

        <ReceiptUploader
          v-model="receiptFiles"
          @change="handleReceiptChange"
        />

        <p v-if="ocrState.status === 'done' && ocrSourceLabel" class="ocr-source">
          <span class="hhb-badge" :class="ocrSourceLabel.cls">{{ ocrSourceLabel.text }}</span>
        </p>

        <div class="hhb-field">
          <label class="hhb-label" for="exp-store">Store <span class="hhb-hint">(optional)</span></label>
          <input id="exp-store" v-model="form.store" class="hhb-input" type="text" placeholder="e.g. Walmart" maxlength="200" @input="markDirty('store')">
        </div>

        <div class="hhb-field">
          <label class="hhb-label" for="exp-amount">Amount</label>
          <input id="exp-amount" v-model.number="form.amount" class="hhb-input" type="number" step="0.01" min="0.01" max="1000000" inputmode="decimal" required @input="markDirty('amount')">
        </div>

        <div class="hhb-field">
          <label class="hhb-label" for="exp-date">Date</label>
          <input id="exp-date" v-model="form.date" class="hhb-input" type="date" required @input="markDirty('date')">
        </div>

        <div class="hhb-field">
          <label class="hhb-label" for="exp-category">Category</label>
          <div class="hhb-row">
            <input id="exp-category" v-model="form.category" type="text" placeholder="Type category name" class="hhb-input">
            <button type="button" class="hhb-btn hhb-btn--secondary" @click="categoryPickerOpen = true">Browse</button>
          </div>
          <div v-if="selectedCategory" class="hhb-mt-1">
            <CategoryBadge :category="selectedCategory.name" :color="selectedCategory.color" :icon="selectedCategory.icon" />
          </div>
        </div>

        <CategoryPicker v-model="categoryPickerOpen" @select="handleCategorySelect" />

        <div class="hhb-field">
          <label class="hhb-label" for="exp-notes">Notes</label>
          <textarea id="exp-notes" v-model="form.notes" class="hhb-textarea" maxlength="2000" />
        </div>

        <p v-if="submitLocalError || submitError" class="form-error" role="alert">
          {{ submitLocalError || submitError }}
        </p>

        <div class="hhb-modal-actions">
          <button type="button" class="hhb-btn hhb-btn--secondary" :disabled="isSaving" @click="handleClose">Cancel</button>
          <button type="submit" class="hhb-btn hhb-btn--primary" :disabled="isSaving">
            {{ isSaving ? "Saving…" : (props.expense ? "Save" : "Add") }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref, computed, watch, onUnmounted } from "vue";
import { useGoogleOCR } from "~/composables/useGoogleOCR";
import type { OcrResult } from "~/composables/useGoogleOCR";
import { useModalFocus } from "~/composables/useModalFocus";
import CategoryPicker from "~/components/CategoryPicker.vue";
import CategoryBadge from "~/components/CategoryBadge.vue";
import ReceiptUploader from "~/components/ReceiptUploader.vue";
import type { Id, Doc } from "~~/convex/_generated/dataModel";

type Category = Doc<"categories">;

const props = withDefaults(defineProps<{
  isOpen?: boolean;
  currentUserId: string;
  isSaving?: boolean;
  submitError?: string | null;
  expense?: {
    amount: number;
    date: string;
    category: string;
    categoryId?: Id<"categories">;
    notes?: string;
    store?: string;
  };
}>(), {
  isOpen: false,
  isSaving: false,
  submitError: null,
  expense: undefined,
});

const modalRoot = ref<HTMLElement | null>(null);
const { handleKeydown: handleModalKeydown } = useModalFocus(
  modalRoot,
  computed(() => props.isOpen),
);

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
    receiptImageIds?: string[];
    receiptPHash?: string;
    receiptFingerprint?: string;
    store?: string;
    ocrSource?: string;
    ocrConfidence?: number;
    ocrRawText?: string;
    ocrNeedsReview?: boolean;
    clientRequestId?: string;
    lineItems?: Array<{
      description: string;
      quantity?: number;
      unitPrice?: number;
      totalPrice?: number;
      categoryHint?: string;
    }>;
  }): void;
}>();

const form = reactive({
  amount: 0,
  date: new Date().toISOString().split("T")[0]!,
  category: "other",
  categoryId: undefined as Id<"categories"> | undefined,
  notes: "",
  paidBy: props.currentUserId,
  store: "",
});
const selectedCategory = ref<Category | null>(null);
const categoryPickerOpen = ref(false);
const receiptFiles = ref<File[]>([]);
const { state: ocrState, processReceipt, uploadPending, reset: resetOcr } = useGoogleOCR();
const dirtyFields = new Set<"amount" | "date" | "store">();
const submitLocalError = ref<string | null>(null);
let currentOcrResult: OcrResult | undefined;
let ocrRunId = 0;
let ocrPromise: Promise<void> | null = null;
let clientRequestId = "";

watch(() => props.isOpen, () => {
  ocrRunId++;
  resetOcr();
  currentOcrResult = undefined;
  if (props.isOpen) {
    resetForm();
    clientRequestId = crypto.randomUUID();
  }
});

watch(() => props.expense, (exp) => {
  if (exp) {
    form.amount = exp.amount;
    form.date = exp.date;
    form.category = exp.category;
    form.categoryId = exp.categoryId;
    form.notes = exp.notes || "";
    form.store = exp.store || "";
  }
}, { immediate: true });

onUnmounted(() => {
  ocrRunId++;
  resetOcr();
});

function markDirty(field: "amount" | "date" | "store") {
  dirtyFields.add(field);
}

function resetForm() {
  form.amount = 0;
  form.date = new Date().toISOString().split("T")[0]!;
  form.category = "other";
  form.categoryId = undefined;
  form.notes = "";
  form.paidBy = props.currentUserId;
  form.store = "";
  selectedCategory.value = null;
  receiptFiles.value = [];
  dirtyFields.clear();
  submitLocalError.value = null;
}

const ocrStatusText = computed(() => {
  const status = ocrState.value.status;
  if (status === "preprocessing") return "Preprocessing image...";
  if (status === "uploading") return "Uploading receipt...";
  if (status === "processing") return "Running OCR...";
  if (status === "done") return "OCR complete — review fields";
  if (status === "error") return "OCR failed";
  return "";
});

const ocrSourceLabel = computed(() => {
  const source = currentOcrResult?.source;
  if (!source) return null;
  return source === "openrouter"
    ? { text: "Read with AI", cls: "hhb-badge--success" }
    : { text: "On-device read — AI can improve it when online", cls: "hhb-badge--warning" };
});

function handleClose() {
  if (props.isSaving) return;
  ocrRunId++;
  resetOcr();
  emit("close");
}

function cancelScan() {
  ocrRunId++;
  resetOcr();
  currentOcrResult = undefined;
}

async function handleReceiptChange(files: File[]) {
  const runId = ++ocrRunId;
  receiptFiles.value = files;
  resetOcr();
  currentOcrResult = undefined;
  submitLocalError.value = null;
  if (!files?.length) return;

  ocrPromise = (async () => {
    try {
      const { result } = await processReceipt(files, form);
      if (runId !== ocrRunId || !result) return;
      currentOcrResult = result;

      // AI suggestions never overwrite fields the user has edited.
      if (result.total && !dirtyFields.has("amount")) {
        const amount = Number.parseFloat(result.total);
        if (Number.isFinite(amount) && amount > 0 && amount <= 1_000_000) form.amount = amount;
      }
      if (result.date && !dirtyFields.has("date") && !Number.isNaN(Date.parse(result.date))) {
        form.date = result.date;
      }
      if (result.store && !dirtyFields.has("store")) form.store = result.store;
    } catch {
      // Error is rendered from ocrState; attachments remain available where uploaded.
    }
  })();
  await ocrPromise;
}

function handleCategorySelect(category: Category) {
  form.category = category.name;
  form.categoryId = category._id;
  selectedCategory.value = category;
}

async function handleSubmit() {
  if (props.isSaving) return;
  submitLocalError.value = null;

  // A valid manual entry can save immediately. Otherwise wait briefly for the
  // current scan to supply the amount rather than creating an empty expense.
  if ((!form.amount || form.amount <= 0) && ocrPromise) {
    try { await ocrPromise; } catch { /* validation below handles failure */ }
  }

  const amount = Number(form.amount);
  if (!Number.isFinite(amount) || amount <= 0 || amount > 1_000_000 || Math.round(amount * 100) !== amount * 100) {
    submitLocalError.value = "Enter a valid amount greater than 0, up to 1,000,000, with at most two decimals.";
    return;
  }

  let result = currentOcrResult;
  if (result && !result.storageIds?.length) {
    try {
      const uploaded = await uploadPending();
      result = { ...result, storageId: uploaded.storageId, storageIds: uploaded.storageIds };
      currentOcrResult = result;
    } catch (e) {
      submitLocalError.value = e instanceof Error ? e.message : "Receipt upload failed. Try again.";
      return;
    }
  }

  emit("submit", {
    ...form,
    amount,
    receiptImageId: result?.storageId,
    receiptImageIds: result?.storageIds ? [...result.storageIds] : undefined,
    ocrSource: result?.source,
    ocrConfidence: result?.confidence,
    ocrRawText: result?.rawText,
    ocrNeedsReview: result ? result.source === "tesseract" || !!result.lowConfidence : false,
    clientRequestId: clientRequestId || undefined,
    lineItems: result?.lineItems?.map((li) => ({
      description: li.description,
      quantity: li.quantity,
      unitPrice: li.unitPrice,
      totalPrice: li.totalPrice,
      categoryHint: li.categoryHint,
    })),
  });
}
</script>

<style scoped>
.hhb-modal form { gap: var(--hhb-space-4); }
.hhb-mt-1 { margin-top: var(--hhb-space-1); }
.ocr-status {
  padding: var(--hhb-space-3);
  background: var(--hhb-color-bg-alt);
  border-radius: var(--hhb-radius);
  border: 1px solid var(--hhb-color-border);
}
.ocr-progress {
  display: flex;
  flex-direction: column;
  gap: var(--hhb-space-1);
  font-size: var(--hhb-text-sm);
}
.ocr-progress progress { width: 100%; height: 0.375rem; accent-color: var(--hhb-color-primary); }
.ocr-error, .form-error { color: var(--hhb-color-error); font-size: var(--hhb-text-sm); margin-top: var(--hhb-space-1); }
.ocr-warning { color: var(--hhb-color-warning); font-size: var(--hhb-text-sm); margin-top: var(--hhb-space-1); }
.ocr-controls { display: flex; gap: var(--hhb-space-2); margin-top: var(--hhb-space-2); }
</style>
