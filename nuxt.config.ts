export default defineNuxtConfig({
  devtools: { enabled: true },
  modules: [
    '@clerk/nuxt',
    '@nuxt/eslint',
  ],
  nitro: {
    preset: 'cloudflare-module',
  },
  runtimeConfig: {
    public: {
      clerkPublishableKey: process.env.NUXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
      convexUrl: process.env.CONVEX_URL,
    },
    clerkSecretKey: process.env.NUXT_CLERK_SECRET_KEY,
    convexDeployKey: process.env.CONVEX_DEPLOY_KEY,
    resendApiKey: process.env.RESEND_API_KEY,
    r2AccountId: process.env.R2_ACCOUNT_ID,
    r2AccessKeyId: process.env.R2_ACCESS_KEY_ID,
    r2SecretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
})
