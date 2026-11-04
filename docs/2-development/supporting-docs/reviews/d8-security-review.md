---
status: Review complete
lifecycle: reviews
slice: D8
security_review: true
scope: slice-level
created: 30-October-2026
updated: 30-October-2026
---

# Security Review Report: D8 — CI/CD Pipeline

**Status:** Review complete
**Scope:** Slice D8 — CI/CD Pipeline
**Date:** 30-October-2026
**Reviewer:** Security Engineer
**Verdict:** Pass

---

## Scope and Sensitivity

| Field | Value |
|-------|-------|
| Affected files | `.github/workflows/ci.yml`, `wrangler.toml`, `nuxt.config.ts`, `.env.example` |
| Authentication or authorisation | Deploy jobs guarded by master ref; PR runs cannot trigger production deploy |
| Billing or entitlements | No |
| File upload or export | No |
| Iframe, CSP, or preview | No |
| User data or PII | No user data processed in CI/CD pipeline |

---

## Security Checklist

| Control | Status | Evidence |
|---------|--------|----------|
| Secrets stored in GitHub Secrets, referenced via `${{ secrets.* }}` | ✅ Pass | `ci.yml` lines 74-104 — all secrets use `secrets.*` context |
| Secrets not echoed in logs or workflow output | ✅ Pass | No `echo`, `set-output`, or debug flags in workflow |
| Secrets not passed to build step (prevent client-side bundling) | ✅ Pass | `deploy-nuxt` job: `npm run build` has no `env:` block; secrets only on `npx wrangler deploy` step |
| Public runtimeConfig contains no secrets | ✅ Pass | `nuxt.config.ts` — `runtimeConfig.public` only has `clerkPublishableKey` (public by design) and `convexUrl` (non-secret) |
| CONVEX_DEPLOY_KEY removed from runtimeConfig | ✅ Pass | `nuxt.config.ts` — `convexDeployKey` entry removed |
| Workflow has least-privilege `permissions:` key | ✅ Pass | `ci.yml` — `permissions: { contents: read }` at workflow level; deploy jobs add `deployments: write` |
| npm audit step in CI | ✅ Pass | `ci.yml` test job — `npm audit --audit-level=moderate` |
| Deploy jobs guarded by master ref | ✅ Pass | Both deploy jobs have `if: github.ref == 'refs/heads/master'` |
| PRs from forks cannot trigger production deploy | ✅ Pass | Uses `pull_request` (not `pull_request_target`); deploy jobs gated on master ref |
| npm ci (not npm install) ensures reproducible builds | ✅ Pass | All jobs use `npm ci` |
| Deploy dependency chain enforced | ✅ Pass | `deploy-convex needs: [lint, typecheck, test, docs]`; `deploy-nuxt needs: deploy-convex` |
| wrangler.toml contains no secrets | ✅ Pass | `wrangler.toml` — `[vars]` only has `NEXT_PUBLIC_APP_URL` |
| .env.example has no secret values | ✅ Pass | All values are empty placeholders or default URLs |
| Webhook verification | ✅ Pass | `convex/http.ts` — HMAC-SHA256 with `crypto.timingSafeEqual` |

---

## OWASP Top 10 (2021) Analysis

| OWASP Category | D8 addresses? | Evidence |
|---------------|--------------|----------|
| A01 — Broken Access Control | ✅ Pass | Deploy jobs only run on `master` ref after all CI checks pass; PRs cannot trigger deploy |
| A02 — Cryptographic Failures | ✅ Pass | No crypto introduced; npm ci reproducible builds ensure integrity |
| A03 — Injection | ✅ Pass | No user input processed in CI/CD pipeline |
| A04 — Insecure Design | ✅ Pass | Direct-to-production for v1 accepted per D6 decision; deploy chain dependency enforced |
| A05 — Security Misconfiguration | ✅ Pass | Least-privilege permissions key added; npm audit gate added |
| A06 — Vulnerable/Outdated Components | ✅ Pass | npm audit --audit-level=moderate in CI prevents moderate+ vulnerabilities |
| A07 — Identification & Auth Failures | ✅ Pass | Secrets isolated to deploy jobs only; no secret in build/test steps |
| A08 — Software & Data Integrity Failures | N/A | No CI/CD signing in v1 scope |
| A09 — Security Logging & Monitoring Failures | N/A | GitHub Actions auto-masks secrets; no custom logging needed |
| A10 — SSRF | N/A | No outbound requests from CI to internal services |

---

## Findings

| # | File or area | Finding | Severity | Status |
|---|--------------|---------|----------|--------|
| SEC-D8-001 | `nuxt.config.ts:28` | `CONVEX_DEPLOY_KEY` was in runtime config | Low | REMEDIATED — removed; only used in CI deploy-convex job |
| SEC-D8-002 | `ci.yml` (workflow) | No `permissions:` key — excessive default token permissions | Low | REMEDIATED — added `permissions: { contents: read }` |
| SEC-D8-003 | `ci.yml` (test job) | No dependency vulnerability scanning | Medium | REMEDIATED — added `npm audit --audit-level=moderate` |
| SEC-D8-004 | `ci.yml` (deploy jobs) | No GitHub Environment with approval for production deploy | Medium | Accepted (v1 direct-to-production per D6) |
| SEC-D8-005 | `package.json` | Security-sensitive packages use `^` version ranges | Low | Accepted (npm ci mitigates) |
| SEC-D8-006 | `ci.yml` | GitHub Actions pinned to major version tags, not SHAs | Info | Accepted (v1) |

---

## Residual Risk

**Residual risk: Low.** All actionable security findings remediated (SEC-D8-001, SEC-D8-002, SEC-D8-003). Remaining items (SEC-D8-004, SEC-D8-005, SEC-D8-006) are accepted v1 decisions with minimal risk for a two-member-household threat model.

1. No GitHub Environment approval gate for production deploy — accepted per D6 decision (direct-to-production for v1).
2. Security-sensitive packages use `^` ranges — npm ci ensures reproducible builds from lock file; accepted.
3. Actions pinned to major version tags — acceptable v1 posture; can upgrade to SHA pinning in Phase 3.

---

## Approval

| Decision | Approver | Date | Notes |
|----------|----------|------|-------|
| Pass | Security Engineer | 30-October-2026 | All actionable findings remediated. SEC-D8-001 (CONVEX_DEPLOY_KEY in runtimeConfig), SEC-D8-002 (permissions), SEC-D8-003 (npm audit) addressed. 7 SEC-D8 security test cases implemented in `d8-security.test.ts`. Slice may proceed to `04-implemented`. |

---

## Next Gate

1. **Verify:** `npm run lint` (0 problems), `npx vue-tsc --noEmit` (0 errors), `npm test` (all tests pass).
2. **Recommended (Phase 3):** Pin GitHub Actions to SHAs; use GitHub Environments with required reviewers for production deploy.
