<script setup lang="ts">
import { useAuth } from "~/composables/useAuth";
import NotificationBell from "~/components/NotificationBell.vue";

const { user } = useAuth();
const isNotificationsOpen = ref(false);

const displayName = computed(() => user.value?.fullName || "Your household");
const initials = computed(() => {
  const name = displayName.value.trim();
  if (!name) return "HH";
  const parts = name.split(/\s+/);
  return (parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "");
});

function handleNotificationNavigate(path: string) {
  isNotificationsOpen.value = false;
  navigateTo(path);
}
</script>

<template>
  <div class="hhb-app">
    <header class="hhb-app-header">
      <div class="hhb-container hhb-app-header__inner">
        <NuxtLink to="/" class="hhb-brand" aria-label="Happy House Bills home">
          <span class="hhb-brand__mark" aria-hidden="true">⌂</span>
          <span class="hhb-brand__text">Happy House Bills</span>
        </NuxtLink>

        <nav class="hhb-nav shell-nav" aria-label="Primary">
          <NuxtLink to="/" class="hhb-nav-link" active-class="is-active">
            Dashboard
          </NuxtLink>
        </nav>

        <div class="hhb-spacer" />

        <NotificationBell
          v-model="isNotificationsOpen"
          @navigate="handleNotificationNavigate"
        />

        <div class="hhb-user" :title="displayName">
          <span class="hhb-user__avatar" aria-hidden="true">{{ initials.toUpperCase() }}</span>
          <span class="hhb-user__name">{{ displayName }}</span>
        </div>
      </div>
    </header>

    <main class="hhb-app-main">
      <div class="hhb-container">
        <slot />
      </div>
    </main>
  </div>
</template>

<style scoped>
.hhb-user {
  display: inline-flex;
  align-items: center;
  gap: var(--hhb-space-2);
  padding: var(--hhb-space-1) var(--hhb-space-2);
  border-radius: var(--hhb-radius-full);
  border: 1px solid var(--hhb-color-border);
  background: var(--hhb-color-bg-elevated);
}
.hhb-user__avatar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.75rem;
  height: 1.75rem;
  border-radius: var(--hhb-radius-full);
  background: var(--hhb-color-primary-subtle);
  color: var(--hhb-color-primary-dark);
  font-size: var(--hhb-text-xs);
  font-weight: var(--hhb-font-semibold);
}
.hhb-user__name {
  font-size: var(--hhb-text-sm);
  font-weight: var(--hhb-font-medium);
  max-width: 12rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.shell-nav {
  margin-left: var(--hhb-space-4);
}

@media (max-width: 640px) {
  .hhb-user__name {
    display: none;
  }
  .hhb-brand__text {
    font-size: var(--hhb-text-base);
  }
  .shell-nav {
    margin-left: var(--hhb-space-2);
  }
}
</style>
