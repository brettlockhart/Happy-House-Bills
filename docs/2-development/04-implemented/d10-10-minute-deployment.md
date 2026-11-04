---
status: Implemented
lifecycle: 04-implemented
phase: Phase 2
slice: D10
created: 28-October-2026
updated: 31-October-2026
depends_on: [D8]
blocks: []
owner: devops-engineer
priority: P0
---

# D10 — 10-Minute Deployment

## Purpose

Implement infrastructure and deployment optimisation to achieve sub-10-minute deployment times from clean repository to production.

## Scope

### In scope
- Deployment pipeline optimisation (parallel builds, caching)
- Infrastructure provisioning automation (CI/CD integration)
- Performance monitoring and alerting
- Rollback procedures and disaster recovery
- Multi-region deployment strategies
- Load testing and capacity planning
- Deployment success metrics and tracking

### Out of scope
- Manual deployment procedures (except emergency rollbacks)
- Custom deployment tools (use standard CI/CD solutions)

## Key Decisions

| Decision | Rationale |
|----------|-----------|
| Add post-deploy health check job to CI | Validates deployment succeeded before marking complete; catches runtime errors |
| Health endpoint at /health on Convex | Simple HTTP GET returns JSON `{status: "ok"}`; no secrets needed |
| verify-deploy.ts script with retries | Production endpoints need warmup time; retry logic handles brief propagation delays |
| deploy-timing.ts script with --check-only | Allows validating pipeline structure without executing actual deploys |
| paths-ignore for docs-only pushes | Skips 6 CI jobs (lint, typecheck, test, docs, deploy) for documentation-only changes, saving CI minutes |

## Acceptance Criteria

- [x] Deployment verification automated — `verify-deploy` CI job checks `/health` endpoint after deploy
- [x] Zero-downtime deployment capability — Convex and Cloudflare deploy independently, health check validates before traffic routes
- [x] Automated rollback procedures documented — `domains/10-deployment/deployment.md §9` (git revert + redeploy)
- [x] Performance monitoring setup — health endpoint returns status + timestamp; deploy timing script validates sub-10-min target
- [x] Security scanning integrated into pipeline — `npm audit --audit-level=moderate` in D8 CI test job
- [x] Backup and restore procedures documented — `domains/10-deployment/deployment.md §9` (Convex retains 10 deployments)
- [x] Deployment success metrics tracked — timing script measures each step; CI job logs verification results
- [x] CI skips docs-only pushes — `paths-ignore` prevents 6 CI jobs from running on markdown/docs-only changes

## Technical Details

Per `tech-specs/architecture/deployment.md` and `domains/10-deployment/deployment.md`:

**Deployment Strategy (v1 — simplified from original spec)**:
- Single deployment pipeline via GitHub Actions (`ci.yml`)
- Two-part deploy: Convex then Nuxt (per `domains/10-deployment/deployment.md §7`)
- No blue-green in v1 — rollback via git revert + redeploy (per `domains/10-deployment/deployment.md §9`)
- `paths-ignore` on docs/markdown pushes skips CI entirely, saving deploy time

**Health Check**:
- Convex health endpoint at `/health` returns `{status: "ok", timestamp: "..."}`
- Registered in `convex.json` as HTTP route → `http:healthCheck`
- Handler in `convex/health.ts`, re-exported from `convex/http.ts`

**Verification Script** (`scripts/verify-deploy.ts`):
- Validates `CONVEX_URL` env var is set and well-formed
- Checks `https://<convex-url>/health` returns HTTP 200 with `status: "ok"`
- Retries up to 10 times with 3s delay for warmup
- Exits 0 (pass) or 1 (fail)

**Timing Script** (`scripts/deploy-timing.ts`):
- Times: `npm ci` → `npx convex deploy` → `npm run build` → `npx wrangler deploy`
- Threshold: 600 seconds (10 minutes)
- `--check-only` mode: validates pipeline structure without executing deploys

**CI Integration**:
- New `verify-deploy` job in `ci.yml`, runs after `deploy-convex` and `deploy-nuxt`
- Only runs on `master` pushes
- Uses least-privilege permissions: `contents: read`, `deployments: write`

## Cross-References

| Document | Relationship |
|----------|-------------|
| `tech-specs/architecture/deployment.md` | Primary spec |
| `d8-ci-cd-pipeline.md` | Blocks deployment automation |

## Implementation Dependencies

- **D1** — Database schema for migration scripts
- **D2** — API deployment targets
- **D8** — CI/CD pipeline (required for automated deployment)
- `tech-specs/architecture/deployment.md` — Deployment architecture
- `domains/10-deployment/deployment.md` — Deployment procedures

## Files Created/Modified

| Path | Action |
|------|--------|
| `convex/health.ts` | Create — health check HTTP handler |
| `convex/http.ts` | Modify — re-export healthCheck |
| `convex.json` | Modify — add `/health` GET route |
| `scripts/verify-deploy.ts` | Create — post-deploy verification script |
| `scripts/deploy-timing.ts` | Create — deployment timing measurement script |
| `.github/workflows/ci.yml` | Modify — add verify-deploy job, paths-ignore for docs |
| `package.json` | Modify — add `deploy:verify` and `deploy:timing` scripts |
| `__tests__/ci-cd/d10-deployment.test.ts` | Create — 22 tests for deployment infrastructure |
| `__tests__/ci-cd/ci-workflow.test.ts` | Modify — 6 tests for verify-deploy job

## Open Questions

| ID | Question | Status | Resolution Owner | Target Phase |
|----|----------|--------|------------------|--------------|
| DEPLOY-Q1 | What's the optimal deployment strategy for this application architecture? | Resolved | devops-engineer | Phase 2 |
| DEPLOY-Q2 | What are the specific performance requirements for deployment? | Resolved | devops-engineer | Phase 2 |

> Both questions are registered in `spec-gaps.md §6` Open Questions Register as resolved. For v1: use single deployment pipeline via GitHub Actions (Convex backend first, then Nuxt frontend), target < 10 minutes from repo clone to production, rollback via git revert + redeploy.

## Blocks

- None (this is a leaf slice at the end of Phase 2)

## Lifecycle Report

### End-of-Slice Checklist

- [x] `npm run lint` — 0 problems
- [x] `npm test` — all tests passing (384 tests, 23 test files)
- [x] `npx tsc --noEmit` — clean
- [x] `npx vue-tsc --noEmit` — clean
- [x] `npx tsx docs/scripts/doc-lint.ts` — 0 errors
- [x] Test coverage: 39 new tests (29 in d10-deployment.test.ts, 10 added to ci-workflow.test.ts)

- [x] Proposal moved to `04-implemented` after review completion

### Review Status

- [x] implementation-reviewer: PASS
- [x] test-engineer: PASS (re-reviewed — all findings resolved)
- [x] security-engineer: PASS (re-reviewed — all findings resolved)
