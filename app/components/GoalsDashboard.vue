<script setup lang="ts">
import { ref } from "vue";
import { useGoals } from "~/composables/useGoals";
import { useCategories } from "~/composables/useAdvancedFeatures";
import GoalCard from "~/components/GoalCard.vue";
import type { Id } from "~~/convex/_generated/dataModel";

const {
  activeGoals,
  completedGoals,
  pausedGoals,
  totalProgress,
  isLoading,
  createGoal,
  deleteGoal,
  templateDefaults,
  templates,
} = useGoals();

const {
  data: categories,
  isLoading: categoriesIsLoading,
} = useCategories();

const showCreateModal = ref(false);
const showTemplatePicker = ref(false);

// Explicitly typed new goal form state
const newGoal = ref<{
  name: string;
  type: "savings_target" | "monthly_spending_limit" | "category_budget" | "debt_payoff";
  targetAmount: number;
  currentAmount: number;
  alertAtPercent: number;
  categoryId: Id<"categories"> | undefined;
}>({
  name: "",
  type: "savings_target",
  targetAmount: 1000,
  currentAmount: 0,
  alertAtPercent: 80,
  categoryId: undefined,
});

// Safe template picker — guards against empty templates
const firstTemplate = templates[0];
const pickerGoal = ref(
  firstTemplate ? { ...templateDefaults(firstTemplate) } : {
    name: "",
    type: "savings_target" as const,
    targetAmount: 1000,
    alertAtPercent: 80,
  }
);

const handleCreate = async () => {
  if (!newGoal.value.name.trim()) return;
  await createGoal({
    name: newGoal.value.name.trim(),
    type: newGoal.value.type,
    targetAmount: newGoal.value.targetAmount,
    currentAmount: newGoal.value.currentAmount,
    alertAtPercent: newGoal.value.alertAtPercent,
    categoryId: newGoal.value.categoryId,
  });
  newGoal.value.name = "";
  showCreateModal.value = false;
  showTemplatePicker.value = false;
};

const applyTemplate = (template: typeof templates[number]) => {
  pickerGoal.value = { ...templateDefaults(template) };
  showTemplatePicker.value = false;
};

const handleDelete = async (goalId: Id<"goals">) => {
  await deleteGoal({ goalId });
};

const handleClose = () => {
  showCreateModal.value = false;
  showTemplatePicker.value = false;
};

// Helper: template icon lookup
const typeIcon = (type: string): string => {
  const icons: Record<string, string> = {
    savings_target: "shield",
    monthly_spending_limit: "wallet",
    category_budget: "tag",
    debt_payoff: "credit-card",
  };
  return icons[type] ?? "target";
};
</script>

<template>
  <div class="goals-dashboard">
    <div v-if="isLoading" class="hhb-empty">
      <p class="hhb-text-secondary">Loading goals…</p>
    </div>

    <div v-else-if="activeGoals.length === 0 && completedGoals.length === 0 && pausedGoals.length === 0" class="hhb-empty">
      <p class="hhb-text-secondary">No goals yet. Create your first goal to track progress.</p>
    </div>

    <div v-else class="goal-section">
      <div class="goal-section__summary">
        <span class="goal-section__count">{{ activeGoals.length }} active</span>
        <span class="goal-section__progress">{{ Math.round(totalProgress) }}% overall</span>
      </div>

      <div class="goal-section__list">
        <GoalCard
          v-for="goal in activeGoals"
          :key="goal._id"
          :goal="goal"
          :on-delete="() => handleDelete(goal._id)"
        />
      </div>

      <div v-if="completedGoals.length > 0" class="goal-section__completed">
        <h4 class="goal-section__title">Completed</h4>
        <div class="goal-section__list">
          <GoalCard
            v-for="goal in completedGoals"
            :key="goal._id"
            :goal="goal"
            :on-delete="() => handleDelete(goal._id)"
          />
        </div>
      </div>
    </div>

    <!-- Create modal -->
    <div v-if="showCreateModal" class="hhb-modal" @keydown.esc="handleClose">
      <div class="hhb-modal__content">
        <h2 class="hhb-modal__title">Create Goal</h2>

        <div v-if="categoriesIsLoading" class="hhb-empty">
          <p class="hhb-text-secondary">Loading categories…</p>
        </div>

        <div v-else-if="categories && categories.length > 0" class="goal-form">
          <label>
            <span class="hhb-text-semibold">Goal name</span>
            <input
              v-model="newGoal.name"
              type="text"
              class="hhb-input"
              placeholder="e.g. Emergency Fund"
            >
          </label>

          <label>
            <span class="hhb-text-sm hhb-text-secondary">Goal type</span>
            <select v-model="newGoal.type" class="hhb-select">
              <option value="savings_target">Savings Target</option>
              <option value="monthly_spending_limit">Monthly Spending Limit</option>
              <option value="category_budget">Category Budget</option>
              <option value="debt_payoff">Debt Payoff</option>
            </select>
          </label>

          <label>
            <span class="hhb-text-sm hhb-text-secondary">Target amount</span>
            <input
              v-model.number="newGoal.targetAmount"
              type="number"
              class="hhb-input"
              placeholder="e.g. 10000"
            >
          </label>

          <label>
            <span class="hhb-text-sm hhb-text-secondary">Current amount</span>
            <input
              v-model.number="newGoal.currentAmount"
              type="number"
              class="hhb-input"
              min="0"
              placeholder="e.g. 2500"
            >
          </label>

          <label>
            <span class="hhb-text-sm hhb-text-secondary">Alert threshold</span>
            <input
              v-model.number="newGoal.alertAtPercent"
              type="number"
              class="hhb-input"
              min="1"
              max="99"
              placeholder="e.g. 80"
            >
          </label>

          <label>
            <span class="hhb-text-sm hhb-text-secondary">Category</span>
            <select v-model="newGoal.categoryId" class="hhb-select">
              <option disabled>Select a category</option>
              <option
                v-for="cat in categories"
                :key="cat._id"
                :value="cat._id"
              >
                {{ cat.name }}
              </option>
            </select>
          </label>
        </div>

        <div v-else class="hhb-empty">
          <p class="hhb-text-secondary">No categories configured yet. Add categories in Settings.</p>
        </div>

        <button type="button" class="hhb-btn hhb-btn--primary" @click="handleCreate">Create Goal</button>
        <button type="button" class="hhb-btn hhb-btn--secondary" @click="showCreateModal = false">Cancel</button>
      </div>
    </div>

    <!-- Template picker -->
    <div v-if="showTemplatePicker" class="hhb-modal" @keydown.esc="handleClose">
      <div class="hhb-modal__content">
        <h2 class="hhb-modal__title">Goal Template</h2>
        <p class="hhb-text-secondary">Pick a template to pre-fill goal details.</p>

        <div class="template-grid">
          <template v-for="template in templates" :key="template.name">
            <div
              class="template-card"
              role="button"
              tabindex="0"
              @click="applyTemplate(template)"
              @keydown.enter.prevent="applyTemplate(template)"
              @keyup.space.prevent="applyTemplate(template)"
            >
              <span class="template-icon">{{ typeIcon(template.type) }}</span>
              <h3 class="template-name">{{ template.name }}</h3>
              <p class="template-target">Target: ${{ template.targetAmount }}</p>
            </div>
          </template>
        </div>

        <button type="button" class="hhb-btn hhb-btn--secondary" @click="showTemplatePicker = false">Cancel</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.goals-dashboard {
  .goal-section__summary {
    display: flex;
    align-items: center;
    gap: var(--hhb-space-3);
    margin-bottom: var(--hhb-space-4);
  }

  .goal-section__count {
    font-size: var(--hhb-text-sm);
    color: var(--hhb-color-text-secondary);
  }

  .goal-section__progress {
    font-size: var(--hhb-text-xl);
    font-weight: var(--hhb-font-bold);
    color: var(--hhb-color-primary-dark);
  }

  .goal-section__list {
    display: flex;
    flex-direction: column;
    gap: var(--hhb-space-3);
  }

  .template-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: var(--hhb-space-3);
    margin-top: var(--hhb-space-3);
  }

  .template-card {
    background: var(--hhb-color-bg-alt);
    border: 1px solid var(--hhb-color-border);
    border-radius: var(--hhb-radius-lg);
    padding: var(--hhb-space-3);
    cursor: pointer;
    transition: all var(--hhb-transition-base);
  }

  .template-card:hover {
    border-color: var(--hhb-color-primary-light);
    box-shadow: var(--hhb-shadow-sm);
  }

  .template-card:focus-visible {
    outline: 2px var(--hhb-color-primary) solid;
    outline-offset: 2px;
  }

  .template-icon {
    width: 2rem;
    height: 2rem;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--hhb-color-primary-subtle);
    border-radius: var(--hhb-radius-full);
    margin-bottom: var(--hhb-space-2);
    font-size: var(--hhb-text-xl);
  }

  .template-name {
    font-size: var(--hhb-text-sm);
    font-weight: var(--hhb-font-semibold);
    margin: var(--hhb-space-1) 0;
  }

  .template-target {
    font-size: var(--hhb-text-xs);
    color: var(--hhb-color-text-secondary);
  }
</style>