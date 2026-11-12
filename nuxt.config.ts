import { resolve } from "node:path";

export default defineNuxtConfig({
  devtools: { enabled: true },
  modules: [
    '@clerk/nuxt',
    '@nuxt/eslint',
  ],
  css: [
    "~/assets/css/tokens.css",
  ],
  vite: {
    resolve: {
      alias: {
        "~/convex": resolve(process.cwd(), "convex"),
      },
    },
  },
  nitro: {
    preset: 'cloudflare-module',
  },
  app: {
    head: {
      meta: [
        { name: "viewport", content: "width=device-width, initial-scale=1" },
        { name: "theme-color", content: "#10b981" },
        { name: "color-scheme", content: "light dark" },
      ],
      link: [
        { rel: "manifest", href: "/manifest.webmanifest" },
        { rel: "apple-touch-icon", href: "/icons/icon-192.png" },
      ],
    },
  },
  runtimeConfig: {
    public: {
      clerkPublishableKey: process.env.NUXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
      convexUrl: process.env.CONVEX_URL,
      authBypass: process.env.NUXT_PUBLIC_AUTH_BYPASS === "1",
      authBypassUserId: process.env.NUXT_PUBLIC_AUTH_BYPASS_USER_ID || "dev-user",
      authBypassOrgId: process.env.NUXT_PUBLIC_AUTH_BYPASS_ORG_ID || "dev-org",
    },
    clerkSecretKey: process.env.NUXT_CLERK_SECRET_KEY,
    resendApiKey: process.env.RESEND_API_KEY,
    resendFromEmail: process.env.RESEND_FROM_EMAIL,
    r2AccountId: process.env.R2_ACCOUNT_ID,
    r2AccessKeyId: process.env.R2_ACCESS_KEY_ID,
    r2SecretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
})
