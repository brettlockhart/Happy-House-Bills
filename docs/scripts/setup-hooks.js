import { chmodSync, copyFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";

const repoRoot = resolve(process.cwd());
const hooksDir = join(repoRoot, ".git", "hooks");
const sourceDir = join(repoRoot, "docs", "scripts", "hooks");

const hooks = ["pre-commit"];

for (const hook of hooks) {
  const source = join(sourceDir, hook);
  const target = join(hooksDir, hook);

  if (!existsSync(source)) {
    console.error(`Hook source not found: ${source}`);
    process.exit(1);
  }

  copyFileSync(source, target);
  chmodSync(target, 0o755);
  console.log(`Installed: .git/hooks/${hook}`);
}

console.log("\nGit hooks installed. They run automatically on commit.");
console.log("Bypass with: git commit --no-verify");
