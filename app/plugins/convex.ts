import { convexVue } from "convex-vue";

export default defineNuxtPlugin((nuxtApp) => {
  const config = useRuntimeConfig();
  const url = String(config.public.convexUrl || "");
  if (!url) {
    console.warn("[convex] Missing runtime config public.convexUrl");
  }
  nuxtApp.vueApp.use(convexVue, { url });
});
