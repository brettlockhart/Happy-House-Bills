<script setup lang="ts">
import { computed } from "vue";
import { useAuth } from "~/composables/useAuth";
import NotificationToast from "~/components/NotificationToast.vue";

const { isSignedIn, isLoaded, hasOrg } = useAuth();
const route = useRoute();
const redirectUrl = computed(() => {
  const r = route.query.redirect;
  return typeof r === "string" ? r : "/";
});
const SignIn = defineAsyncComponent(async () => (await import("@clerk/vue")).SignIn);
</script>

<template>
  <div v-if="!isLoaded">
    <div class="hhb-loading">Loading...</div>
  </div>
  <SignIn v-else-if="!isSignedIn" :redirect-url="redirectUrl" />
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
