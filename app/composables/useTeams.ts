import { useConvexClient, useConvexQuery } from "convex-vue";
import { api } from "~~/convex/_generated/api";
import { computed } from "vue";

export function useTeams() {
  const client = useConvexClient();

  return {
    listMembers: () => client.query(api.functions.teams.listMembers, {}),
    updateMemberRole: (args: { userId: string; role: "admin" | "member" | "viewer" }) =>
      client.mutation(api.functions.teams.updateMemberRole, args),
    removeMember: (args: { userId: string }) =>
      client.mutation(api.functions.teams.removeMember, args),
    listAuditLogs: (args: { limit?: number }) =>
      client.query(api.functions.teams.listAuditLogs, args),
    createInvite: (args: {
      email: string;
      orgId: string;
      orgName?: string;
      role: "admin" | "member" | "viewer";
    }) => client.mutation(api.functions.teams.createInvite, args),
    acceptTeamInvite: (args: { token: string }) =>
      client.mutation(api.functions.teams.acceptTeamInvite, args),
  };
}

export interface Membership {
  _id: string;
  orgId: string;
  userId: string;
  role: "admin" | "member" | "viewer";
  status: "active" | "pending" | "suspended";
  invitedBy?: string;
  joinedAt?: number;
  createdAt: number;
  updatedAt: number;
  deletedAt?: number;
}

export function useMembers() {
  const result = useConvexQuery(api.functions.teams.listMembers, {});

  return {
    data: computed(() => (result.data.value ?? []) as Membership[]),
    isPending: result.isPending,
  };
}

export function useAuditLogs() {
  const result = useConvexQuery(api.functions.teams.listAuditLogs, {});

  return {
    data: computed(() => (result.data.value ?? []) as Array<Record<string, unknown>>),
    isPending: result.isPending,
  };
}