<script setup lang="ts">
import { useAuth } from "~/composables/useAuth";
import { formatCurrency } from "~/utils/formatting";
import AddExpenseModal from "~/components/AddExpenseModal.vue";
import EntryList from "~/components/EntryList.vue";
import SettleUpModal from "~/components/SettleUpModal.vue";

const { balance, owesWhom, data } = useBalance();
const { userId, orgId } = useAuth();
const { createExpense } = useExpenses();
const { createSettlement } = useSettlements();

const isAddModalOpen = ref(false);
const isSettleModalOpen = ref(false);

const partnerUserId = computed(() => {
  if (!data.value) return "";
  return data.value.owesWhom || "";
});

const balanceDisplay = computed(() => {
  if (balance.value === 0) return "Balance: $0.00";
  const sign = balance.value > 0 ? "+" : "-";
  return `Balance: ${sign}${formatCurrency(Math.abs(balance.value))}`;
});

const owesDisplay = computed(() => {
  if (!data.value || !owesWhom.value) return "";
  if (balance.value > 0) return `You owe ${owesWhom.value}`;
  if (balance.value < 0) return `${owesWhom.value} owes you`;
  return "";
});

async function handleExpenseSubmit(expense: {
  amount: number;
  date: string;
  category: "groceries" | "utilities" | "other";
  notes?: string;
  paidBy: string;
  receiptImageId?: string;
  receiptPHash?: string;
  receiptFingerprint?: string;
}) {
  if (!orgId.value || !userId.value) return;

  await createExpense({
    ...expense,
    orgId: orgId.value,
  });
  isAddModalOpen.value = false;
}

async function handleSettleSubmit(settlement: {
  amount: number;
  fromUser: string;
  toUser: string;
}) {
  if (!orgId.value) return;

  await createSettlement({
    ...settlement,
    orgId: orgId.value,
    date: new Date().toISOString(),
  });
  isSettleModalOpen.value = false;
}
</script>

<template>
  <div class="hhb-page">
    <header class="hhb-header">
      <h1>Happy House Bills</h1>
      <p v-if="data" class="hhb-balance">
        {{ balanceDisplay }}
        <span v-if="owesDisplay" class="hhb-balance-sub">{{ owesDisplay }}</span>
      </p>
      <p v-else>Loading...</p>
      <div class="hhb-actions">
        <button
          class="hhb-btn hhb-btn--primary"
          @click="isAddModalOpen = true"
        >
          Add Expense
        </button>
        <button
          v-if="userId"
          class="hhb-btn hhb-btn--secondary"
          @click="isSettleModalOpen = true"
        >
          Settle Up
        </button>
      </div>
    </header>

    <div class="hhb-entry-list-container">
      <EntryList :current-user-id="userId ?? ''" />
    </div>

    <AddExpenseModal
      :is-open="isAddModalOpen"
      :current-user-id="userId ?? ''"
      @close="isAddModalOpen = false"
      @submit="handleExpenseSubmit"
    />

    <SettleUpModal
      v-if="userId"
      :is-open="isSettleModalOpen"
      :current-user-id="userId"
      :partner-user-id="partnerUserId"
      @close="isSettleModalOpen = false"
      @submit="handleSettleSubmit"
    />
  </div>
</template>

<style scoped>
.hhb-page {
  max-width: 800px;
  margin: 0 auto;
  padding: var(--hhb-space-4);
}

.hhb-page {
  @media (min-width: 768px) {
    display: grid;
    grid-template-columns: 280px 1fr;
    gap: var(--hhb-space-6);
    align-items: start;
    margin-top: var(--hhb-space-6);
  }
}

.hhb-header {
  padding: var(--hhb-space-4);
  border-bottom: 1px solid var(--hhb-color-border);
}

.hhb-header {
  @media (min-width: 768px) {
    border-bottom: none;
    border-right: 1px solid var(--hhb-color-border);
    padding-right: var(--hhb-space-6);
  }
}

.hhb-balance {
  font-size: var(--hhb-text-lg);
  font-weight: 600;
}

.hhb-balance-sub {
  display: block;
  font-size: var(--hhb-text-sm);
  color: var(--hhb-color-text-secondary);
  font-weight: 400;
}

.hhb-actions {
  display: flex;
  gap: var(--hhb-space-2);
  margin-top: var(--hhb-space-4);
}

.hhb-entry-list-container {
  margin-top: var(--hhb-space-4);
}

.hhb-entry-list-container {
  @media (min-width: 768px) {
    border-left: 1px solid var(--hhb-color-border);
    padding-left: var(--hhb-space-6);
  }
}
</style>
