<script setup lang="ts">
import { useNotifications } from "~/composables/useNotifications";
import { useNotificationPreferences, isWithinQuietHours, isTypeEnabled } from "~/composables/useNotificationPreferences";
import { useConvexMutation } from "convex-vue";
import { api, internal } from "~~/convex/_generated/api";
import { watch, onMounted, ref, computed, onUnmounted } from "vue";
import { useRouter } from "vue-router";
import type { Doc } from "~~/convex/_generated/dataModel";

interface ToastAction {
  label: string;
  icon: string;
  variant: "primary" | "secondary" | "destructive";
  handler: (notification: Doc<"notifications">) => void;
}

interface ToastItem extends Doc<"notifications"> {
  id: string;
  actions?: ToastAction[];
}

const router = useRouter();
const { notifications, markRead } = useNotifications();
const { preferences } = useNotificationPreferences();

const approveExpense = useConvexMutation(api.functions.expenses.approve);
const rejectExpense = useConvexMutation(api.functions.expenses.reject);
// @ts-expect-error internal mutation reference used with public mutation hook — library type constraint
const acceptInvite = useConvexMutation(internal.functions.orgs.acceptInviteDb);

const toasts = ref<ToastItem[]>([]);
let lastSeenCount = 0;
let batchTimer: ReturnType<typeof setTimeout> | null = null;

const notificationsList = computed(() => notifications.data.value ?? []);

onMounted(() => {
  lastSeenCount = notificationsList.value.length;
});

watch(
  notificationsList,
  (newNotifications) => {
    const newCount = newNotifications.length;
    if (newCount > lastSeenCount) {
      const added = newNotifications.slice(0, newCount - lastSeenCount);
      for (const notification of added) {
        if (!notification.read) {
          const type = notification.type;
          if (!isTypeEnabled(preferences.value, type)) continue;
          if (isWithinQuietHours(preferences.value)) continue;
          const toastId = `${notification._id}-${Date.now()}`;
          toasts.value.push({ ...notification, id: toastId, actions: buildActions(notification) });

          if (batchTimer) clearTimeout(batchTimer);
          batchTimer = setTimeout(() => {
            const index = toasts.value.findIndex((t) => t.id === toastId);
            if (index !== -1) {
              toasts.value.splice(index, 1);
            }
          }, preferences.value.batchWindowMs ?? 5000);
        }
      }
    }
    lastSeenCount = newCount;
  },
);

onUnmounted(() => {
  if (batchTimer) clearTimeout(batchTimer);
});

function dismiss(toastId: string) {
  const index = toasts.value.findIndex((t) => t.id === toastId);
  if (index !== -1) {
    toasts.value.splice(index, 1);
  }
}

function getTypeIcon(type: Doc<"notifications">["type"]) {
  switch (type) {
    case "expense_pending":
    case "expense_approved":
    case "expense_rejected":
      return "💰";
    case "settlement_created":
      return "💸";
    case "invite_sent":
      return "👤";
    case "goal_alert":
      return "🎯";
  }
}

function buildActions(notification: Doc<"notifications">): ToastAction[] {
  switch (notification.type) {
    case "expense_pending":
      return [
        { label: "Approve", icon: "✓", variant: "primary" as const, handler: () => handleApprove(notification) },
        { label: "Reject", icon: "✕", variant: "destructive" as const, handler: () => handleReject(notification) },
      ];
    case "expense_approved":
      return [
        { label: "View", icon: "eye", variant: "secondary" as const, handler: () => handleView(notification) },
      ];
    case "expense_rejected":
      return [
        { label: "View", icon: "eye", variant: "secondary" as const, handler: () => handleView(notification) },
      ];
    case "settlement_created":
      return [
        { label: "View", icon: "eye", variant: "secondary" as const, handler: () => handleView(notification) },
      ];
    case "invite_sent":
      return [
        { label: "Accept", icon: "👤", variant: "primary" as const, handler: () => handleAcceptInvite(notification) },
      ];
    default:
      return [];
  }
}

async function handleApprove(notification: Doc<"notifications">) {
  if (!notification.data?.expenseId) return;
  await approveExpense.mutate({ expenseId: notification.data.expenseId });
  if (!notification.read) markRead(notification._id);
  dismiss(notification._id as unknown as string);
}

async function handleReject(notification: Doc<"notifications">) {
  if (!notification.data?.expenseId) return;
  await rejectExpense.mutate({ expenseId: notification.data.expenseId });
  if (!notification.read) markRead(notification._id);
  dismiss(notification._id as unknown as string);
}

function handleView(notification: Doc<"notifications">) {
  if (notification.data?.expenseId) {
    router.push(`/expenses/${notification.data.expenseId}`);
  } else if (notification.data?.settlementId) {
    router.push(`/settlements/${notification.data.settlementId}`);
  }
  if (!notification.read) markRead(notification._id);
  dismiss(notification._id as unknown as string);
}

async function handleAcceptInvite(notification: Doc<"notifications">) {
  if (!notification.data?.inviteToken) return;
  await acceptInvite.mutate({ token: notification.data.inviteToken });
  if (!notification.read) markRead(notification._id);
  dismiss(notification._id as unknown as string);
}
</script>

<template>
  <Teleport to="body">
    <TransitionGroup name="toast" tag="div" class="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
      <div
        v-for="toast in toasts"
        :key="toast.id"
        class="pointer-events-auto bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-4 w-80 animate-slide-in"
        @click="dismiss(toast.id)"
      >
        <div class="flex items-start gap-3">
          <span class="text-xl mt-0.5">{{ getTypeIcon(toast.type) }}</span>
          <div class="flex-1 min-w-0">
            <p class="font-medium text-gray-900 dark:text-white">{{ toast.title }}</p>
            <p class="text-sm text-gray-600 dark:text-gray-300 mt-0.5">{{ toast.body }}</p>
          </div>
          <button
            class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            aria-label="Dismiss"
            @click.stop="dismiss(toast.id)"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div v-if="toast.actions?.length" class="flex gap-2 mt-3">
          <button
            v-for="action in toast.actions"
            :key="action.label"
            type="button"
            :class="['hhb-btn hhb-btn--sm', `hhb-btn--${action.variant}`]"
            @click.stop="action.handler(toast)"
          >
            {{ action.label }}
          </button>
        </div>
      </div>
    </TransitionGroup>
  </Teleport>
</template>

<style scoped>
@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateX(100%);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

.animate-slide-in {
  animation: slideIn 0.3s ease-out;
}

.toast-leave-active {
  position: absolute;
  width: 100%;
}

.toast-leave-to {
  opacity: 0;
  transform: translateX(100%);
  transition: all 0.3s ease-in;
}
</style>