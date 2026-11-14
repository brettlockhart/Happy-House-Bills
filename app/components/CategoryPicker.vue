<script setup lang="ts">
import { computed, ref } from "vue";
import { useCategories } from "~/composables/useAdvancedFeatures";
import type { Doc } from "~/convex/_generated/dataModel";

type Category = Doc<"categories">;

const props = withDefaults(defineProps<{
  modelValue?: boolean;
}>(), {
  modelValue: false,
});

const emit = defineEmits<{
  (e: "update:modelValue", value: boolean): void;
  (e: "select", category: Category): void;
  (e: "close"): void;
}>();

const { data: categories, isLoading, createCategory } = useCategories();

const searchQuery = ref("");
const newName = ref("");
const newColor = ref("#10b981");
const showCreate = ref(false);
const isCreating = ref(false);

interface GroupedCategory {
  parent: Category;
  children: Category[];
}

const sortedRoots = computed<Category[]>(() =>
  (categories.value || [])
    .filter((c: Category) => !c.parentId)
    .sort((a: Category, b: Category) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)),
);

const grouped = computed<GroupedCategory[]>(() => {
  const all = categories.value || [];
  return sortedRoots.value.map((parent: Category) => ({
    parent,
    children: all
      .filter((c: Category) => c.parentId === parent._id)
      .sort((a: Category, b: Category) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)),
  }));
});

const filteredGroups = computed<GroupedCategory[]>(() => {
  const q = searchQuery.value.trim().toLowerCase();
  if (!q) return grouped.value;

  const matches = (c: Category) =>
    c.name.toLowerCase().includes(q) || (c.icon ? c.icon.toLowerCase().includes(q) : false);

  return grouped.value
    .map((group) => {
      const parentMatches = matches(group.parent);
      const matchingChildren = group.children.filter(matches);
      if (parentMatches) return { parent: group.parent, children: group.children };
      if (matchingChildren.length > 0) return { parent: group.parent, children: matchingChildren };
      return null;
    })
    .filter((g): g is GroupedCategory => g !== null);
});

function close() {
  emit("update:modelValue", false);
  emit("close");
}

function select(category: Category) {
  emit("select", category);
  close();
}

async function handleCreate() {
  if (!newName.value.trim()) return;
  isCreating.value = true;
  try {
    await createCategory({ name: newName.value.trim(), color: newColor.value });
    newName.value = "";
    newColor.value = "#10b981";
    showCreate.value = false;
  } finally {
    isCreating.value = false;
  }
}
</script>

<template>
  <div v-if="props.modelValue" class="hhb-modal-overlay" @click.self="close">
    <div class="hhb-modal category-picker" role="dialog" aria-modal="true" aria-label="Select category">
      <div class="picker-header">
        <h2 class="hhb-text-lg hhb-font-semibold">Select Category</h2>
        <button type="button" class="hhb-btn hhb-btn-sm hhb-btn-ghost" @click="close">✕</button>
      </div>

      <input
        v-model="searchQuery"
        type="search"
        class="hhb-input"
        placeholder="Search categories..."
      >

      <p v-if="isLoading" class="hhb-text-muted hhb-py-6 hhb-text-center">Loading categories...</p>

      <div v-else-if="filteredGroups.length === 0" class="hhb-text-muted hhb-py-6 hhb-text-center">
        No categories found
      </div>

      <ul v-else class="picker-list">
        <li v-for="group in filteredGroups" :key="group.parent._id" class="picker-group">
          <button type="button" class="picker-item picker-parent" @click="select(group.parent)">
            <span class="picker-dot" :style="{ backgroundColor: group.parent.color }" />
            <span class="picker-name">{{ group.parent.name }}</span>
            <span v-if="group.children.length" class="picker-count">{{ group.children.length }}</span>
          </button>
          <ul v-if="group.children.length" class="picker-children">
            <li v-for="child in group.children" :key="child._id">
              <button type="button" class="picker-item picker-child" @click="select(child)">
                <span class="picker-dot" :style="{ backgroundColor: child.color }" />
                <span class="picker-name">{{ child.name }}</span>
              </button>
            </li>
          </ul>
        </li>
      </ul>

      <div class="picker-footer">
        <button
          type="button"
          class="hhb-btn hhb-btn-sm hhb-btn-secondary"
          @click="showCreate = !showCreate"
        >
          {{ showCreate ? "Cancel" : "+ New category" }}
        </button>
      </div>

      <form v-if="showCreate" class="picker-create" @submit.prevent="handleCreate">
        <input v-model="newName" type="text" class="hhb-input" placeholder="Category name" >
        <input v-model="newColor" type="color" class="hhb-input picker-color" >
        <button type="submit" class="hhb-btn hhb-btn-primary" :disabled="isCreating">
          {{ isCreating ? "Creating..." : "Create" }}
        </button>
      </form>
    </div>
  </div>
</template>

<style scoped>
.category-picker {
  display: flex;
  flex-direction: column;
  gap: var(--hhb-space-3);
  max-height: 80vh;
}

.picker-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.picker-list {
  list-style: none;
  margin: 0;
  padding: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: var(--hhb-space-1);
}

.picker-group {
  display: flex;
  flex-direction: column;
}

.picker-item {
  display: flex;
  align-items: center;
  gap: var(--hhb-space-2);
  width: 100%;
  padding: var(--hhb-space-2);
  background: transparent;
  border: 1px solid transparent;
  border-radius: var(--hhb-radius-sm);
  font-size: var(--hhb-text-sm);
  color: var(--hhb-color-text);
  text-align: left;
  cursor: pointer;
}

.picker-item:hover {
  background: var(--hhb-color-bg-alt);
  border-color: var(--hhb-color-border);
}

.picker-parent {
  font-weight: 500;
}

.picker-children {
  list-style: none;
  margin: 0;
  padding: 0 0 0 var(--hhb-space-4);
}

.picker-child {
  font-size: var(--hhb-text-sm);
  color: var(--hhb-color-text-secondary);
}

.picker-dot {
  width: 0.75rem;
  height: 0.75rem;
  border-radius: 9999px;
  flex-shrink: 0;
}

.picker-name {
  flex: 1;
}

.picker-count {
  font-size: var(--hhb-text-xs);
  color: var(--hhb-color-text-secondary);
}

.picker-footer {
  display: flex;
  justify-content: flex-start;
}

.picker-create {
  display: flex;
  gap: var(--hhb-space-2);
  align-items: center;
}

.picker-create .hhb-input {
  flex: 1;
}

.picker-color {
  width: 3rem;
  flex: none;
  padding: 0;
  border: 1px solid var(--hhb-color-border);
  border-radius: var(--hhb-radius-sm);
}
</style>
