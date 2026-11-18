<template>
  <div class="receipt-uploader">
    <div v-if="previews.length > 0" class="photo-grid">
      <div v-for="(p, i) in previews" :key="p.url" class="photo-thumb">
        <img :src="p.url" :alt="`Receipt section ${i + 1} of ${previews.length}`" class="photo-thumb__img">
        <span class="photo-thumb__number">{{ i + 1 }}</span>
        <div class="photo-thumb__controls">
          <button type="button" :disabled="i === 0" :aria-label="`Move receipt section ${i + 1} earlier`" @click="movePhoto(i, -1)">‹</button>
          <button type="button" :disabled="i === previews.length - 1" :aria-label="`Move receipt section ${i + 1} later`" @click="movePhoto(i, 1)">›</button>
          <button type="button" class="photo-thumb__remove" :aria-label="`Remove receipt section ${i + 1}`" @click="removePhoto(i)">×</button>
        </div>
      </div>
    </div>

    <div class="upload-actions">
      <label class="upload-label">
        <input type="file" accept="image/*" capture="environment" aria-describedby="receipt-upload-error" @change="handleFileSelect">
        <span class="upload-icon" aria-hidden="true">📷</span>
        <span class="upload-text">Take photo</span>
      </label>
      <label class="upload-label">
        <input type="file" accept="image/*" multiple aria-describedby="receipt-upload-error" @change="handleFileSelect">
        <span class="upload-icon" aria-hidden="true">🖼️</span>
        <span class="upload-text">Choose photos</span>
      </label>
    </div>
    <p class="upload-hint">Add up to 4 sections of the same receipt, in top-to-bottom order.</p>
    <p class="upload-hint">When online, receipt images are processed by our AI provider to suggest expense details.</p>
    <p v-if="error" id="receipt-upload-error" class="error-message" role="alert">{{ error }}</p>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from "vue";

const MAX_PHOTOS = 4;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/heic"];
const MAX_SIZE = 5 * 1024 * 1024;

const props = withDefaults(defineProps<{ modelValue?: File[] }>(), {
  modelValue: () => [],
});
const emit = defineEmits<{
  (e: "update:modelValue" | "change", files: File[]): void;
}>();

const error = ref<string | null>(null);
const urls = new Map<File, string>();

function urlFor(file: File) {
  let url = urls.get(file);
  if (!url) {
    url = URL.createObjectURL(file);
    urls.set(file, url);
  }
  return url;
}

const previews = computed(() => props.modelValue.map((file) => ({ url: urlFor(file), name: file.name })));

watch(() => props.modelValue, (next, previous) => {
  for (const file of previous || []) {
    if (!next.includes(file)) {
      const url = urls.get(file);
      if (url) URL.revokeObjectURL(url);
      urls.delete(file);
    }
  }
});

onUnmounted(() => {
  for (const url of urls.values()) URL.revokeObjectURL(url);
  urls.clear();
});

function handleFileSelect(event: Event) {
  const target = event.target as HTMLInputElement;
  if (!target.files?.length) return;
  const selected = Array.from(target.files);
  if (props.modelValue.length + selected.length > MAX_PHOTOS) {
    error.value = `You can add up to ${MAX_PHOTOS} receipt photos.`;
    target.value = "";
    return;
  }
  for (const file of selected) {
    if (!ALLOWED_TYPES.includes(file.type)) {
      error.value = "Please select JPEG, PNG, or HEIC images.";
      target.value = "";
      return;
    }
    if (file.size > MAX_SIZE) {
      error.value = "Each image must be under 5MB.";
      target.value = "";
      return;
    }
  }
  error.value = null;
  const next = [...props.modelValue, ...selected];
  emit("update:modelValue", next);
  emit("change", next);
  target.value = "";
}

function removePhoto(index: number) {
  const next = props.modelValue.filter((_, i) => i !== index);
  emit("update:modelValue", next);
  emit("change", next);
}

function movePhoto(index: number, direction: number) {
  const destination = index + direction;
  if (destination < 0 || destination >= props.modelValue.length) return;
  const next = [...props.modelValue];
  [next[index], next[destination]] = [next[destination]!, next[index]!];
  emit("update:modelValue", next);
  emit("change", next);
}
</script>

<style scoped>
.photo-grid { display: flex; flex-wrap: wrap; gap: var(--hhb-space-2); margin-bottom: var(--hhb-space-3); }
.photo-thumb { position: relative; width: 5rem; }
.photo-thumb__img { width: 5rem; height: 5rem; object-fit: cover; border-radius: var(--hhb-radius); border: 1px solid var(--hhb-color-border); }
.photo-thumb__number { position: absolute; left: 0.25rem; top: 0.25rem; padding: 0 0.35rem; border-radius: var(--hhb-radius-full); background: rgba(15,23,42,.75); color: white; font-size: var(--hhb-text-xs); }
.photo-thumb__controls { display: flex; justify-content: center; gap: 0.1rem; margin-top: 0.15rem; }
.photo-thumb__controls button { min-width: 1.75rem; min-height: 1.75rem; padding: 0; border: none; background: transparent; color: var(--hhb-color-text-secondary); cursor: pointer; }
.photo-thumb__controls button:disabled { opacity: .3; }
.photo-thumb__remove { color: var(--hhb-color-error) !important; }
.upload-actions { display: grid; grid-template-columns: 1fr 1fr; gap: var(--hhb-space-2); }
.upload-label { display: flex; flex-direction: column; align-items: center; gap: var(--hhb-space-1); padding: var(--hhb-space-3); border: 2px dashed var(--hhb-color-border-strong); border-radius: var(--hhb-radius-lg); cursor: pointer; background: var(--hhb-color-bg-alt); }
.upload-label:hover, .upload-label:focus-within { border-color: var(--hhb-color-primary); background: var(--hhb-color-primary-subtle); }
.upload-label input { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); clip-path: inset(50%); white-space: nowrap; }
.upload-icon { font-size: 1.25rem; }
.upload-text { font-size: var(--hhb-text-sm); font-weight: var(--hhb-font-medium); }
.upload-hint { margin-top: var(--hhb-space-2); font-size: var(--hhb-text-xs); color: var(--hhb-color-text-secondary); }
.error-message { color: var(--hhb-color-error); font-size: var(--hhb-text-xs); margin-top: var(--hhb-space-1); }
@media (pointer: coarse) {
  .photo-thumb__controls button { min-width: 44px; min-height: 44px; }
}
</style>
