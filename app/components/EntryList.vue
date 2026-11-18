<script setup lang="ts">
import { computed, ref } from "vue";
import { useExpenses, usePendingExpenses } from "~/composables/useExpenses";
import { useSettlements } from "~/composables/useSettlements";
import { formatCurrency, formatRelativeDate } from "~/utils/formatting";
import CategoryBadge from "~/components/CategoryBadge.vue";

import type { Id } from "~~/convex/_generated/dataModel";

interface EntryLineItem {
  description: string;
  quantity?: number;
  unitPrice?: number;
  totalPrice?: number;
  categoryHint?: string;
}

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
    lineItems?: EntryLineItem[];
    needsReview?: boolean;
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
      lineItems: exp.lineItems as EntryLineItem[] | undefined,
      needsReview: exp.ocrNeedsReview,
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

const expandedKeys = ref<string[]>([]);
function entryKey(entry: { type: string; id: string }) {
  return `${entry.type}-${entry.id}`;
}
function isExpanded(key: string) {
  return expandedKeys.value.includes(key);
}
function toggleExpanded(key: string) {
  if (isExpanded(key)) {
    expandedKeys.value = expandedKeys.value.filter((k) => k !== key);
  } else {
    expandedKeys.value = [...expandedKeys.value, key];
  }
}

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
      <span class="hhb-empty-state__icon" aria-hidden="true">🧾</span>
      <p class="hhb-empty-state__title">No expenses or settlements yet</p>
      <p class="hhb-empty-state__text">Add an expense to get started.</p>
    </div>

    <ul v-else class="hhb-entries" role="list">
      <li
        v-for="entry in entries"
        :key="entryKey(entry)"
        class="hhb-entry"
      >
        <div class="hhb-entry__row">
          <span
            class="hhb-entry__avatar"
            :class="`hhb-entry__avatar--${entry.type}`"
            aria-hidden="true"
          >
            {{ entry.type === "settlement" ? "⇄" : (entry.categoryIcon || "•") }}
          </span>

          <div class="hhb-entry-main">
            <div class="hhb-entry__topline">
              <span class="hhb-entry-type" :class="entry.type">
                {{ entry.type === "settlement" ? "Settlement" : (entry.description || "Expense") }}
              </span>
              <span v-if="entry.isPending" class="hhb-badge hhb-badge--warning">Pending</span>
              <span v-if="entry.needsReview" class="hhb-badge hhb-badge--warning">Verify OCR</span>
            </div>
            <div class="hhb-entry__meta">
              <span class="hhb-entry-date">{{ formatRelativeDate(entry.date) }}</span>
              <CategoryBadge
                v-if="entry.categoryColor"
                :category="entry.category || ''"
                :color="entry.categoryColor"
                :icon="entry.categoryIcon"
              />
            </div>
          </div>

          <div class="hhb-entry__right">
            <span
              class="hhb-entry-amount"
              :class="entry.type === 'settlement' ? 'hhb-entry-amount--settlement' : ''"
            >
              {{ formatCurrency(entry.amount) }}
            </span>
            <div
              v-if="entry.isPending && entry.type === 'expense' && !entry.isMine"
              class="hhb-entry-actions"
            >
              <button
                class="hhb-btn hhb-btn--sm hhb-btn--ghost hhb-entry__approve"
                aria-label="Approve expense"
                @click="handleApprove(entry)"
              >
                &#10003;
              </button>
              <button
                class="hhb-btn hhb-btn--sm hhb-btn--ghost hhb-entry__reject"
                aria-label="Reject expense"
                @click="handleReject(entry)"
              >
                &#10007;
              </button>
            </div>
          </div>
        </div>

        <div
          v-if="entry.type === 'expense' && entry.lineItems && entry.lineItems.length > 0"
          class="hhb-entry__expand"
        >
          <button
            type="button"
            class="hhb-entry__toggle"
            :aria-expanded="isExpanded(entryKey(entry))"
            @click="toggleExpanded(entryKey(entry))"
          >
            <span class="hhb-entry__chevron" :class="{ 'is-open': isExpanded(entryKey(entry)) }">▸</span>
            {{ entry.lineItems.length }} item{{ entry.lineItems.length > 1 ? "s" : "" }}
          </button>

          <ul v-if="isExpanded(entryKey(entry))" class="hhb-line-items">
            <li
              v-for="(item, i) in entry.lineItems"
              :key="i"
              class="hhb-line-item"
            >
              <span class="hhb-line-item__desc">{{ item.description }}</span>
              <span class="hhb-line-item__qty">
                <template v-if="item.quantity && item.unitPrice">
                  {{ item.quantity }} × {{ formatCurrency(item.unitPrice) }}
                </template>
              </span>
              <span class="hhb-line-item__price">{{ item.totalPrice != null ? formatCurrency(item.totalPrice) : "—" }}</span>
            </li>
          </ul>
        </div>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.hhb-entry-list {
  width: 100%;
}

.hhb-empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--hhb-space-2);
  padding: var(--hhb-space-8) var(--hhb-space-4);
  text-align: center;
}
.hhb-empty-state__icon {
  font-size: 2rem;
  opacity: 0.55;
}
.hhb-empty-state__title {
  font-weight: var(--hhb-font-semibold);
  color: var(--hhb-color-text);
}
.hhb-empty-state__text {
  color: var(--hhb-color-text-secondary);
  font-size: var(--hhb-text-sm);
}

.hhb-entries {
  list-style: none;
  margin: 0;
  padding: 0;
}

.hhb-entry {
  border-bottom: 1px solid var(--hhb-color-border);
  transition: background var(--hhb-transition);
}
.hhb-entry:last-child {
  border-bottom: none;
}
.hhb-entry:hover {
  background: var(--hhb-color-bg-alt);
}

.hhb-entry__row {
  display: flex;
  align-items: center;
  gap: var(--hhb-space-3);
  padding: var(--hhb-space-3) var(--hhb-space-5);
}

.hhb-entry__avatar {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.25rem;
  height: 2.25rem;
  border-radius: var(--hhb-radius-full);
  background: var(--hhb-color-bg-sunken);
  color: var(--hhb-color-text-secondary);
  font-size: var(--hhb-text-base);
}
.hhb-entry__avatar--settlement {
  background: var(--hhb-color-success-subtle);
  color: var(--hhb-color-primary-dark);
}

.hhb-entry-main {
  flex: 1;
  min-width: 0;
}
.hhb-entry__topline {
  display: flex;
  align-items: center;
  gap: var(--hhb-space-2);
}
.hhb-entry-type {
  font-size: var(--hhb-text-sm);
  font-weight: var(--hhb-font-medium);
  color: var(--hhb-color-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.hhb-entry-type.settlement {
  color: var(--hhb-color-primary-dark);
}
.hhb-entry__meta {
  display: flex;
  align-items: center;
  gap: var(--hhb-space-2);
  margin-top: 2px;
}
.hhb-entry-date {
  font-size: var(--hhb-text-xs);
  color: var(--hhb-color-text-secondary);
}

.hhb-entry__right {
  display: flex;
  align-items: center;
  gap: var(--hhb-space-2);
  flex-shrink: 0;
}
.hhb-entry-amount {
  font-weight: var(--hhb-font-semibold);
  font-size: var(--hhb-text-base);
  font-variant-numeric: tabular-nums;
}
.hhb-entry-amount--settlement {
  color: var(--hhb-color-primary-dark);
}

.hhb-entry-actions {
  display: flex;
  gap: var(--hhb-space-1);
}
.hhb-entry__approve { color: var(--hhb-color-success); }
.hhb-entry__reject { color: var(--hhb-color-error); }

/* Collapsible line items */
.hhb-entry__expand {
  padding: 0 var(--hhb-space-5) var(--hhb-space-3);
}
.hhb-entry__toggle {
  display: inline-flex;
  align-items: center;
  gap: var(--hhb-space-1);
  background: none;
  border: none;
  padding: 0;
  min-height: 0;
  font-size: var(--hhb-text-xs);
  color: var(--hhb-color-text-secondary);
  cursor: pointer;
}
.hhb-entry__toggle:hover {
  color: var(--hhb-color-primary-dark);
}
.hhb-entry__chevron {
  display: inline-block;
  transition: transform var(--hhb-transition);
}
.hhb-entry__chevron.is-open {
  transform: rotate(90deg);
}

.hhb-line-items {
  list-style: none;
  margin: var(--hhb-space-2) 0 0;
  padding: var(--hhb-space-2) var(--hhb-space-3);
  background: var(--hhb-color-bg-alt);
  border-left: 2px solid var(--hhb-color-border);
  border-radius: var(--hhb-radius-sm);
}
.hhb-line-item {
  display: flex;
  align-items: baseline;
  gap: var(--hhb-space-3);
  padding: var(--hhb-space-1) 0;
  font-size: var(--hhb-text-xs);
}
.hhb-line-item__desc {
  flex: 1;
  color: var(--hhb-color-text);
}
.hhb-line-item__qty {
  color: var(--hhb-color-text-muted);
  white-space: nowrap;
}
.hhb-line-item__price {
  color: var(--hhb-color-text);
  font-weight: var(--hhb-font-medium);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
</style>
