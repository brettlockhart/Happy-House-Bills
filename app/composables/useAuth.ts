import { useAuth as useClerkAuth, useOrganization, useUser } from "@clerk/vue";
import { computed, readonly } from "vue";

export function useClerkAuthWrapper() {
  const { isSignedIn, isLoaded, userId, sessionId } = useClerkAuth();
  const { organization } = useOrganization();
  const { user } = useUser();

  const orgId = computed(() => {
    if (!organization.value) return null;
    return organization.value.id;
  });

  const isFullyLoaded = computed(() => isLoaded.value && isSignedIn.value !== null);

  const hasOrg = computed(() => {
    if (!isLoaded.value || !isSignedIn.value) return false;
    return !!organization.value;
  });

  return {
    isSignedIn: readonly(isSignedIn),
    isLoaded: readonly(isLoaded),
    user: readonly(user),
    userId: readonly(userId),
    sessionId: readonly(sessionId),
    orgId,
    hasOrg,
    isFullyLoaded,
  };
}

export const useAuth = useClerkAuthWrapper;