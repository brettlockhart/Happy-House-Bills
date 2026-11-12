import { useAuth } from "~/composables/useAuth";

export default defineNuxtRouteMiddleware((to) => {
  const config = useRuntimeConfig();
  if (config.public.authBypass) return;

  const { isSignedIn, isLoaded, hasOrg } = useAuth();

  if (!isLoaded.value) {
    return;
  }

  if (!isSignedIn.value && to.path !== "/sign-in" && to.path !== "/sign-up") {
    return navigateTo("/sign-in");
  }

  if (
    isSignedIn.value &&
    !hasOrg.value &&
    to.path !== "/onboard" &&
    to.path !== "/sign-in" &&
    to.path !== "/sign-up"
  ) {
    return navigateTo("/onboard");
  }
});
