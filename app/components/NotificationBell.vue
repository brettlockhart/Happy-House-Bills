<script setup lang="ts">
import { computed } from "vue";
import { useNotifications } from "~/composables/useNotifications";
import type { Doc } from "~/convex/_generated/dataModel";

interface Props {
  modelValue?: boolean;
}

const _props = withDefaults(defineProps<Props>(), {
  modelValue: false,
});

const emit = defineEmits<{
  (e: "update:modelValue", value: boolean): void;
  (e: "navigate", path: string): void;
}>();

const { notifications, unreadCount, markRead, markAllRead } = useNotifications();

const unreadCountValue = computed(() => unreadCount.data.value ?? 0);
const notificationsList = computed(() => notifications.data.value ?? []);

function handleNotificationClick(notification: Doc<"notifications">) {
  if (!notification.read) {
    markRead(notification._id);
  }

  if (notification.data?.expenseId) {
    emit("navigate", `/expenses/${notification.data.expenseId}`);
  } else if (notification.data?.settlementId) {
    emit("navigate", `/settlements/${notification.data.settlementId}`);
  } else if (notification.data?.inviteToken) {
    emit("navigate", `/invite/${notification.data.inviteToken}`);
  }

  emit("update:modelValue", false);
}

function formatTime(timestamp: number) {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now.getTime() - date.getTime();

  if (diff < 60000) return "Just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return date.toLocaleDateString();
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
  }
}
</script>

<template>
  <div class="notification-bell relative">
    <button
      class="relative p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
      :aria-label="`Notifications${unreadCountValue > 0 ? `, ${unreadCountValue} unread` : ''}`"
      @click="$emit('update:modelValue', !modelValue)"
    >
      <svg class="w-6 h-6 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
      </svg>
      <span
        v-if="unreadCountValue > 0"
        class="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center"
      >
        {{ unreadCountValue > 9 ? '9+' : unreadCountValue }}
      </span>
    </button>

    <Transition enter-active-class="transition ease-out duration-100" enter-from-class="transform opacity-0 scale-95" leave-active-class="transition ease-in duration-75" leave-to-class="transform opacity-0 scale-95">
      <div v-if="modelValue" class="absolute right-0 mt-2 w-80 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-50">
        <div class="p-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h3 class="font-semibold text-gray-900 dark:text-white">Notifications</h3>
          <button
            v-if="unreadCountValue > 0"
            class="text-sm text-blue-600 dark:text-blue-400 hover:underline"
            @click="markAllRead"
          >
            Mark all read
          </button>
        </div>

        <div class="max-h-96 overflow-y-auto">
          <div v-if="notificationsList.length === 0" class="p-6 text-center text-gray-500 dark:text-gray-400">
            No notifications yet
          </div>
          <div v-else class="divide-y divide-gray-200 dark:divide-gray-700">
            <div
              v-for="notification in notificationsList"
              :key="notification._id"
              class="p-3 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors"
              :class="!notification.read ? 'bg-blue-50 dark:bg-blue-900/20' : ''"
              @click="handleNotificationClick(notification)"
            >
              <div class="flex items-start gap-3">
                <span class="text-lg mt-0.5">{{ getTypeIcon(notification.type) }}</span>
                <div class="flex-1 min-w-0">
                  <p class="font-medium text-gray-900 dark:text-white">{{ notification.title }}</p>
                  <p class="text-sm text-gray-600 dark:text-gray-300 mt-0.5">{{ notification.body }}</p>
                  <p class="text-xs text-gray-400 dark:text-gray-500 mt-1">{{ formatTime(notification.createdAt) }}</p>
                </div>
                <div v-if="!notification.read" class="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0" />
              </div>
            </div>
          </div>
        </div>

        <div class="p-3 border-t border-gray-200 dark:border-gray-700 text-center">
          <button class="text-sm text-blue-600 dark:text-blue-400 hover:underline" @click="$emit('navigate', '/notifications')">
            View all notifications
          </button>
        </div>
      </div>
    </Transition>
  </div>
</template>