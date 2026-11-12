<script setup lang="ts">
import { useAuth } from "~/composables/useAuth";
import NotificationToast from "~/components/NotificationToast.vue";

const { isSignedIn, isLoaded, hasOrg } = useAuth();
const SignIn = defineAsyncComponent(async () => (await import("@clerk/vue")).SignIn);
</script>

<template>
  <div v-if="!isLoaded">
    <div class="hhb-loading">Loading...</div>
  </div>
  <SignIn v-else-if="!isSignedIn" />
  <NuxtLayout v-else-if="hasOrg">
    <NuxtPage />
    <NotificationToast />
  </NuxtLayout>
  <NuxtPage v-else />
</template>

<style scoped>
.hhb-loading {
  padding: var(--hhb-space-4);
  text-align: center;
  color: var(--hhb-color-text-secondary);
}
</style>
