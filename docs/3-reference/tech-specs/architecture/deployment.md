---
status: Draft
package: project
priority: high
created: 25-October-2026
updated: 25-October-2026
tags: [architecture, deployment, cloudflare, convex, env-vars]
---

# Tech Spec: Deployment

**Date:** 25-October-2026
**Status:** Draft
**Audience:** All engineers

## 1. Purpose

Define the manual deployment process for Happy House Bills, the environment variables required for each service, and the production configuration for Cloudflare Workers, Convex, and Clerk. This spec is the source of truth for "deploy from clean repo to production in under 10 minutes" (`project_brief.md`).

## 2. Scope

### In scope

- Convex deployment command and auth token configuration
- Nuxt 4 build for Cloudflare Workers via `nitro.preset: 'cloudflare-module'`
- Cloudflare Worker deployment via `npx wrangler deploy`
- All environment variables for production (Convex, Clerk, Resend, R2, Cloudflare)
- Domain configuration: `happy-house-bill.brettlockhart.com`
- Clerk instance configuration: Organisation settings, email templates, webhook endpoints
- R2 bucket setup via `@convex-dev/r2` component
- Rollback procedure: revert commit + redeploy

### Out of scope

- CI/CD automation (covered by `tech-specs/architecture/ci-cd.md`)
- Staging environment (no staging in v1 per `project_brief.md`)
- Performance monitoring and alerting (deferred to Phase 2)
- CDN cache invalidation (handled automatically by Cloudflare)

## 3. Key Decisions

| ID | Decision | Rationale | Source |
|----|----------|-----------|--------|
| D1 | Two-part deployment: Convex first, then Nuxt | Frontend may reference Convex-deployed URL; backend must be deployed first to accept requests | `tech-specs/architecture/ci-cd.md` D5 |
| D2 | Cloudflare Workers via `wrangler.toml` for Worker config | Standard Cloudflare tooling; single source of truth for Worker metadata | `wrangler.toml` |
| D3 | Clerk environment variables stored as runtime config in `nuxt.config.ts` | Nuxt runtimeConfig supports both public (prefixed `NUXT_PUBLIC_`) and private env vars | `nuxt.config.ts` |
| D4 | All 11 environment variables set in both local `.env` and CI/Cloudflare secrets | Ensures parity between local dev and production | `.env.example` |
| D5 | Rollback via git revert + redeploy | Simpler than blue/green for v1's low traffic; Convex keeps 10 deploys for rollback | `docs/AGENTS.md` (## 6. Git) |
| D6 | R2 bucket managed by `@convex-dev/r2` component, not `wrangler.toml` | Single deployment path; Convex component handles bucket creation | `project_brief.md` (## Tech Stack) |
| D7 | Clerk webhook signature verified via `verifyWebhook` from `@clerk/nuxt` | Prevents forged webhook payloads from manipulating org/user data in Convex | `domains/11-security/security.md` (## 11. Webhook Verification), `tech-specs/backend/data-model.md` (## 4. Schema Fields) |

## 4. Open Questions

| ID | Question | Status | Notes |
|----|----------|--------|-------|
| (none) | — | — | — |

## 5. Cross-References

- `convex.json` — Convex project name and link
- `wrangler.toml` — Cloudflare Worker configuration
- `nuxt.config.ts` — runtimeConfig env var mapping
- `.env.example` — all environment variables with descriptions
- `tech-specs/architecture/project-scaffolding.md` — local dev commands
- `tech-specs/architecture/ci-cd.md` — automated deploy pipeline
- `domains/10-deployment/deployment.md` — domain-level deployment workflow
- `domains/11-security/security.md` — ## 11. Webhook Verification, ## 13. Secrets Management (R2 key least-privilege)
- `spec-gaps.md` — gap tracking

## 6. Implementation Dependencies

- **Depends on:** `tech-specs/architecture/ci-cd.md` (pipeline uses production deploy steps), `project-scaffolding.md` (scripts)
- **Blocks:** `domains/10-deployment/deployment.md`, `domains/11-security/security.md`
- **Consumer integration:** Production runtime; `.env` file creation; Clerk dashboard configuration

## 7. Environment Variables

| Variable | Service | Scope | Description |
|----------|---------|-------|-------------|
| `NUXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk | public | Clerk frontend publishable key |
| `NUXT_CLERK_SECRET_KEY` | Clerk | private | Clerk backend secret key |
| `CLERK_WEBHOOK_SECRET` | Clerk | private | Webhook signature verification |
| `CONVEX_URL` | Convex | public | Convex deployment URL (replaces `NEXT_PUBLIC_CONVEX_URL`) |
| `CONVEX_DEPLOY_KEY` | Convex | private | Token for `npx convex deploy` (correct name per Convex CLI docs; `CONVEX_DEPLOY_AUTH_TOKEN` is legacy) |
| `RESEND_API_KEY` | Resend | private | Transactional email API key |
| `RESEND_FROM_EMAIL` | Resend | public | Verified sender email |
| `R2_ACCOUNT_ID` | Cloudflare R2 | private | Cloudflare account ID |
| `R2_ACCESS_KEY_ID` | Cloudflare R2 | private | S3-compatible access key — scoped to `hhb-receipts` bucket only |
| `R2_SECRET_ACCESS_KEY` | Cloudflare R2 | private | S3-compatible secret key — scoped to `hhb-receipts` bucket only |
| `R2_BUCKET_NAME` | Cloudflare R2 | private | R2 bucket name (`hhb-receipts`) |
| `RECEIPT_SIGNED_URL_TTL` | Cloudflare R2 | private | TTL for signed URLs in seconds (default: 3600) |
| `WRANGLER_ACCOUNT_ID` | Cloudflare | private | Cloudflare account ID for `wrangler` |

## 8. Deployment Steps

### Step 1: Deploy Convex Backend

```bash
# Ensure you are logged in to Convex
npx convex auth login

# Deploy backend
npx convex deploy --api-key=$CONVEX_DEPLOY_KEY
```

Note: `CONVEX_DEPLOY_KEY` must be set in the CI environment and local `.env`.

### Step 2: Build and Deploy Nuxt App

```bash
# Install deps
npm install

# Build for Cloudflare Workers
npm run build

# Deploy to Cloudflare Workers
npx wrangler deploy
```

## 9. Clerk Configuration

In the Clerk dashboard (`dashboard.clerk.com`):

1. **Organisation settings:**
   - Enable "Organizations" feature
   - Set "Maximum organisations per user" to 1
   - Invites: auto-expire after 7 days

2. **Email templates:**
   - Invite email template references `RESEND_FROM_EMAIL`
   - Customize invite email body to match Resend template

3. **Webhooks:**
   - Add webhook endpoint: `https://<convex-deployment>.convex.cloud/webhook/clerk`
   - Subscribe to: `organization.created`, `organization.deleted`, `user.created`, `user.updated`
   
   **HS-012 (signature verification):** The Convex webhook handler must call `verifyWebhook(payload, CLERK_WEBHOOK_SECRET)` from `@clerk/nuxt` before processing events. Unsigned or tampered payloads must be rejected with HTTP 401. Payload size must not exceed 1 MB.

## 10. Cloudflare Configuration

In `wrangler.toml`:

```toml
name = "happy-house-bills"
main = "dist/server/index.js"
account_id = "<CLOUDFLARE_ACCOUNT_ID>"
compatibility_date = "2024-01-01"
workers_dev = true

[vars]
NODE_VERSION = "20.x"

[triggers]
# Cron triggers (if any scheduled functions)
```

Domain route is configured as: `happy-house-bill.brettlockhart.com/*`
