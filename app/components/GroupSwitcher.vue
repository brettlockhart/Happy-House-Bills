<script setup lang="ts">
import { useAuth } from "~/composables/useAuth";

const { hasOrg } = useAuth();
const OrganizationSwitcher = defineAsyncComponent(async () => (await import("@clerk/vue")).OrganizationSwitcher);
</script>

<template>
  <div v-if="hasOrg" class="hhb-group-switcher">
    <OrganizationSwitcher
      after-create-organization-url="/groups"
      after-leave-organization-url="/groups"
      after-select-organization-url="/"
    />
  </div>
</template>

<style scoped>
.hhb-group-switcher {
  display: flex;
  align-items: center;
  gap: var(--hhb-space-2);
}
</style>