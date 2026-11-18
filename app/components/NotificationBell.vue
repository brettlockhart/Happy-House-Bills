<script setup lang="ts">
import { computed } from "vue";
import { useNotifications } from "~/composables/useNotifications";
import type { Doc } from "~~/convex/_generated/dataModel";

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
  <div class="notification-bell">
    <button
      class="hhb-btn hhb-btn--ghost hhb-btn--icon notification-bell__btn"
      :aria-label="`Notifications${unreadCountValue > 0 ? `, ${unreadCountValue} unread` : ''}`"
      @click="$emit('update:modelValue', !modelValue)"
    >
      <svg class="notification-bell__icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
      </svg>
      <span
        v-if="unreadCountValue > 0"
        class="hhb-notification-badge"
      >
        {{ unreadCountValue > 9 ? '9+' : unreadCountValue }}
      </span>
    </button>

    <Transition name="dropdown">
      <div v-if="modelValue" class="notification-panel">
        <div class="notification-panel__header">
          <h3 class="notification-panel__title">Notifications</h3>
          <button
            v-if="unreadCountValue > 0"
            class="notification-panel__action"
            @click="markAllRead"
          >
            Mark all read
          </button>
        </div>

        <div class="notification-panel__list">
          <div v-if="notificationsList.length === 0" class="notification-panel__empty">
            No notifications yet
          </div>
          <div v-else>
            <div
              v-for="notification in notificationsList"
              :key="notification._id"
              class="notification-item"
              :class="{ 'is-unread': !notification.read }"
              @click="handleNotificationClick(notification)"
            >
              <span class="notification-item__icon" aria-hidden="true">{{ getTypeIcon(notification.type) }}</span>
              <div class="notification-item__body">
                <p class="notification-item__title">{{ notification.title }}</p>
                <p class="notification-item__text">{{ notification.body }}</p>
                <p class="notification-item__time">{{ formatTime(notification.createdAt) }}</p>
              </div>
              <span v-if="!notification.read" class="notification-item__dot" aria-hidden="true" />
            </div>
          </div>
        </div>

        <div class="notification-panel__footer">
          <button class="notification-panel__action" @click="$emit('navigate', '/notifications')">
            View all notifications
          </button>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.notification-bell {
  position: relative;
}
.notification-bell__btn {
  position: relative;
  color: var(--hhb-color-text-secondary);
}
.notification-bell__icon {
  width: 1.5rem;
  height: 1.5rem;
}

.hhb-notification-badge {
  position: absolute;
  top: 0;
  right: 0;
  min-width: 1.25rem;
  height: 1.25rem;
  padding: 0 0.25rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: var(--hhb-color-error);
  color: #fff;
  font-size: var(--hhb-text-xs);
  font-weight: var(--hhb-font-bold);
  border-radius: var(--hhb-radius-full);
  line-height: 1;
}

.notification-panel {
  position: absolute;
  right: 0;
  margin-top: var(--hhb-space-2);
  width: 20rem;
  max-width: 90vw;
  background: var(--hhb-color-bg-elevated);
  border: 1px solid var(--hhb-color-border);
  border-radius: var(--hhb-radius-xl);
  box-shadow: var(--hhb-shadow-lg);
  z-index: 50;
  overflow: hidden;
}
.notification-panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--hhb-space-3) var(--hhb-space-4);
  border-bottom: 1px solid var(--hhb-color-border);
}
.notification-panel__title {
  font-size: var(--hhb-text-base);
  font-weight: var(--hhb-font-semibold);
}
.notification-panel__action {
  background: none;
  border: none;
  color: var(--hhb-color-primary-dark);
  font-size: var(--hhb-text-sm);
  cursor: pointer;
  padding: 0;
}
.notification-panel__action:hover {
  text-decoration: underline;
}
.notification-panel__list {
  max-height: 24rem;
  overflow-y: auto;
}
.notification-panel__empty {
  padding: var(--hhb-space-6);
  text-align: center;
  color: var(--hhb-color-text-secondary);
}
.notification-panel__footer {
  padding: var(--hhb-space-3);
  border-top: 1px solid var(--hhb-color-border);
  text-align: center;
}

.notification-item {
  display: flex;
  align-items: flex-start;
  gap: var(--hhb-space-3);
  padding: var(--hhb-space-3) var(--hhb-space-4);
  cursor: pointer;
  border-bottom: 1px solid var(--hhb-color-border);
  transition: background var(--hhb-transition);
}
.notification-item:last-child {
  border-bottom: none;
}
.notification-item:hover {
  background: var(--hhb-color-bg-alt);
}
.notification-item.is-unread {
  background: var(--hhb-color-info-subtle);
}
.notification-item__icon {
  font-size: var(--hhb-text-lg);
  margin-top: 2px;
}
.notification-item__body {
  flex: 1;
  min-width: 0;
}
.notification-item__title {
  font-weight: var(--hhb-font-medium);
  color: var(--hhb-color-text);
}
.notification-item__text {
  font-size: var(--hhb-text-sm);
  color: var(--hhb-color-text-secondary);
  margin-top: 2px;
}
.notification-item__time {
  font-size: var(--hhb-text-xs);
  color: var(--hhb-color-text-muted);
  margin-top: var(--hhb-space-1);
}
.notification-item__dot {
  width: 0.5rem;
  height: 0.5rem;
  border-radius: var(--hhb-radius-full);
  background: var(--hhb-color-info);
  margin-top: 0.5rem;
  flex-shrink: 0;
}

.dropdown-enter-active,
.dropdown-leave-active {
  transition: opacity var(--hhb-transition), transform var(--hhb-transition);
}
.dropdown-enter-from,
.dropdown-leave-to {
  opacity: 0;
  transform: translateY(-4px) scale(0.98);
}
</style>
