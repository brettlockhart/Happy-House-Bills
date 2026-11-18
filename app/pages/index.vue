<script setup lang="ts">
import { useAuth } from "~/composables/useAuth";
import { useMembers } from "~/composables/useTeams";
import { useReceiptAI } from "~/composables/useReceiptAI";
import AddExpenseModal from "~/components/AddExpenseModal.vue";
import EntryList from "~/components/EntryList.vue";
import SettleUpModal from "~/components/SettleUpModal.vue";
import AnalyticsDashboard from "~/components/AnalyticsDashboard.vue";
import AIReviewModal from "~/components/AIReviewModal.vue";
import NotificationBell from "~/components/NotificationBell.vue";
import type { Id } from "~/convex/_generated/dataModel";

const { userId, orgId } = useAuth();
const { createExpense } = useExpenses();
const { createSettlement } = useSettlements();
const { data: members } = useMembers();
const { pendingUpgrades, isUpgrading, syncWhenOnline, upgradeReceipt, dismissReceipt } = useReceiptAI();

const isAddModalOpen = ref(false);
const isSettleModalOpen = ref(false);
const isNotificationsOpen = ref(false);
const isAIReviewModalOpen = ref(false);

const partnerUserId = computed(() => {
  const other = (members.value || []).find((m) => m.userId !== userId.value);
  return other?.userId ?? "";
});

async function handleExpenseSubmit(expense: {
  amount: number;
  date: string;
  category: string;
  categoryId?: Id<"categories">;
  notes?: string;
  paidBy: string;
  receiptImageId?: Id<"_storage">;
  receiptImageIds?: Id<"_storage">[];
  receiptPHash?: string;
  receiptFingerprint?: string;
}) {
  if (!orgId.value || !userId.value) return;

  await createExpense({
    ...expense,
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
    date: new Date().toISOString(),
  });
  isSettleModalOpen.value = false;
}

async function handleAIReviewApply(id: string) {
  isAIReviewModalOpen.value = false;
  await upgradeReceipt(id as Id<"expenses">);
  await syncWhenOnline();
}

async function handleAIReviewDismiss(id: string) {
  isAIReviewModalOpen.value = false;
  await dismissReceipt(id as Id<"expenses">);
  await syncWhenOnline();
}

function handleNotificationNavigate(path: string) {
  navigateTo(path);
}
</script>

<template>
  <div class="hhb-page">
    <header class="hhb-header">
      <div class="flex items-center justify-between">
        <h1>Happy House Bills</h1>
        <NotificationBell v-model="isNotificationsOpen" @navigate="handleNotificationNavigate" />
      </div>
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

    <div class="hhb-analytics-section">
      <AnalyticsDashboard />
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

    <AIReviewModal
      :is-open="isAIReviewModalOpen"
      :reviews="pendingUpgrades"
      :busy-ids="isUpgrading ? [pendingUpgrades[0]?._id || ''] : []"
      @close="isAIReviewModalOpen = false"
      @apply="async (id: string) => {
        isAIReviewModalOpen = false;
        await handleAIReviewApply(id);
      }"
      @dismiss="async (id: string) => {
        isAIReviewModalOpen = false;
        await handleAIReviewDismiss(id);
      }"
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

.hhb-analytics-section {
  margin-top: var(--hhb-space-6);
  padding-top: var(--hhb-space-6);
  border-top: 1px solid var(--hhb-color-border);
}

.hhb-analytics-section {
  @media (min-width: 768px) {
    grid-column: 1 / -1;
    border-top: 1px solid var(--hhb-color-border);
    border-left: none;
    padding-left: var(--hhb-space-6);
    padding-top: var(--hhb-space-6);
  }
}
</style>
