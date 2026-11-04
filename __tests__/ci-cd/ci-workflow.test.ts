import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(process.cwd());
const ciContent = readFileSync(resolve(root, ".github/workflows/ci.yml"), "utf-8");

describe("CI workflow — triggers", () => {
  it("triggers on pull_request to master", () => {
    expect(ciContent).toContain("pull_request:");
    expect(ciContent).toContain("branches: [master]");
  });

  it("triggers on push to master", () => {
    expect(ciContent).toContain("push:");
    expect(ciContent).toContain("branches: [master]");
  });
});

describe("CI workflow — check jobs", () => {
  const checkJobs = ["lint", "typecheck", "test", "docs"];

  for (const job of checkJobs) {
    it(`has ${job} job`, () => {
      expect(ciContent).toContain(`${job}:`);
    });
  }

  it("lint job runs npm run lint", () => {
    expect(ciContent).toContain("npm run lint");
  });

  it("typecheck job runs tsc --noEmit", () => {
    expect(ciContent).toContain("npx tsc --noEmit");
  });

  it("typecheck job runs vue-tsc --noEmit", () => {
    expect(ciContent).toContain("npx vue-tsc --noEmit");
  });

  it("test job runs npm test", () => {
    expect(ciContent).toContain("npm test");
  });

  it("docs job runs docs:lint", () => {
    expect(ciContent).toContain("npm run docs:lint");
  });

  it("docs job runs docs:audit", () => {
    expect(ciContent).toContain("npm run docs:audit");
  });
});

describe("CI workflow — deploy jobs", () => {
  it("has deploy-convex job", () => {
    expect(ciContent).toContain("deploy-convex:");
  });

  it("has deploy-nuxt job", () => {
    expect(ciContent).toContain("deploy-nuxt:");
  });

  it("deploy-convex needs all 4 check jobs", () => {
    const needsMatch = ciContent.match(/deploy-convex:[\s\S]*?needs:\s*\[([^\]]+)\]/);
    expect(needsMatch, "deploy-convex needs not found").not.toBeNull();
    const needs = needsMatch![1].split(",").map((s) => s.trim());
    expect(needs).toEqual(
      expect.arrayContaining(["lint", "typecheck", "test", "docs"]),
    );
  });

  it("deploy-nuxt needs deploy-convex", () => {
    const needsMatch = ciContent.match(/deploy-nuxt:[\s\S]*?needs:\s*(\S+)/);
    expect(needsMatch, "deploy-nuxt needs not found").not.toBeNull();
    expect(needsMatch![1]).toBe("deploy-convex");
  });

  it("deploy-convex only runs on master", () => {
    const section = ciContent.split("deploy-convex:")[1];
    expect(section).toContain("if: github.ref == 'refs/heads/master'");
  });

  it("deploy-nuxt only runs on master", () => {
    const section = ciContent.split("deploy-nuxt:")[1];
    expect(section).toContain("if: github.ref == 'refs/heads/master'");
  });
});

describe("CI workflow — deploy-convex steps", () => {
  const section = ciContent.split("deploy-convex:")[1];

  it("runs npx convex deploy", () => {
    expect(section).toContain("npx convex deploy");
  });

  it("passes CONVEX_DEPLOY_KEY secret", () => {
    expect(section).toContain("CONVEX_DEPLOY_KEY: ${{ secrets.CONVEX_DEPLOY_KEY }}");
  });
});

describe("CI workflow — deploy-nuxt steps", () => {
  const section = ciContent.split("deploy-nuxt:")[1];

  it("runs npm run build", () => {
    expect(section).toContain("npm run build");
  });

  it("runs npx wrangler deploy", () => {
    expect(section).toContain("npx wrangler deploy");
  });

  it("passes CLOUDFLARE_API_TOKEN secret", () => {
    expect(section).toContain("CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}");
  });

  it("passes R2_BUCKET_NAME secret (added by D8)", () => {
    expect(ciContent).toContain("R2_BUCKET_NAME: ${{ secrets.R2_BUCKET_NAME }}");
  });
});

describe("CI workflow — verify-deploy job (D10)", () => {
  it("has verify-deploy job", () => {
    expect(ciContent).toContain("verify-deploy:");
  });

  it("verify-deploy needs deploy-convex and deploy-nuxt", () => {
    const section = ciContent.split("verify-deploy:")[1];
    expect(section).toContain("needs: [deploy-convex, deploy-nuxt]");
  });

  it("verify-deploy only runs on master", () => {
    const section = ciContent.split("verify-deploy:")[1];
    expect(section).toContain("if: github.ref == 'refs/heads/master'");
  });

  it("verify-deploy runs tsx scripts/verify-deploy.ts", () => {
    const section = ciContent.split("verify-deploy:")[1];
    expect(section).toContain("npx tsx scripts/verify-deploy.ts");
  });

  it("verify-deploy passes CONVEX_URL secret", () => {
    const section = ciContent.split("verify-deploy:")[1];
    expect(section).toContain("CONVEX_URL: ${{ secrets.CONVEX_URL }}");
  });

  it("verify-deploy has least-privilege permissions", () => {
    const section = ciContent.split("verify-deploy:")[1];
    expect(section).toContain("permissions:");
    expect(section).toContain("contents: read");
    expect(section).toContain("deployments: write");
  });
});
