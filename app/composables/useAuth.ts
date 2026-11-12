import { useAuth as useClerkAuth, useOrganization, useUser } from "@clerk/vue";
import { computed, readonly, ref, watch } from "vue";
import { clearSessionCaches } from "~/utils/cache";

interface DevBypassUser {
  id: string;
  fullName: string;
}

export function useClerkAuthWrapper() {
  const config = useRuntimeConfig();
  if (config.public.authBypass) {
    const userId = ref(String(config.public.authBypassUserId || "dev-user"));
    const orgId = ref(String(config.public.authBypassOrgId || "dev-org"));
    const user = ref<DevBypassUser>({ id: userId.value, fullName: "Dev Bypass User" });
    return {
      isSignedIn: readonly(ref(true)),
      isLoaded: readonly(ref(true)),
      user: readonly(user),
      userId: readonly(userId),
      sessionId: readonly(ref("dev-session")),
      orgId,
      hasOrg: computed(() => !!orgId.value),
      isFullyLoaded: computed(() => true),
    };
  }

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

  // Clear session-scoped caches on sign-out
  watch(isSignedIn, (signedIn) => {
    if (signedIn === false) {
      clearSessionCaches();
    }
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