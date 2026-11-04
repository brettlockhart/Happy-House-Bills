<script setup lang="ts">
import { useAuth } from "~/composables/useAuth";
import { SignIn } from "@clerk/vue";

const { isSignedIn, isLoaded, hasOrg } = useAuth();
</script>

<template>
  <div v-if="!isLoaded">
    <div class="hhb-loading">Loading...</div>
  </div>
  <SignIn v-else-if="!isSignedIn" />
  <NuxtLayout v-else-if="hasOrg">
    <NuxtPage />
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
