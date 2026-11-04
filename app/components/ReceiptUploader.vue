<template>
  <div class="receipt-uploader">
    <div v-if="previewUrl" class="preview">
      <img :src="previewUrl" alt="Receipt preview" class="preview-image">
      <button type="button" class="remove-btn" @click="clearImage">Remove</button>
    </div>

    <label v-else class="upload-label">
      <input
        type="file"
        accept="image/*"
        capture="environment"
        @change="handleFileSelect"
      >
      <span class="upload-icon">📷</span>
      <span class="upload-text">Add Receipt Photo</span>
    </label>

    <p v-if="error" class="error-message">{{ error }}</p>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from "vue";

const props = withDefaults(defineProps<{
  modelValue?: File | null;
}>(), {
  modelValue: null,
});

const emit = defineEmits<{
  (e: "update:modelValue" | "change", file: File | null): void;
}>();

const error = ref<string | null>(null);

const previewUrl = computed<string | null>(() => {
  if (!props.modelValue) return null;
  return URL.createObjectURL(props.modelValue);
});

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/heic"];
const MAX_SIZE = 5 * 1024 * 1024;

function handleFileSelect(event: Event) {
  const target = event.target as HTMLInputElement;
  if (!target.files || target.files.length === 0) return;

  const selected = target.files[0];
  if (!selected) return;

  if (!ALLOWED_TYPES.includes(selected.type)) {
    error.value = "Please select a JPEG, PNG, or HEIC image.";
    return;
  }

  if (selected.size > MAX_SIZE) {
    error.value = "Image must be under 5MB.";
    return;
  }

  error.value = null;
  emit("update:modelValue", selected);
  emit("change", selected);
  target.value = "";
}

function clearImage() {
  emit("update:modelValue", null);
  emit("change", null);
  error.value = null;
}

watch(previewUrl, (newUrl, oldUrl) => {
  if (oldUrl) URL.revokeObjectURL(oldUrl);
});
</script>

<style scoped>
.receipt-uploader {
  margin: 1rem 0;
}

.upload-label {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 1.5rem;
  border: 2px dashed var(--hhb-color-border);
  border-radius: var(--hhb-radius-lg);
  cursor: pointer;
  background: var(--hhb-color-bg);
  transition: border-color 0.2s;
}

.upload-label:hover {
  border-color: var(--hhb-color-primary);
}

.upload-label input {
  display: none;
}

.upload-icon {
  font-size: 1.5rem;
}

.upload-text {
  font-size: 0.875rem;
  color: var(--hhb-color-text);
}

.preview {
  position: relative;
  display: inline-block;
}

.preview-image {
  max-width: 100%;
  max-height: 200px;
  border-radius: var(--hhb-radius-lg);
  border: 1px solid var(--hhb-color-border);
}

.remove-btn {
  position: absolute;
  top: 4px;
  right: 4px;
  background: rgba(0, 0, 0, 0.6);
  color: white;
  border: none;
  border-radius: 50%;
  width: 20px;
  height: 20px;
  cursor: pointer;
}

.error-message {
  color: var(--hhb-color-error, #ef4444);
  font-size: 0.75rem;
  margin-top: 0.25rem;
}
</style>
