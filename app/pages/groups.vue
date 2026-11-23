<template>
  <div class="hhb-groups">
    <header class="hhb-groups-header">
      <h1>Your groups</h1>
      <div class="hhb-groups-actions">
        <button class="hhb-btn hhb-btn--primary" @click="createGroup">Create new group</button>
        <button class="hhb-btn hhb-btn--secondary" @click="joinGroup">Join via invite</button>
      </div>
    </header>

    <p v-if="isPending" class="hhb-groups-hint">Loading your groups…</p>

    <ul v-else class="hhb-groups-list">
      <li v-for="g in groups" :key="g.orgId" class="hhb-group">
        <div class="hhb-group-info">
          <span class="hhb-group-name">{{ g.orgId }}</span>
          <span class="hhb-group-role">{{ g.role }}</span>
        </div>
      </li>
      <li v-if="groups.length === 0" class="hhb-group-empty">
        You don't belong to any groups yet. Create one or accept an invitation.
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { useConvexQuery } from "convex-vue";
import { api } from "~~/convex/_generated/api";

const listMyGroups = useConvexQuery(api.functions.groups.listMine, {});
const groups = listMyGroups.data.value ?? [];
const isPending = listMyGroups.isPending;

function createGroup() {
  navigateTo("/onboard");
}
</script>

<style scoped>
.hhb-groups {
  max-width: 640px;
  margin: 0 auto;
  padding: var(--hhb-space-4);
}

.hhb-groups-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--hhb-space-2);
  margin-bottom: var(--hhb-space-4);
}

.hhb-groups-header h1 {
  font-size: 1.5rem;
}

.hhb-groups-actions {
  display: flex;
  gap: var(--hhb-space-2);
}

.hhb-groups-hint {
  color: var(--hhb-color-text-secondary);
}

.hhb-groups-list {
  list-style: none;
  display: grid;
  gap: var(--hhb-space-2);
}

.hhb-group {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--hhb-space-2);
  padding: var(--hhb-space-3);
  border: 1px solid var(--hhb-color-border);
  border-radius: var(--hhb-radius);
  background: var(--hhb-color-bg);
}

.hhb-group-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.hhb-group-name {
  font-weight: 600;
}

.hhb-group-role {
  font-size: var(--hhb-text-sm);
  color: var(--hhb-color-text-secondary);
  text-transform: capitalize;
}

.hhb-group-empty {
  color: var(--hhb-color-text-secondary);
  text-align: center;
  padding: var(--hhb-space-4);
}
</style>