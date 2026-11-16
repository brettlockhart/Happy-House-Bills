<script setup lang="ts">
import { computed } from "vue";
import { useExpenses, usePendingExpenses } from "~/composables/useExpenses";
import { useSettlements } from "~/composables/useSettlements";
import { formatCurrency, formatRelativeDate } from "~/utils/formatting";
import CategoryBadge from "~/components/CategoryBadge.vue";

import type { Id } from "~/convex/_generated/dataModel";

const props = withDefaults(defineProps<{
  currentUserId?: string;
}>(), {
  currentUserId: "",
});

const { data: expenses } = useExpenses();
const { approveExpense, rejectExpense } = usePendingExpenses();
const { data: settlements } = useSettlements();

const entries = computed(() => {
  const all: Array<{
    type: "expense" | "settlement";
    id: Id<"expenses"> | Id<"settlements">;
    date: string;
    amount: number;
    description: string;
    category?: string;
    categoryColor?: string;
    categoryIcon?: string;
    isPending: boolean;
    isMine: boolean;
    paidBy: string;
  }> = [];

  for (const exp of expenses.value) {
    all.push({
      type: "expense",
      id: exp._id,
      date: exp.date,
      amount: exp.amount,
      description: exp.notes || exp.category,
      category: exp.category,
      categoryColor: exp.categoryColor,
      categoryIcon: exp.categoryIcon,
      isPending: exp.status === "pending",
      isMine: exp.enteredBy === props.currentUserId,
      paidBy: exp.paidBy,
    });
  }

  for (const sett of settlements.value) {
    all.push({
      type: "settlement",
      id: sett._id,
      date: sett.date,
      amount: sett.amount,
    description: sett.fromUser === props.currentUserId
      ? `You paid ${sett.toUser === props.currentUserId ? "them" : "partner"}`
      : `Partner paid you`,
    isPending: false,
    isMine: sett.fromUser === props.currentUserId,
    paidBy: sett.fromUser,
    });
  }

  return all.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
});

async function handleApprove(expense: { id: Id<"expenses"> | Id<"settlements">; type: "expense" | "settlement" }) {
  if (expense.type === "expense") {
    await approveExpense({ expenseId: expense.id as Id<"expenses"> });
  }
}

async function handleReject(expense: { id: Id<"expenses"> | Id<"settlements">; type: "expense" | "settlement" }) {
  if (expense.type === "expense") {
    await rejectExpense({ expenseId: expense.id as Id<"expenses"> });
  }
}
</script>

<template>
  <div class="hhb-entry-list">
    <div v-if="entries.length === 0" class="hhb-empty-state">
      <p>No expenses or settlements yet.</p>
      <p>Add an expense to get started.</p>
    </div>

<div v-else class="hhb-entries">
      <div v-for="entry in entries" :key="`${entry.type}-${entry.id}`" class="hhb-entry">
        <div class="hhb-entry-main">
          <span class="hhb-entry-type" :class="entry.type">
            {{ entry.type === "settlement" ? "Settlement" : (entry.description || "Expense") }}
          </span>
          <span class="hhb-entry-date">{{ formatRelativeDate(entry.date) }}</span>
          <CategoryBadge
            v-if="entry.categoryColor"
            :category="entry.category || ''"
            :color="entry.categoryColor"
            :icon="entry.categoryIcon"
          />
        </div>
        <div class="hhb-entry-amount">
          {{ formatCurrency(entry.amount) }}
        </div>
        <div v-if="entry.isPending && entry.type === 'expense' && !entry.isMine" class="hhb-entry-actions">
          <button
            class="hhb-btn hhb-btn--sm hhb-btn--ghost"
            aria-label="Approve expense"
            @click="handleApprove(entry)"
          >
            &#10003;
          </button>
          <button
            class="hhb-btn hhb-btn--sm hhb-btn--ghost"
            aria-label="Reject expense"
            @click="handleReject(entry)"
          >
            &#10007;
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.hhb-entry-list {
  margin-top: var(--hhb-space-4);
}

.hhb-empty-state {
  text-align: center;
  padding: var(--hhb-space-8);
  color: var(--hhb-color-text-secondary);
}

.hhb-entry {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--hhb-space-3) 0;
  border-bottom: 1px solid var(--hhb-color-border);
}

.hhb-entry-main {
  flex: 1;
}

.hhb-entry-type {
  font-size: var(--hhb-text-sm);
  font-weight: 500;
  color: var(--hhb-color-text);
}

.hhb-entry-type.expense {
  color: var(--hhb-color-text);
}

.hhb-entry-type.settlement {
  color: var(--hhb-color-success);
}

.hhb-entry-date {
  font-size: var(--hhb-text-xs);
  color: var(--hhb-color-text-secondary);
}

.hhb-entry-amount {
  font-weight: 600;
  font-size: var(--hhb-text-base);
}

.hhb-entry-actions {
  display: flex;
  gap: var(--hhb-space-1);
  margin-left: var(--hhb-space-2);
}
</style>
