import { defineConfig } from "vitest/config";
import { resolve } from "node:path";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      "~~/convex": resolve(process.cwd(), "convex"),
      "~/convex": resolve(process.cwd(), "convex"),
      "~/app": resolve(process.cwd(), "app"),
      "~/composables": resolve(process.cwd(), "app/composables"),
      "~/utils": resolve(process.cwd(), "app/utils"),
      "~/components": resolve(process.cwd(), "app/components"),
    },
  },
  test: {
    environment: "happy-dom",
    setupFiles: ["__tests__/setup.ts"],
    include: ["__tests__/convex/**/*.ts", "__tests__/composables/**/*.ts", "__tests__/utils/**/*.ts", "__tests__/components/**/*.ts", "__tests__/ci-cd/**/*.ts", "__tests__/performance/**/*.ts"],
    exclude: ["**/*.spec.ts", "app/**/*.{vue,ts}", "convex/_generated/**"],
    maxWorkers: 1,
    poolOptions: {
      forks: {
        isolate: false,
        maxForks: 1,
      },
    },
    coverage: {
      provider: "v8",
      reporter: ["text", "json"],
      include: ["convex/**/*.ts"],
      exclude: ["convex/_generated/**", "**/*.d.ts", "__tests__/**"],
    },
  },
});
