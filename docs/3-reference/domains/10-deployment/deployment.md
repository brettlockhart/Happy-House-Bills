---
status: Draft
package: app
priority: high
created: 25-October-2026
updated: 25-October-2026
tags: [deployment, ci-cd, github-actions, cloudflare, convex]
---

# Domain Spec: Deployment & CI/CD

**Date:** 25-October-2026
**Status:** Draft
**Audience:** All engineers, DevOps

## 1. Purpose

Define the deployment domain: how the full application (Nuxt frontend + Convex backend) is deployed to production. This covers both the automated CI/CD pipeline and the manual deployment process, plus environment configuration across local, CI, and production.

## 2. Scope

### In scope

- GitHub Actions CI/CD pipeline (`.github/workflows/ci.yml`)
- Manual deploy steps: `npx convex deploy` followed by `npx wrangler deploy`
- Environment configuration: `.env` for local, GitHub Secrets for CI
- Deploy order: Convex backend first, then Nuxt frontend
- Preview deployments for PRs (Cloudflare preview, Convex preview)
- Deploy verification: health check after deployment
- Rollback: git revert + redeploy

### Out of scope

- CI/CD workflow definition details (covered by `tech-specs/architecture/ci-cd.md`)
- Environment variable reference (covered by `tech-specs/architecture/deployment.md` (## 7. Environment Variables))
- Cloudflare R2 bucket configuration (covered by `tech-specs/backend/file-storage.md`)
- Clerk instance configuration (covered by `tech-specs/architecture/deployment.md` (## 9. Clerk Configuration))

## 3. Key Decisions

| ID | Decision | Rationale | Source |
|----|----------|-----------|--------|
| D1 | Two-part deployment: Convex first, then Nuxt | Frontend may reference Convex-deployed URL/types; backend must be deployed first to accept requests | `tech-specs/architecture/ci-cd.md` D5 |
| D2 | GitHub Actions on every PR and push to `master` | Ensures all changes pass lint, typecheck, tests, and doc validation before merge | `docs/AGENTS.md` (## 5. Doc Lifecycle Management) |
| D3 | Branch protection on `master` (all CI checks required) | Prevents broken code from reaching production | `docs/AGENTS.md` (## 6. Git) |
| D4 | No staging environment in v1 | Two-member households; direct-to-production is acceptable; staging doubles infrastructure cost | `project_brief.md` (## Non-Goals) |
| D5 | Cloudflare preview deployments for PRs | Allows review of frontend changes before merge; zero-config via `wrangler.toml` | `project_brief.md` (## Acceptance Criteria — deploy < 10 min) |

## 4. Open Questions

| ID | Question | Status | Notes |
|----|----------|--------|-------|
| (none) | — | — | — |

## 5. Cross-References

- `tech-specs/architecture/ci-cd.md` — GitHub Actions workflow definition
- `tech-specs/architecture/deployment.md` — manual deploy steps, env vars, Clerk config
- `tech-specs/architecture/project-scaffolding.md` — local dev commands
- `domains/11-security/security.md` — env var security, secret scoping
- `spec-gaps.md` — gap tracking

## 6. Implementation Dependencies

- **Depends on:** `ci-cd.md` (workflow), `deployment.md` (env vars), `project-scaffolding.md` (scripts)
- **Blocks:** None (deployment is the final step)
- **Consumer integration:** GitHub Actions runners; Cloudflare Workers; Convex CLI

## 7. Deploy Order

```
1. CI checks pass on PR (lint, typecheck, test, docs)
2. PR merged to master
3. GitHub Actions triggers on push to master:
   a. convex deploy — deploys backend functions + schema
   b. nuxt build — builds frontend for cloudflare_module preset
   c. wrangler deploy — deploys Nuxt app to Cloudflare Workers
4. Post-deploy verification:
   a. GET https://app.happyhousebills.com/api/health → 200 OK
   b. Convex functions list returns updated deployment
5. Slack notification sent to #deployments channel
```

## 8. Environment Configuration

| Environment | Env source | Notes |
|-------------|-----------|-------|
| Local dev | `.env` file | Copied from `.env.example` |
| CI (GitHub Actions) | GitHub Secrets | `CONVEX_DEPLOY_AUTH_TOKEN`, `CLOUDFLARE_API_TOKEN`, etc. |
| Production | Cloudflare Worker vars + Convex env vars | Same keys as CI; `CONVEX_URL` points to production deployment |
| Preview (PRs) | GitHub Actions auto-generated | Convex preview branch; Cloudflare preview deployment |

## 9. Rollback Procedure

```bash
# 1. Revert the deployment commit
git revert <commit-hash>

# 2. Convex automatically deploys the reverted code
npx convex deploy

# 3. Redeploy the frontend
npm run build && npx wrangler deploy

# 4. Verify
curl https://app.happyhousebills.com/api/health
```

Convex retains the last 10 deployments, allowing rollback within the Convex dashboard if the git revert fails.
