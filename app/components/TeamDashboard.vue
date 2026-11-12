<script setup lang="ts">
import { computed } from "vue";
import { useMembers, useTeams, type Membership } from "~/composables/useTeams";
import { useAuth } from "~/composables/useAuth";
import { TEAM_ROLES, type TeamRole } from "~/utils/team-permissions";

const { user } = useAuth();
const { data: members, isPending: membersLoading } = useMembers();
const { updateMemberRole, removeMember } = useTeams();

const currentUserId = user.value?.id ?? "";

const currentUserRole = computed(() =>
  members.value.find((m) => m.userId === currentUserId)?.role ?? "viewer"
);

const isAdmin = computed(() => currentUserRole.value === TEAM_ROLES.ADMIN);

const sortedMembers = computed(() =>
  [...members.value].sort((a, b) => {
    const roleOrder = { admin: 0, member: 1, viewer: 2 };
    return (
      (roleOrder[a.role as keyof typeof roleOrder] ?? 3) -
      (roleOrder[b.role as keyof typeof roleOrder] ?? 3)
    );
  }),
);

async function handleRoleChange(member: Membership, newRole: TeamRole) {
  if (member.userId === currentUserId) return;
  await updateMemberRole({ userId: member.userId, role: newRole });
}

async function handleRemove(member: Membership) {
  if (member.userId === currentUserId) return;
  if (!confirm(`Remove ${member.userId} from the team?`)) return;
  await removeMember({ userId: member.userId });
}

function getRoleBadgeClass(role: string): string {
  const classes: Record<string, string> = {
    admin: "bg-purple-100 text-purple-800",
    member: "bg-blue-100 text-blue-800",
    viewer: "bg-gray-100 text-gray-800",
  };
  return classes[role] ?? "bg-gray-100 text-gray-800";
}
</script>

<template>
  <div class="team-dashboard">
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-bold text-gray-900">Team Dashboard</h1>
    </div>

      <div v-if="membersLoading" class="flex justify-center py-8">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
    </div>

    <div v-else class="space-y-4">
      <div
        v-for="member in sortedMembers"
        :key="member._id"
        class="flex items-center justify-between p-4 bg-white rounded-lg border border-gray-200 shadow-sm"
      >
        <div class="flex items-center gap-4">
          <div class="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
            <span class="text-emerald-600 font-medium">
              {{ member.userId.charAt(0).toUpperCase() }}
            </span>
          </div>
          <div>
            <p class="font-medium text-gray-900">{{ member.userId }}</p>
            <p class="text-sm text-gray-500">
              Joined {{ member.joinedAt ? new Date(member.joinedAt).toLocaleDateString() : "Unknown date" }}
            </p>
          </div>
        </div>

        <div class="flex items-center gap-4">
          <span
            :class="[
              'px-2 py-1 rounded-full text-xs font-medium',
              getRoleBadgeClass(member.role),
            ]"
          >
            {{ member.role }}
          </span>

          <div v-if="isAdmin && member.userId !== currentUserId" class="flex items-center gap-2">
            <select
              class="px-2 py-1 border border-gray-300 rounded text-sm"
              :value="member.role"
              @change="handleRoleChange(member, ($event.target as HTMLSelectElement).value as TeamRole)"
            >
              <option value="admin">Admin</option>
              <option value="member">Member</option>
              <option value="viewer">Viewer</option>
            </select>
            <button
              class="px-2 py-1 text-red-600 hover:text-red-800 text-sm font-medium"
              @click="handleRemove(member)"
            >
              Remove
            </button>
          </div>
        </div>
      </div>

      <div v-if="sortedMembers.length === 0" class="text-center py-8 text-gray-500">
        No team members yet. Invite someone to get started!
      </div>
    </div>
  </div>
</template>