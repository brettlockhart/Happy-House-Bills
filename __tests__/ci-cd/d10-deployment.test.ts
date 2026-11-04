import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";
import { resolve } from "node:path";

const root = resolve(process.cwd());

const ciContent = readFileSync(resolve(root, ".github/workflows/ci.yml"), "utf-8");
const verifyScript = readFileSync(resolve(root, "scripts/verify-deploy.ts"), "utf-8");
const timingScript = readFileSync(resolve(root, "scripts/deploy-timing.ts"), "utf-8");
const convexJson = readFileSync(resolve(root, "convex.json"), "utf-8");
const convexConfig = JSON.parse(convexJson);
const packageJson = JSON.parse(readFileSync(resolve(root, "package.json"), "utf-8"));

describe("D10: Deployment infrastructure — verify-deploy script", () => {
  it("REQUIRES verify-deploy.ts exists in scripts/", () => {
    expect(existsSync(resolve(root, "scripts/verify-deploy.ts"))).toBe(true);
  });

  it("REQUIRES script validates CONVEX_URL env var", () => {
    expect(verifyScript).toContain("CONVEX_URL");
    expect(verifyScript).toContain("env.CONVEX_URL");
  });

  it("REQUIRES script checks /health endpoint", () => {
    expect(verifyScript).toContain("/health");
    expect(verifyScript).toContain("status");
    expect(verifyScript).toContain("ok");
  });

  it("REQUIRES script has retry logic", () => {
    expect(verifyScript).toMatch(/MAX_RETRIES|MAX_RETRY/);
    expect(verifyScript).toMatch(/RETRY_DELAY|retry.*delay/i);
  });

  it("REQUIRES script exits with 1 on failure", () => {
    expect(verifyScript).toContain("exit(1)");
  });

  it("REQUIRES script exits with 0 on success", () => {
    expect(verifyScript).toContain("Passed");
  });
});

describe("D10: Deployment infrastructure — deploy-timing script", () => {
  it("REQUIRES deploy-timing.ts exists in scripts/", () => {
    expect(existsSync(resolve(root, "scripts/deploy-timing.ts"))).toBe(true);
  });

  it("REQUIRES script defines 10-minute threshold", () => {
    expect(timingScript).toMatch(/600|10.*minute|ten.*minute/i);
  });

  it("REQUIRES script times npm ci, convex deploy, build, wrangler deploy", () => {
    expect(timingScript).toContain("npm ci");
    expect(timingScript).toContain("npx convex deploy");
    expect(timingScript).toContain("npm run build");
    expect(timingScript).toContain("npx wrangler deploy");
  });

  it("REQUIRES script has --check-only mode", () => {
    expect(timingScript).toContain("--check-only");
  });

  it("REQUIRES script exits with 1 on timeout", () => {
    expect(timingScript).toContain("exit(1)");
  });

  it("REQUIRES --check-only mode checks actual file existence", () => {
    expect(timingScript).toContain("existsSync");
    expect(timingScript).toContain("ci.yml");
    expect(timingScript).toContain("verify-deploy.ts");
    expect(timingScript).toContain("deploy-timing.ts");
  });

  it("REQUIRES --check-only mode references correct workflow file", () => {
    expect(timingScript).not.toContain("'deployment.yml workflow'");
  });
});

describe("D10: Convex health endpoint", () => {
  it("REQUIRES health.ts exists", () => {
    expect(existsSync(resolve(root, "convex/health.ts"))).toBe(true);
  });

  it("REQUIRES /health HTTP route registered in convex.json", () => {
    const httpConfig = convexConfig.http;
    expect(httpConfig).toBeDefined();
    const healthRoute = httpConfig.find((h: { path: string; method: string }) => h.path === "/health" && h.method === "GET");
    expect(healthRoute, "/health GET route not found in convex.json").toBeDefined();
    expect(healthRoute.handler).toBe("http:healthCheck");
  });

   it("REQUIRES healthCheck handler returns JSON with status and timestamp", () => {
    const healthContent = readFileSync(resolve(root, "convex/health.ts"), "utf-8");
    expect(healthContent).toContain("healthCheck");
    expect(healthContent).toContain("status");
    expect(healthContent).toContain("timestamp");
    expect(healthContent).toContain("application/json");
  });

  it("REQUIRES healthCheck response has Cache-Control: no-store", () => {
    const healthContent = readFileSync(resolve(root, "convex/health.ts"), "utf-8");
    expect(healthContent).toContain("no-store");
  });

  it("REQUIRES healthCheck does not export preflightCheck", () => {
    const healthContent = readFileSync(resolve(root, "convex/health.ts"), "utf-8");
    expect(healthContent).not.toContain("preflightCheck");
    const httpContent = readFileSync(resolve(root, "convex/http.ts"), "utf-8");
    expect(httpContent).not.toContain("preflightCheck");
  });

  it("REQUIRES healthCheck exported from http.ts", () => {
    const httpContent = readFileSync(resolve(root, "convex/http.ts"), "utf-8");
    expect(httpContent).toContain("healthCheck");
    expect(httpContent).toContain("export { healthCheck }");
  });
});

describe("D10: CI workflow verify-deploy job", () => {
  it("REQUIRES verify-deploy job in ci.yml", () => {
    expect(ciContent).toContain("verify-deploy:");
  });

  it("REQUIRES verify-deploy depends on deploy-convex and deploy-nuxt", () => {
    const section = ciContent.split("verify-deploy:")[1];
    expect(section).toContain("needs: [deploy-convex, deploy-nuxt]");
  });

  it("REQUIRES verify-deploy only runs on master", () => {
    const section = ciContent.split("verify-deploy:")[1];
    expect(section).toContain("if: github.ref == 'refs/heads/master'");
  });

  it("REQUIRES verify-deploy has least-privilege permissions", () => {
    const section = ciContent.split("verify-deploy:")[1];
    expect(section).toContain("permissions:");
    expect(section).toContain("contents: read");
    expect(section).toContain("deployments: write");
  });
});

describe("D10: npm scripts registered", () => {
  it("REQUIRES deploy:verify script", () => {
    expect(packageJson.scripts["deploy:verify"]).toContain("verify-deploy.ts");
  });

  it("REQUIRES script uses npx tsx in package.json scripts", () => {
    expect(packageJson.scripts["deploy:verify"]).toContain("npx tsx");
    expect(packageJson.scripts["deploy:timing"]).toContain("npx tsx");
  });
});

describe("D10: CI workflow paths-ignore for docs-only changes", () => {
  it("REQUIRES push events ignore docs markdown and root markdown changes", () => {
    expect(ciContent).toContain("paths-ignore:");
    expect(ciContent).toContain("docs/**/*.md");
    expect(ciContent).toContain("*.md");
  });
});

describe("D10: Runtime validation of scripts", () => {
  it("REQUIRES deploy-timing.ts --check-only runs without crashing", () => {
    const output = execSync("npx tsx scripts/deploy-timing.ts --check-only", {
      cwd: root,
      encoding: "utf-8",
      timeout: 60000,
      env: { ...process.env, CONVEX_URL: "" },
    });
    expect(output).toContain("CI workflow exists");
    expect(output).toContain("verify-deploy script exists");
  }, 65000);

  it("REQUIRES verify-deploy.ts fails when CONVEX_URL not set", () => {
    const env = { ...process.env, CONVEX_URL: "" };
    try {
      execSync("npx tsx scripts/verify-deploy.ts", {
        cwd: root,
        encoding: "utf-8",
        timeout: 30000,
        env,
        stdio: ["pipe", "pipe", "pipe"],
      });
      expect.fail("Should have failed due to missing CONVEX_URL");
    } catch (err: { message?: string; stderr?: string; stdout?: string }) {
      const output = `${err.stdout || ""} ${err.stderr || ""} ${err.message || ""}`;
      expect(output).toMatch(/CONVEX_URL/i);
    }
  }, 35000);

  it("REQUIRES verify-deploy.ts fails fast on malformed URL", () => {
    const env = { ...process.env, CONVEX_URL: "not-a-url" };
    try {
      execSync("npx tsx scripts/verify-deploy.ts", {
        cwd: root,
        encoding: "utf-8",
        timeout: 30000,
        env,
        stdio: ["pipe", "pipe", "pipe"],
      });
      expect.fail("Should have failed due to malformed URL");
    } catch (err: { message?: string; stderr?: string; stdout?: string }) {
      const output = `${err.stdout || ""} ${err.stderr || ""} ${err.message || ""}`;
      expect(output).toMatch(/CONVEX_URL format/i);
    }
  }, 35000);
});
