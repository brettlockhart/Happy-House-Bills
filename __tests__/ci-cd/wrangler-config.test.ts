import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(process.cwd());
const wranglerContent = readFileSync(resolve(root, "wrangler.toml"), "utf-8");

describe("wrangler.toml — build configuration", () => {
  it("has name set to happy-house-bills", () => {
    expect(wranglerContent).toMatch(/name\s*=\s*"happy-house-bills"/);
  });

  it("has pages_build_output_dir pointing to Nuxt public output", () => {
    expect(wranglerContent).toMatch(/pages_build_output_dir\s*=\s*"\.output\/public"/);
  });

  it("has main pointing to Nuxt cloudflare-module worker", () => {
    expect(wranglerContent).toMatch(
      /main\s*=\s*"\.output\/server\/pages\/_worker\.js"/,
    );
  });

  it("uses cloudflare-module preset (confirmed in nuxt.config.ts)", () => {
    const nuxtConfig = readFileSync(resolve(root, "nuxt.config.ts"), "utf-8");
    expect(nuxtConfig).toContain("cloudflare-module");
  });
});

describe("wrangler.toml — worker configuration", () => {
  it("has workers_dev set to true", () => {
    expect(wranglerContent).toMatch(/workers_dev\s*=\s*true/);
  });

  it("has route configured", () => {
    expect(wranglerContent).toContain("[[routes]]");
    expect(wranglerContent).toContain("pattern");
  });
});

describe("wrangler.toml — [vars]", () => {
  it("includes NEXT_PUBLIC_APP_URL var", () => {
    expect(wranglerContent).toContain("[vars]");
    expect(wranglerContent).toMatch(
      /NEXT_PUBLIC_APP_URL\s*=\s*"https:\/\/app\.happyhousebills\.com"/,
    );
  });
});

describe("wrangler.toml — deployment parity with app code", () => {
  it("runtimeConfig public URL matches wrangler [vars] NEXT_PUBLIC_APP_URL", () => {
    const nuxtConfig = readFileSync(resolve(root, "nuxt.config.ts"), "utf-8");
    const match = nuxtConfig.match(
      /NEXT_PUBLIC_APP_URL.*process\.env\.(\w+)/,
    );
    if (match) {
      expect(wranglerContent).toContain(match[1]);
    }
  });
});
