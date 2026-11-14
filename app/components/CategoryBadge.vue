<script setup lang="ts">
import { computed } from "vue";

interface CategoryBadgeProps {
  category: string;
  color: string;
  icon?: string;
}

const props = defineProps<CategoryBadgeProps>();

const badgeStyle = computed(() => ({
  borderColor: props.color || "var(--hhb-color-border)",
  backgroundColor: props.color ? `${props.color}1a` : "var(--hhb-color-bg)",
}));

const iconStyle = computed(() => ({
  color: props.color || "var(--hhb-color-text-secondary)",
}));
</script>

<template>
  <span class="hhb-category-badge" :style="badgeStyle">
    <span v-if="icon" class="hhb-badge-icon" :style="iconStyle">{{ icon }}</span>
    <span class="hhb-badge-text">{{ category }}</span>
  </span>
</template>

<style scoped>
.hhb-category-badge {
  display: inline-flex;
  align-items: center;
  gap: var(--hhb-space-1);
  padding: var(--hhb-space-1) var(--hhb-space-2);
  background: var(--hhb-color-bg);
  border: 1px solid var(--hhb-color-border);
  border-radius: var(--hhb-radius-sm);
  font-size: var(--hhb-text-sm);
  font-weight: 500;
  color: var(--hhb-color-text);
}

.hhb-category-badge .hhb-badge-icon {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: var(--hhb-text-xs);
  line-height: 1;
}

.hhb-category-badge .hhb-badge-text {
  white-space: nowrap;
}
</style>
