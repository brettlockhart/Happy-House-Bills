<script setup lang="ts">
import { useCategories } from "~/composables/useAdvancedFeatures";

const { data: categories, createCategory, updateCategory, deleteCategory, isLoading } = useCategories();

const showModal = ref(false);
const isEditing = ref(false);
const editingCategory = ref<{ _id: string; name: string; color: string } | null>(null);
const newName = ref("");
const newColor = ref("#10b981");

async function handleCreate() {
  if (!newName.value.trim()) return;
  try {
    await createCategory({ name: newName.value, color: newColor.value });
    newName.value = "";
    newColor.value = "#10b981";
    showModal.value = false;
  } catch (e) {
    alert(e instanceof Error ? e.message : "Failed to create category");
  }
}

async function handleUpdate() {
  if (!editingCategory.value) return;
  try {
    await updateCategory({
      id: editingCategory.value._id,
      name: editingCategory.value.name,
      color: editingCategory.value.color,
    });
    editingCategory.value = null;
    showModal.value = false;
  } catch (e) {
    alert(e instanceof Error ? e.message : "Failed to update category");
  }
}

async function handleDelete(cat: { _id: string; name: string }) {
  if (!confirm(`Delete "${cat.name}"? Expenses will be moved to 'other'.`)) return;
  try {
    await deleteCategory({ id: cat._id });
  } catch (e) {
    alert(e instanceof Error ? e.message : "Failed to delete category");
  }
}

function editCategory(cat: { _id: string; name: string; color: string }) {
  isEditing.value = true;
  editingCategory.value = { ...cat };
  showModal.value = true;
}

function newCategoryClick() {
  isEditing.value = false;
  editingCategory.value = null;
  newName.value = "";
  newColor.value = "#10b981";
  showModal.value = true;
}
</script>

<template>
  <div class="category-manager">
    <div class="hhb-flex hhb-justify-between hhb-items-center hhb-mb-4">
      <h2 class="hhb-text-lg hhb-font-semibold">Categories</h2>
      <button :disabled="isLoading" class="hhb-btn hhb-btn-primary" @click="newCategoryClick">
        {{ isLoading ? "Loading..." : "Add Category" }}
      </button>
    </div>

    <table class="hhb-table">
      <thead>
        <tr>
          <th>Name</th>
          <th>Color</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="cat in categories" :key="cat._id">
          <td>{{ cat.name }}</td>
          <td>
            <span class="hhb-flex hhb-items-center hhb-gap-2">
              <span class="hhb-w-4 hhb-h-4 hhb-rounded" :style="{ backgroundColor: cat.color }"/>
              {{ cat.color }}
            </span>
          </td>
          <td class="hhb-flex hhb-gap-2">
            <button :disabled="isLoading" class="hhb-btn hhb-btn-sm hhb-btn-secondary" @click="editCategory(cat)">Edit</button>
            <button :disabled="isLoading" class="hhb-btn hhb-btn-sm hhb-btn-danger" @click="handleDelete(cat)">Delete</button>
          </td>
        </tr>
      </tbody>
    </table>

    <div v-if="categories.length === 0" class="hhb-text-center hhb-text-muted hhb-py-8">No custom categories yet</div>

    <div v-if="showModal" class="hhb-modal-overlay">
      <div class="hhb-modal">
        <h3 class="hhb-text-lg hhb-font-semibold hhb-mb-4">
          {{ isEditing ? "Edit Category" : "New Category" }}
        </h3>

        <div v-if="isEditing" class="hhb-form-group">
          <label class="hhb-label">Name</label>
          <input
            v-model="editingCategory!.name"
            type="text"
            class="hhb-input"
            placeholder="Category name"
          >
        </div>
        <div v-if="isEditing" class="hhb-form-group">
          <label class="hhb-label">Color</label>
          <input
            v-model="editingCategory!.color"
            type="color"
            class="hhb-input hhb-w-16"
          >
        </div>

        <div v-if="!isEditing" class="hhb-form-group">
          <label class="hhb-label">Name</label>
          <input
            v-model="newName"
            type="text"
            class="hhb-input"
            placeholder="Category name"
          >
        </div>
        <div v-if="!isEditing" class="hhb-form-group">
          <label class="hhb-label">Color</label>
          <input
            v-model="newColor"
            type="color"
            class="hhb-input hhb-w-16"
          >
        </div>

        <div class="hhb-flex hhb-justify-end hhb-gap-2 hhb-mt-4">
          <button :disabled="isLoading" class="hhb-btn hhb-btn-secondary" @click="showModal = false">Cancel</button>
          <button
            :disabled="isLoading"
            class="hhb-btn hhb-btn-primary"
            @click="isEditing ? handleUpdate : handleCreate"
          >
            {{ isLoading ? "Saving..." : (isEditing ? "Update" : "Create") }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>