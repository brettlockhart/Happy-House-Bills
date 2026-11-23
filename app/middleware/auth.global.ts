import { useAuth } from "~/composables/useAuth";

export default defineNuxtRouteMiddleware((to) => {
  // Dev-only bypass: guarded at build time, never present in production.
  if (import.meta.dev && process.env.NUXT_PUBLIC_AUTH_BYPASS === "1") return;

  const { isSignedIn, isLoaded, hasOrg } = useAuth();

  if (!isLoaded.value) {
    return;
  }

  const publicPaths = ["/sign-in", "/sign-up", "/invite"];

  if (!isSignedIn.value && !publicPaths.includes(to.path)) {
    return navigateTo({
      path: "/sign-in",
      query: { redirect: to.fullPath },
    });
  }

  if (
    isSignedIn.value &&
    !hasOrg.value &&
    !publicPaths.includes(to.path)
  ) {
    return navigateTo("/onboard");
  }
});
