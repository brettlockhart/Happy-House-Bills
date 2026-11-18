<script setup lang="ts">
import { useNotifications } from "~/composables/useNotifications";
import { watch, onMounted, ref, computed } from "vue";
import type { Doc } from "~~/convex/_generated/dataModel";

const { notifications } = useNotifications();

const toasts = ref<Array<Doc<"notifications"> & { id: string }>>([]);
let lastSeenCount = 0;

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
          const toastId = `${notification._id}-${Date.now()}`;
          toasts.value.push({ ...notification, id: toastId });

          setTimeout(() => {
            const index = toasts.value.findIndex((t) => t.id === toastId);
            if (index !== -1) {
              toasts.value.splice(index, 1);
            }
          }, 5000);
        }
      }
    }
    lastSeenCount = newCount;
  },
);

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
  }
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