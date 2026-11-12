<script setup lang="ts">
import { ref } from "vue";
import { useTeams } from "~/composables/useTeams";
import { usePendingInvites } from "~/composables/useOrgs";
import type { TeamRole } from "~/utils/team-permissions";

const { createInvite } = useTeams();
const { data: pendingInvites } = usePendingInvites();

const emit = defineEmits<{
  (e: "invite-sent", token: string): void;
}>();

const props = defineProps<{
  orgId: string;
  orgName?: string;
  defaultRole?: TeamRole;
}>();

const email = ref<string>("");
const isSending = ref(false);

async function handleSendInvite() {
  const trimmed = email.value.trim();
  if (!trimmed || isSending.value) return;

  isSending.value = true;
  try {
    const result = await createInvite({
      email: trimmed,
      orgId: props.orgId,
      orgName: props.orgName,
      role: props.defaultRole ?? "member",
    });
    emit("invite-sent", result.token);
    email.value = "";
  } finally {
    isSending.value = false;
  }
}
</script>

<template>
  <div class="team-management">
    <div v-if="pendingInvites.length > 0" class="mb-6">
      <h2 class="text-lg font-medium text-gray-900 mb-2">Pending Invites</h2>
      <div
        v-for="invite in pendingInvites"
        :key="invite._id"
        class="flex items-center justify-between p-4 bg-white rounded-lg border border-gray-200 shadow-sm"
      >
        <div>
          <p class="font-medium text-gray-900">{{ invite.email }}</p>
          <p class="text-sm text-gray-500">Expires {{ new Date(invite.expiresAt).toLocaleDateString() }}</p>
        </div>
        <button
          class="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
          :disabled="isSending"
          @click="handleSendInvite"
        >
          <span v-if="isSending">Sending...</span>
          <span v-else>Send</span>
        </button>
      </div>
    </div>

    <div class="mb-6">
      <label class="block text-sm text-gray-700 mb-2">Invite by email</label>
      <input
        v-model="email"
        type="email"
        class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
        placeholder="email@example.com"
        aria-label="Email address to invite"
      >
      <button
        class="mt-4 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        :disabled="isSending"
        @click="handleSendInvite"
      >
        <span v-if="isSending">Sending...</span>
        <span v-else>Invite</span>
      </button>
    </div>
  </div>
</template>