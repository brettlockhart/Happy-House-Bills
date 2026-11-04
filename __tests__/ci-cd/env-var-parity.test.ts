import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(process.cwd());

function readRel(relPath: string): string {
  return readFileSync(resolve(root, relPath), "utf-8");
}

function extractEnvVarsFromConfig(configContent: string): string[] {
  const matches = configContent.matchAll(/process\.env\.([A-Z_][A-Z0-9_]*)/g);
  return Array.from(new Set(Array.from(matches, (m) => m[1])));
}

function extractEnvVarsFromEnvExample(envContent: string): string[] {
  const result: string[] = [];
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const varName = trimmed.slice(0, eqIdx).trim();
    if (varName) result.push(varName);
  }
  return Array.from(new Set(result));
}

function extractEnvVarsFromCIStep(ciContent: string, jobName: string): string[] {
  const jobSection = ciContent.split(`${jobName}:`)[1];
  if (!jobSection) return [];
  const result: string[] = [];
  for (const line of jobSection.split("\n")) {
    const match = line.match(/^\s+(\w+):.*\$\{\{\s*secrets\.(\w+)/);
    if (match && match[1] === match[2]) result.push(match[1]);
  }
  return Array.from(new Set(result));
}

const nuxtConfigContent = readRel("nuxt.config.ts");
const envExampleContent = readRel(".env.example");
const ciContent = readRel(".github/workflows/ci.yml");

const configEnvVars = extractEnvVarsFromConfig(nuxtConfigContent);
const exampleEnvVars = extractEnvVarsFromEnvExample(envExampleContent);
const ciDeployNuxtEnvVars = extractEnvVarsFromCIStep(ciContent, "deploy-nuxt");
const ciDeployConvexEnvVars = extractEnvVarsFromCIStep(ciContent, "deploy-convex");

const toolSecrets = new Set(["CLOUDFLARE_API_TOKEN", "CLOUDFLARE_ACCOUNT_ID", "CONVEX_DEPLOY_KEY"]);

describe("env var parity — nuxt.config.ts → .env.example", () => {
  it("every env var referenced in nuxt.config.ts is documented in .env.example", () => {
    const missing = configEnvVars.filter(
      (v) => !exampleEnvVars.includes(v),
    );
    expect(missing, `Missing from .env.example: ${missing.join(", ")}`).toEqual([]);
  });
});

describe("env var parity — nuxt.config.ts → CI deploy-nuxt", () => {
  it("every runtime env var in nuxt.config.ts is passed to wrangler deploy", () => {
    const runtimeVars = configEnvVars.filter((v) => !toolSecrets.has(v));
    const missing = runtimeVars.filter((v) => !ciDeployNuxtEnvVars.includes(v));
    expect(missing, `Missing from CI deploy-nuxt: ${missing.join(", ")}`).toEqual([]);
  });
});

describe("env var parity — .env.example → CI workflow", () => {
  it("every runtime env var in .env.example is present in CI deploy-nuxt", () => {
    const runtimeVars = exampleEnvVars.filter((v) => !toolSecrets.has(v));
    const knownNotInCI = new Set(["NEXT_PUBLIC_APP_URL"]);
    const missing = runtimeVars.filter(
      (v) => !ciDeployNuxtEnvVars.includes(v) && !knownNotInCI.has(v),
    );
    expect(missing, `Missing from CI deploy-nuxt: ${missing.join(", ")}`).toEqual([]);
  });
});

describe("env var usage — D8 additions", () => {
  it("R2_BUCKET_NAME is documented in .env.example", () => {
    expect(exampleEnvVars).toContain("R2_BUCKET_NAME");
  });

  it("R2_BUCKET_NAME is passed in CI deploy-nuxt", () => {
    expect(ciDeployNuxtEnvVars).toContain("R2_BUCKET_NAME");
  });

  it("CONVEX_DEPLOY_KEY is passed in CI deploy-convex", () => {
    expect(ciDeployConvexEnvVars).toContain("CONVEX_DEPLOY_KEY");
  });
});

describe("env var usage — no stale .env.example entries", () => {
  it("every env var in .env.example is referenced in code, CI, or known tooling", () => {
    const nuxtConfig = nuxtConfigContent;
    const combinedKnown = new Set([...configEnvVars, ...ciDeployNuxtEnvVars, ...ciDeployConvexEnvVars, ...toolSecrets, "NEXT_PUBLIC_APP_URL"]);
    for (const v of exampleEnvVars) {
      const inCode = nuxtConfig.includes(`process.env.${v}`);
      const inCI = combinedKnown.has(v);
      expect(inCI || inCode, `${v} is in .env.example but not used in code or CI`).toBe(true);
    }
  });
});
