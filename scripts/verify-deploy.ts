#!/usr/bin/env npx tsx
/**
 * Deployment verification script.
 *
 * Runs after `npx convex deploy` and `npx wrangler deploy` to validate that
 * the production deployment is healthy. Expects the following environment
 * variables to be set:
 *
 *   CONVEX_URL — the Convex deployment URL (e.g. https://<name>.convex.cloud)
 *
 * Usage:
 *   npx tsx scripts/verify-deploy.ts
 *
 * Exit codes:
 *   0 — all checks passed
 *   1 — one or more checks failed
 */

import { exit, env } from "node:process";

const CONVEX_URL = env.CONVEX_URL;
const MAX_RETRIES = 10;
const RETRY_DELAY_MS = 3000;

interface HealthResponse {
  status: string;
  timestamp: string;
}

interface VerifyResult {
  name: string;
  passed: boolean;
  detail: string;
}

function log(message: string): void {
  console.log(`[verify-deploy] ${message}`);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function checkHealthEndpoint(url: string): Promise<VerifyResult> {
  const healthUrl = `${url.replace(/\/$/, "")}/health`;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(healthUrl, { method: "GET" });
      if (response.ok) {
        const data = (await response.json()) as HealthResponse;
        if (data.status === "ok") {
          return { name: "Convex health endpoint", passed: true, detail: `HTTP ${response.status}, status: ${data.status}` };
        }
        return { name: "Convex health endpoint", passed: false, detail: `Unexpected status: ${data.status}` };
      }
      return { name: "Convex health endpoint", passed: false, detail: `HTTP ${response.status} ${response.statusText}` };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      log(`Attempt ${attempt}/${MAX_RETRIES}: ${message}`);
      if (attempt < MAX_RETRIES) {
        await sleep(RETRY_DELAY_MS);
      }
    }
  }

  return { name: "Convex health endpoint", passed: false, detail: `Failed after ${MAX_RETRIES} retries` };
}

function checkConvexUrlConfigured(): VerifyResult {
  if (!CONVEX_URL) {
    return { name: "CONVEX_URL configured", passed: false, detail: "CONVEX_URL env var not set" };
  }
  return { name: "CONVEX_URL configured", passed: true, detail: CONVEX_URL };
}

function checkUrlFormat(url: string): VerifyResult {
  try {
    const parsed = new URL(url);
    const isValid = parsed.protocol === "https:" && parsed.hostname.length > 0;
    return { name: "CONVEX_URL format", passed: isValid, detail: `protocol: ${parsed.protocol}, hostname: ${parsed.hostname}` };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { name: "CONVEX_URL format", passed: false, detail: message };
  }
}

async function main(): Promise<void> {
  const results: VerifyResult[] = [];

  results.push(checkConvexUrlConfigured());

  if (CONVEX_URL) {
    const formatResult = checkUrlFormat(CONVEX_URL);
    results.push(formatResult);
    if (formatResult.passed) {
      results.push(await checkHealthEndpoint(CONVEX_URL));
    }
  }

  let allPassed = true;
  for (const result of results) {
    const status = result.passed ? "PASS" : "FAIL";
    log(`${status}: ${result.name} — ${result.detail}`);
    if (!result.passed) {
      allPassed = false;
    }
  }

  if (!allPassed) {
    log("Deployment verification FAILED");
    exit(1);
  }

  log("Deployment verification PASSED");
}

void main();
