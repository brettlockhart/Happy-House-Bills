import { useConvexClient, useConvexQuery } from "convex-vue";
import { api } from "~/convex/_generated/api";
import type { Doc } from "~/convex/_generated/dataModel";
import { computed } from "vue";

type Invite = Doc<"invites">;

export function usePendingInvites() {
  const result = useConvexQuery(api.functions.orgs.listPendingInvites, {});

  return {
    data: computed(() => (result.data.value as Invite[] | undefined) ?? []),
    isPending: result.isPending,
  };
}

export function useOrgs() {
  const client = useConvexClient();

  return {
    createOrg: (args: { name: string }) =>
      client.mutation(api.functions.orgs.createOrg, args),
    invitePartner: (args: { email: string; orgId: string; orgName?: string }) =>
      client.action(api.functions.orgs.invite, args),
    acceptInvite: (args: { token: string }) =>
      client.action(api.functions.orgs.acceptInvite, args),
  };
}
