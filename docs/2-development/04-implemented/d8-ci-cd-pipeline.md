---
status: Implemented
lifecycle: 04-implemented
phase: Phase 2
slice: D8
created: 28-October-2026
updated: 30-October-2026
depends_on: [D7]
blocks: [D10]
owner: devops-engineer
priority: P0
---

# D8 — CI/CD Pipeline

## Purpose

Implement automated CI/CD pipeline for Happy House Bills using GitHub Actions. The pipeline runs lint, typecheck, tests, and doc validation on every pull request, and deploys Convex backend followed by the Nuxt frontend on every push to `master`.

## Scope

### In scope

- GitHub Actions CI workflow (`.github/workflows/ci.yml`)
- Pre-deploy checks: ESLint, TypeScript typecheck, Vue typecheck, Vitest, doc-lint, docs-audit
- Convex deployment on push to `master` (after CI passes)
- Nuxt build and Cloudflare Worker deployment via `wrangler deploy` on push to `master`
- Commit status checks: `ci/lint`, `ci/typecheck`, `ci/test`, `ci/docs`
- Branch protection: `master` requires all CI checks to pass

### Out of scope

- Manual deployment steps (covered by `domains/10-deployment/deployment.md`)
- Staging environment (per tech-spec decision D6 — direct-to-production for v1)
- Third-party service configuration (Sentry, Mixpanel, etc.)
- Security scanning (GitGuardian, Snyk, Trivy) — deferred to later slice
- Infrastructure as Code (Terraform) — not needed for v1
- Docker container — Nuxt uses `cloudflare-module` Nitro preset, deploys directly via Wrangler
- Monitoring/alerting setup — deferred to later slice

## Key Decisions

| ID | Decision | Rationale | Source |
|----|----------|-----------|--------|
| D1 | Single CI workflow file (`ci.yml`) for all checks + deploy | v1 is small; separate workflow files add complexity without benefit | `tech-specs/architecture/ci-cd.md` (§3 D1) |
| D2 | Deploy on push to `master` only | `master` is the production branch; PRs get preview via Cloudflare preview deployments | `tech-specs/architecture/ci-cd.md` (§3 D2) |
| D3 | Doc validation (`doc-lint` + `docs-audit`) runs in CI | Prevents doc drift; docs are part of the test gate | `tech-specs/architecture/ci-cd.md` (§3 D3) |
| D4 | Parallel jobs for lint, typecheck, and test | Reduces total CI duration | `tech-specs/architecture/ci-cd.md` (§3 D4) |
| D5 | Convex deploy runs before Nuxt deploy | Frontend may reference Convex API types; backend must be deployed first | `tech-specs/architecture/ci-cd.md` (§3 D5) |
| D6 | No staging environment in v1 | Two-member households; direct-to-production is acceptable; staging doubles infrastructure cost | `tech-specs/architecture/ci-cd.md` (§3 D6) |

## Acceptance Criteria

- [x] `npm run lint` — 0 problems
- [x] `npm test` — all tests passing (327 tests, 22 test files)
- [x] `npx vue-tsc --noEmit` — 0 errors
- [x] `npm run docs:lint` — 0 errors
- [x] `npm run docs:audit` — 0 errors
- [x] GitHub Actions workflow (`.github/workflows/ci.yml`) with 4 check jobs (lint, typecheck, test, docs)
- [x] GitHub Actions deploy jobs for Convex and Nuxt on push to `master`
- [x] Branch protection: deploy jobs `needs` all check jobs
- [x] Environment variables documented in `.env.example`
- [x] `npm audit --audit-level=moderate` — no moderate+ vulnerabilities (CI security gate added)

## Technical Details

Per `tech-specs/architecture/ci-cd.md` (§7) and `domains/10-deployment/deployment.md` (§7):

**CI Workflow** (`.github/workflows/ci.yml`):
- **lint** — `npm run lint` (parallel)
- **typecheck** — `npx tsc --noEmit` + `npx vue-tsc --noEmit` (parallel)
- **test** — `npm test` (Vitest) (parallel)
- **docs** — `npm run docs:lint` + `npm run docs:audit` (parallel)
- **deploy-convex** — `needs: [lint, typecheck, test, docs]`; runs `npx convex deploy` with `CONVEX_DEPLOY_KEY` secret; `if: github.ref == 'refs/heads/master'`
- **deploy-nuxt** — `needs: deploy-convex`; runs `npm run build` then `npx wrangler deploy` with Cloudflare API token and all env vars

**Deploy order** (per `domains/10-deployment/deployment.md` §7):
1. CI checks pass on PR (lint, typecheck, test, docs)
2. PR merged to master
3. `deploy-convex` job runs after all checks pass
4. `deploy-nuxt` job runs after Convex deployment succeeds
5. Post-deploy verification via health check

**wrangler.toml**: Updated with `pages_build_output_dir` and `main` pointing to Nuxt's `.output/server/pages/_worker.js` for the `cloudflare-module` Nitro preset.

## Cross-References

| Document | Relationship |
|----------|-------------|
| `tech-specs/architecture/ci-cd.md` | Primary spec |
| `domains/10-deployment/deployment.md` | Deployment procedures |
| `d7-email-notifications.md` | D7 was dependency; CI runs D7's tests |
| `d10-10-minute-deployment.md` | CI/CD enables D10's fast deployment goal |

## Implementation Dependencies

- **Completed:** D1 (backend schema), D2 (API contracts), D7 (email notifications — CI runs D7 tests)
- **Blocks:** D10 (10-minute deployment)
- `tech-specs/architecture/ci-cd.md` — CI/CD architecture
- `domains/10-deployment/deployment.md` — Deployment procedures

## Files Created/Modified

| Path | Action |
|------|--------|
| `.github/workflows/ci.yml` | Create — CI pipeline with lint, typecheck, test, docs, deploy-convex, deploy-nuxt jobs; permissions key; npm audit step |
| `wrangler.toml` | Modify — add `pages_build_output_dir`, `main`, and `[vars]` for production build |
| `.env.example` | Modify — add `R2_BUCKET_NAME` and CI/CD env var section |
| `nuxt.config.ts` | Modify — removed `convexDeployKey` from runtimeConfig (SEC-D8-001 fix) |
| `__tests__/ci-cd/env-var-parity.test.ts` | Create — 7 env var parity contract tests |
| `__tests__/ci-cd/ci-workflow.test.ts` | Create — 17 CI workflow structure tests |
| `__tests__/ci-cd/wrangler-config.test.ts` | Create — 9 wrangler.toml configuration tests |
| `__tests__/ci-cd/d8-security.test.ts` | Create — 16 SEC-D8 security tests |
| `vitest.config.ts` | Modify — added `__tests__/ci-cd/**/*.ts` to include array |
| `docs/2-development/supporting-docs/reviews/d8-test-coverage-report.md` | Create — test coverage report |
| `docs/2-development/supporting-docs/reviews/d8-security-review.md` | Create — security review report |

## Open Questions

| ID | Question | Status | Resolution Owner | Target Phase |
|----|----------|--------|------------------|--------------|
| CI-CD-Q1 | Should we use GitHub Actions or GitLab CI? | Resolved | DevOps | Phase 2 — use GitHub Actions (already integrated) |
| CI-CD-Q2 | What's the optimal deployment strategy? | Resolved | Backend Engineer | Phase 2 — serverless (Nuxt → Cloudflare Workers, Convex backend) |

> Both questions resolved per `tech-specs/architecture/ci-cd.md` (§3). For v1: GitHub Actions, single CI workflow file, Nuxt + Cloudflare Workers + Convex.

## Blocks

- None (this is a leaf slice at the end of Phase 2 — D8 blocks D10)

---

## Lifecycle Report

### End-of-Slice Checklist

- [x] Proposal moved from `01-draft` → `02-in-progress` before implementation
- [x] `.github/workflows/ci.yml` created with 6 parallel/sequential jobs
- [x] `wrangler.toml` updated for Nuxt `cloudflare-module` preset
- [x] `.env.example` updated with `R2_BUCKET_NAME` and CI/CD env var section
- [x] `npm run lint` — 0 problems
- [x] `npx tsc --noEmit` — 0 errors
- [x] `npx vue-tsc --noEmit` — 0 errors
- [x] `npm test` — all tests passing
- [x] `npm run docs:lint` — 0 errors
- [x] `npx tsx docs/scripts/docs-audit.ts` — no new warnings from D8 changes
- [x] Cross-references use relative paths (per AGENTS.md)
- [x] Frontmatter updated: `status: Ready for Review`, `lifecycle: 03-ready-for-review`

### Notes

- The D8 proposal originally scoped staging environments, Docker containers, Terraform IaC, and security scanners. These were scoped out per `tech-specs/architecture/ci-cd.md` decisions D1 (single workflow file), D5 (Convex-first deploy), and D6 (no staging in v1).
- The Nuxt app uses `nitro.preset: 'cloudflare-module'` (see `nuxt.config.ts`), so `wrangler deploy` handles deployment directly — no Docker needed.
- Security scanning (GitGuardian, Snyk, Trivy) is deferred to a later slice as it was not part of the v1 CI spec.
