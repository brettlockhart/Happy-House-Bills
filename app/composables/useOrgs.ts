import { useConvexClient, useConvexQuery } from "convex-vue";
import { api } from "~/convex/_generated/api";
import type { Invite } from "~/convex/_generated/api";
import { computed } from "vue";

export function usePendingInvites() {
  const result = useConvexQuery(api.orgs.listPendingInvites, {});

  return {
    data: computed(() => (result.data.value as Invite[] | undefined) ?? []),
    isPending: result.isPending,
  };
}

export function useOrgs() {
  const client = useConvexClient();

  return {
    createOrg: (args: { name: string }) =>
      client.action(api.orgs.create, args),
    invitePartner: (args: { email: string; orgId: string; orgName?: string }) =>
      client.action(api.orgs.invite, args),
    acceptInvite: (args: { token: string }) =>
      client.action(api.orgs.acceptInvite, args),
  };
}
