---
status: Draft
package: project
priority: high
created: 25-October-2026
updated: 25-October-2026
tags: [architecture, ci-cd, github-actions, deployment, automation]
---

# Tech Spec: CI/CD Pipeline

**Date:** 25-October-2026
**Status:** Draft
**Audience:** All engineers

## 1. Purpose

Define the GitHub Actions CI/CD pipeline for Happy House Bills. The pipeline runs lint, typecheck, tests, and doc validation on every pull request, and deploys Convex and the Nuxt app on every push to `master` after approval.

## 2. Scope

### In scope

- GitHub Actions workflow file (`.github/workflows/ci.yml`)
- Pre-deploy CI checks: ESLint, TypeScript typecheck, Vue typecheck, Vitest, doc-lint, docs-audit
- Convex deployment action (`npx convex deploy`) on push to `master`
- Nuxt build and Cloudflare Worker deployment (`npx wrangler deploy`) on push to `master`
- Environment separation: preview deployments for PRs, production for `master`
- Commit status checks: `ci/lint`, `ci/typecheck`, `ci/test`, `ci/docs`
- Branch protection: `master` requires all CI checks to pass

### Out of scope

- Manual deployment steps (covered by `tech-specs/architecture/deployment.md`)
- Environment variable management in CI (secrets stored in GitHub, see `tech-specs/architecture/deployment.md`)
- Performance monitoring (deferred to Phase 2)
- Feature flagging (no feature flags in v1)

## 3. Key Decisions

| ID | Decision | Rationale | Source |
|----|----------|-----------|--------|
| D1 | Single CI workflow file (`ci.yml`) for all checks | v1 is small; separate workflow files add complexity without benefit | `project_brief.md` (## 5. Project Scope) |
| D2 | Deploy on push to `master` only | `master` is the production branch; PRs get preview URLs via Cloudflare preview deployments | `docs/AGENTS.md` (## 6. Git) |
| D3 | Doc validation (`doc-lint` + `docs-audit`) runs in CI | Prevents doc drift; docs are part of the test gate | `docs/AGENTS.md` (## Doc Lifecycle Management) |
| D4 | Parallel jobs for lint, typecheck, and test | Reduces total CI duration from ~6 min to ~2 min | Standard CI optimisation |
| D5 | Convex deploy runs before Nuxt deploy | Frontend may reference Convex API types; backend must be deployed first | `project_brief.md` (## 5. Project Scope) |
| D6 | No staging environment in v1 | Two-member households; direct-to-production is acceptable; staging doubles infrastructure cost | `project_brief.md` (## Non-Goals) |

## 4. Open Questions

| ID | Question | Status | Notes |
|----|----------|--------|-------|
| (none) | — | — | — |

## 5. Cross-References

- `tech-specs/architecture/deployment.md` — manual deploy steps, env vars
- `tech-specs/architecture/project-scaffolding.md` — local dev commands
- `tech-specs/backend/api-contract.md` — Convex function surface
- `docs/AGENTS.md` (## Doc Lifecycle Management) — doc lifecycle and linting
- `spec-gaps.md` — gap tracking

## 6. Implementation Dependencies

- **Depends on:** `project-scaffolding.md` (scripts must exist in package.json)
- **Blocks:** `domains/10-deployment/deployment.md`
- **Consumer integration:** GitHub Actions runners; Cloudflare Workers; Convex CLI

## 7. Workflow Definition

```yaml
# .github/workflows/ci.yml
name: CI

on:
  pull_request:
    branches: [master]
  push:
    branches: [master]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm run lint

  typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npx tsc --noEmit
      - run: npx vue-tsc --noEmit

  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm test

  docs:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm run docs:lint
      - run: npm run docs:audit

  deploy-convex:
    needs: [lint, typecheck, test, docs]
    if: github.ref == 'refs/heads/master'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npx convex deploy
        env:
          CONVEX_DEPLOY_KEY: ${{ secrets.CONVEX_DEPLOY_KEY }}

  deploy-nuxt:
    needs: deploy-convex
    if: github.ref == 'refs/heads/master'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm run build
      - run: npx wrangler deploy
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          CONVEX_URL: ${{ secrets.CONVEX_URL }}
          NUXT_PUBLIC_CLERK_PUBLISHABLE_KEY: ${{ secrets.NUXT_PUBLIC_CLERK_PUBLISHABLE_KEY }}
          NUXT_CLERK_SECRET_KEY: ${{ secrets.NUXT_CLERK_SECRET_KEY }}
          CLERK_WEBHOOK_SECRET: ${{ secrets.CLERK_WEBHOOK_SECRET }}
          RESEND_API_KEY: ${{ secrets.RESEND_API_KEY }}
          RESEND_FROM_EMAIL: ${{ secrets.RESEND_FROM_EMAIL }}
          R2_ACCOUNT_ID: ${{ secrets.R2_ACCOUNT_ID }}
          R2_ACCESS_KEY_ID: ${{ secrets.R2_ACCESS_KEY_ID }}
          R2_SECRET_ACCESS_KEY: ${{ secrets.R2_SECRET_ACCESS_KEY }}
          R2_BUCKET_NAME: ${{ secrets.R2_BUCKET_NAME }}
          RECEIPT_SIGNED_URL_TTL: ${{ secrets.RECEIPT_SIGNED_URL_TTL }}
```

## 8. Branch Protection Rules

The `master` branch requires:

- ✅ `lint` job — 0 ESLint problems
- ✅ `typecheck` job — `tsc` + `vue-tsc` both pass
- ✅ `test` job — all Vitest tests pass
- ✅ `docs` job — `doc-lint` + `docs-audit` pass with 0 errors
- ✅ `deploy-convex` and `deploy-nuxt` jobs — successful production deployment

PRs are auto-mergeable after all checks pass and one approval review.
