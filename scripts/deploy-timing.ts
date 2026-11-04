#!/usr/bin/env npx tsx
/**
 * Deployment timing script.
 *
 * Measures the time required to deploy from a clean clone to production.
 * Runs `npm ci`, `npx convex deploy`, `npm run build`, and `npx wrangler deploy`
 * sequentially, timing each step. The total must be under 10 minutes (600 seconds).
 *
 * Usage:
 *   npx tsx scripts/deploy-timing.ts [--check-only]
 *
 * --check-only: Skip actual deployment commands, just verify the pipeline
 *               structure exists (CI workflow + scripts).
 *
 * Exit codes:
 *   0 — total deployment time under threshold (or --check-only passed)
 *   1 — deployment exceeded threshold or pipeline structure missing
 */

import { argv, exit } from "node:process";
import { exec } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { promisify } from "node:util";

const execAsync = promisify(exec);
const root = resolve(process.cwd());
const DEPLOY_TIMEOUT_SECONDS = 600;

interface StepResult {
  name: string;
  durationSeconds: number;
  passed: boolean;
  detail: string;
}

function log(message: string): void {
  console.log(`[deploy-timing] ${message}`);
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return `${mins}m ${secs}s`;
}

async function runStep(name: string, command: string): Promise<StepResult> {
  const start = Date.now();
  log(`Starting: ${name} (${command})`);

  try {
    const { stdout } = await execAsync(command, {
      maxBuffer: 10 * 1024 * 1024,
      timeout: DEPLOY_TIMEOUT_SECONDS * 1000,
    });
    const durationSeconds = (Date.now() - start) / 1000;
    log(`Completed: ${name} (${formatDuration(durationSeconds)})`);

    return { name, durationSeconds, passed: true, detail: stdout.trim().slice(-200) };
  } catch (err) {
    const durationSeconds = (Date.now() - start) / 1000;
    const message = err instanceof Error ? err.message : String(err);
    log(`FAILED: ${name} (${formatDuration(durationSeconds)}) — ${message}`);

    return { name, durationSeconds, passed: false, detail: message };
  }
}

function checkPipelineStructure(): StepResult[] {
  const results: StepResult[] = [];

  const ciWorkflowPath = resolve(root, ".github/workflows/ci.yml");
  const verifyScriptPath = resolve(root, "scripts/verify-deploy.ts");
  const deployScriptPath = resolve(root, "scripts/deploy-timing.ts");

  results.push({
    name: "CI workflow exists",
    durationSeconds: 0,
    passed: existsSync(ciWorkflowPath),
    detail: existsSync(ciWorkflowPath) ? `${ciWorkflowPath} exists` : `${ciWorkflowPath} not found`,
  });

  results.push({
    name: "verify-deploy script exists",
    durationSeconds: 0,
    passed: existsSync(verifyScriptPath),
    detail: existsSync(verifyScriptPath) ? `${verifyScriptPath} exists` : `${verifyScriptPath} not found`,
  });

  results.push({
    name: "deploy-timing script exists",
    durationSeconds: 0,
    passed: existsSync(deployScriptPath),
    detail: existsSync(deployScriptPath) ? `${deployScriptPath} exists` : `${deployScriptPath} not found`,
  });

  return results;
}

async function main(): Promise<void> {
  const checkOnly = argv.includes("--check-only");

  if (checkOnly) {
    log("Running in check-only mode (skipping actual deploy commands)");
    const results = checkPipelineStructure();

    let allPassed = true;
    for (const result of results) {
      const status = result.passed ? "PASS" : "FAIL";
      log(`${status}: ${result.name}`);
      if (!result.passed) allPassed = false;
    }

    if (!allPassed) {
      log("Pipeline structure check FAILED");
      exit(1);
    }
    log("Pipeline structure check PASSED");
    return;
  }

  const steps: { name: string; command: string }[] = [
    { name: "npm ci", command: "npm ci" },
    { name: "convex deploy", command: "npx convex deploy" },
    { name: "nuxt build", command: "npm run build" },
    { name: "wrangler deploy", command: "npx wrangler deploy" },
  ];

  const results: StepResult[] = [];
  let totalSeconds = 0;

  for (const step of steps) {
    const result = await runStep(step.name, step.command);
    results.push(result);
    totalSeconds += result.durationSeconds;

    if (!result.passed) {
      log(`Step failed: ${step.name}`);
      log(`Total time before failure: ${formatDuration(totalSeconds)}`);
      break;
    }
  }

  for (const result of results) {
    const status = result.passed ? "PASS" : "FAIL";
    log(`${status}: ${result.name} — ${formatDuration(result.durationSeconds)}`);
  }

  log(`Total deployment time: ${formatDuration(totalSeconds)}`);
  log(`Threshold: ${formatDuration(DEPLOY_TIMEOUT_SECONDS)}`);

  if (totalSeconds >= DEPLOY_TIMEOUT_SECONDS) {
    log("FAILED: Deployment exceeded 10-minute threshold");
    exit(1);
  }

  log("PASSED: Deployment within 10-minute threshold");
}

void main();
