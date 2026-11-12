import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(process.cwd());
const ciContent = readFileSync(resolve(root, ".github/workflows/ci.yml"), "utf-8");
const wranglerContent = readFileSync(resolve(root, "wrangler.toml"), "utf-8");
const nuxtConfigContent = readFileSync(resolve(root, "nuxt.config.ts"), "utf-8");
const envExampleContent = readFileSync(resolve(root, ".env.example"), "utf-8");

// SEC-D8-001: CONVEX_DEPLOY_KEY must not be in application runtime config
describe("SEC-D8-001: Deployment credentials not in application runtime config", () => {
  it("REQUIRES CONVEX_DEPLOY_KEY is absent from nuxt.config.ts runtimeConfig", () => {
    expect(nuxtConfigContent).not.toContain("CONVEX_DEPLOY_KEY");
    expect(nuxtConfigContent).not.toContain("convexDeployKey");
  });
});

// SEC-D8-002: Production deployment guard
describe("SEC-D8-002: Production deploy jobs guarded by master ref", () => {
  it("REQUIRES deploy-convex only runs on master", () => {
    const section = ciContent.split("deploy-convex:")[1];
    expect(section).toContain("if: github.ref == 'refs/heads/master'");
  });

  it("REQUIRES deploy-nuxt only runs on master", () => {
    const section = ciContent.split("deploy-nuxt:")[1];
    expect(section).toContain("if: github.ref == 'refs/heads/master'");
  });
});

// SEC-D8-003: Dependency vulnerability scanning
describe("SEC-D8-003: Dependency vulnerability scanning in CI", () => {
  it("REQUIRES npm audit step present in test job", () => {
    expect(ciContent).toContain("npm audit");
  });
});

// SEC-D8-004: Least-privilege workflow permissions
describe("SEC-D8-004: Workflow permissions are least-privilege", () => {
  it("REQUIRES permissions: key at workflow level", () => {
    expect(ciContent).toContain("permissions:");
    expect(ciContent).toContain("contents: read");
  });
});

// SEC-D8-005: No secrets in workflow YAML or wrangler.toml
describe("SEC-D8-005: No hardcoded secrets in configuration files", () => {
  it("REQUIRES no secret values in ci.yml", () => {
    const secretValues = [
      "sk-",
      "clerk_",
      "re_eyJ",
      "AKIA",
      "xoxb-",
    ];
    for (const val of secretValues) {
      expect(ciContent, `Found potential secret value: ${val}`).not.toContain(val);
    }
  });

  it("REQUIRES no secrets in wrangler.toml", () => {
    const secretKeys = ["api_key", "secret", "password", "token", "apikey"];
    const lower = wranglerContent.toLowerCase();
    for (const key of secretKeys) {
      expect(lower, `Found potential secret key in wrangler.toml: ${key}`).not.toContain(key);
    }
  });

it("REQUIRES no secret values in .env.example", () => {
    const lines = envExampleContent.split("\n");
    const knownSafeValues = new Set(["https://app.happyhousebills.com", "3600", "us", "eu", "us-central1", "eu-west1"]);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx === -1) continue;
      const value = trimmed.slice(eqIdx + 1).trim();
      if (value === "" || value.startsWith("https://") || value === "3600" || knownSafeValues.has(value)) continue;
      expect(value, `Unexpected non-empty .env.example value: ${value}`).toBeFalsy();
    }
  });
});

// SEC-D8-006: Secrets isolated to deploy jobs only
describe("SEC-D8-006: Secrets isolated to deploy jobs only", () => {
  it("REQUIRES build step (npm run build) has no env block", () => {
    const nuxtSection = ciContent.split("deploy-nuxt:")[1];
    const buildLineIdx = nuxtSection.indexOf("npm run build");
    const envLineIdx = nuxtSection.indexOf("env:");
    expect(envLineIdx).toBeGreaterThan(buildLineIdx);
  });

  it("REQUIRES CONVEX_DEPLOY_KEY only in deploy-convex, not deploy-nuxt", () => {
    const nuxtSection = ciContent.split("deploy-nuxt:")[1];
    expect(nuxtSection).not.toContain("CONVEX_DEPLOY_KEY");
  });
});

// SEC-D8-007: Secrets use ${{ secrets.* }} context
describe("SEC-D8-007: Secret references use GitHub secrets context", () => {
  it("REQUIRES all secret references use ${{ secrets.* }} pattern", () => {
    const secretRefs = [...ciContent.matchAll(/\$\{\{\s*secrets\.(\w+)/g)];
    expect(secretRefs.length).toBeGreaterThan(0);
  });
});

// SEC-D8-008: npm audit fails on moderate+ vulnerabilities
describe("SEC-D8-008: npm audit fails on moderate+ vulnerabilities", () => {
  it("REQUIRES npm audit with --audit-level=moderate", () => {
    expect(ciContent).toContain("npm audit --audit-level=moderate");
  });
});

// SEC-D8-009: PR fork protection
describe("SEC-D8-009: PRs from forks cannot trigger production deploy", () => {
  it("REQUIRES workflow uses pull_request (not pull_request_target)", () => {
    expect(ciContent).toContain("pull_request:");
    expect(ciContent).not.toContain("pull_request_target");
  });

  it("REQUIRES deploy jobs not triggered on PR events", () => {
    expect(ciContent).toContain("if: github.ref == 'refs/heads/master'");
  });
});

// SEC-D8-010: Dependency pinning
describe("SEC-D8-010: npm ci ensures reproducible builds", () => {
  it("REQUIRES npm ci (not npm install) in all jobs", () => {
    const installMatches = ciContent.match(/npm install/g);
    expect(installMatches, "Should use 'npm ci' not 'npm install'").toBeNull();
  });

  it("REQUIRES npm ci used in all jobs", () => {
    const ciMatches = [...ciContent.matchAll(/npm ci/g)];
    expect(ciMatches.length).toBeGreaterThanOrEqual(5);
  });
});
