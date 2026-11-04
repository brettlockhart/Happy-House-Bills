---
status: Draft
package: project
priority: high
created: 25-October-2026
updated: 25-October-2026
tags: [architecture, scaffolding, setup, nuxt, convex, clerk, cloudflare]
---

# Tech Spec: Project Scaffolding

**Date:** 25-October-2026
**Status:** Draft
**Audience:** All engineers

## 1. Purpose

Define the project structure, build configuration, and development environment for Happy House Bills. This spec ensures every contributor — human or AI agent — can clone the repository, start the dev servers, run lint and typecheck, build for production, and deploy to Cloudflare Workers + Convex with a single set of commands.

## 2. Scope

### In scope

- Directory layout: `app/` (Nuxt), `convex/` (backend), `assets/`, `public/`, `docs/`, `.kilo/`
- `nuxt.config.ts` — Nuxt 4 configuration, Nitro preset, Clerk module
- `convex.json` — Convex project configuration, environment variables
- `wrangler.toml` — Cloudflare Worker binding configuration
- `.env.example` — complete environment variable map with descriptions
- Root `package.json` scripts: dev, build, lint, typecheck, test
- `AGENTS.md` integration — coding rules, doc lifecycle, security gates
- Git hooks: pre-commit runs `doc-lint`, optional commit-msg

### Out of scope

- Individual dependency version pinning (tracked in `package.json`)
- Cloud account provisioning (AWS, Cloudflare, Clerk — handled manually)
- CI/CD pipeline definition (covered by `tech-specs/architecture/ci-cd.md`)
- Production deployment steps (covered by `tech-specs/architecture/deployment.md`)

## 3. Key Decisions

| ID | Decision | Rationale | Source |
|----|----------|-----------|--------|
| D1 | Single repository (not monorepo) | v1 is small; monorepo overhead is unjustified at this scale | `project_brief.md` (## 1. Purpose) |
| D2 | Nuxt 4 with `cloudflare_module` Nitro preset | Cloudflare Workers is the cheapest production host for a free-tier app | `project_brief.md` (## 2. Tech Stack) |
| D3 | Convex for backend (separate deployment) | Convex handles real-time subscriptions and auth integration natively | `project_brief.md` (## 2. Tech Stack) |
| D4 | Git hooks installed via `docs/scripts/setup-hooks.js` | Pre-commit `doc-lint` catches structural doc issues before merge | `docs/AGENTS.md` (## Doc Lifecycle Management) |
| D5 | Environment variables documented in `.env.example`, never committed | All 11 required env vars are listed with descriptions and example values |  |

## 4. Open Questions

| ID | Question | Status | Notes |
|----|----------|--------|-------|
| (none) | — | — | — |

## 5. Cross-References

- `convex/schema.ts` — schema lives in `convex/` directory
- `nuxt.config.ts` — Nuxt config at repo root
- `convex.json` — Convex config at repo root
- `wrangler.toml` — Cloudflare Worker config at repo root
- `tech-specs/architecture/ci-cd.md` — GitHub Actions workflow
- `tech-specs/architecture/deployment.md` — manual deploy steps
- `spec-gaps.md` — gap tracking

## 6. Implementation Dependencies

- **Depends on:** None (foundational)
- **Blocks:** All other tech-specs and domain specs
- **Consumer integration:** Every `npm run` script, every `/slice-*` command, every agent prompt references this structure

## 7. Directory Layout

```
happy-house-bills/
├── app/
│   ├── components/     Vue components (HhbButton, AddExpenseModal, etc.)
│   ├── composables/    Vue composables (useExpenses, useBalance, useAuth, useOCR)
│   ├── pages/          Route pages (index page with balance + entry list)
│   ├── utils/          Utility functions (OCR parsing, duplicate detection, formatting)
│   └── assets/         SCSS variables, design tokens, images
├── convex/
│   ├── _generated/     Convex-generated API client (auto-generated)
│   ├── functions/      Convex functions (expenses.ts, settlements.ts, orgs.ts)
│   ├── schema.ts       Database schema
│   └── http.ts         HTTP endpoints (webhooks if needed)
├── public/             Static assets (favicons, etc.)
├── docs/               Documentation (4-tier structure)
├── .kilo/              Kilo agent/command configuration
├── convex.json         Convex project config
├── nuxt.config.ts      Nuxt config
├── wrangler.toml       Cloudflare Worker config
├── package.json
├── tsconfig.json
└── .env.example
```

## 8. Build & Dev Commands

All commands run from the repository root:

```bash
# Install dependencies
npm install

# Development (two terminals)
npm run dev           # Nuxt dev server at localhost:3000
npx convex dev        # Convex local deployment + dev server

# Build for production
npm run build         # Builds Nuxt app for Cloudflare Workers

# Lint & typecheck
npm run lint          # ESLint — must be 0 problems
npx tsc --noEmit      # TypeScript typecheck
npx vue-tsc --noEmit  # Vue/Nuxt typecheck

# Test
npm test              # Vitest
npm test -- --coverage  # With coverage

# Docs
npm run docs:lint     # doc-lint.ts (pre-commit hook)
npm run docs:audit    # docs-audit.ts

# Deploy
npx convex deploy     # Deploy Convex backend
npx wrangler deploy   # Deploy Nuxt app to Cloudflare Workers
```

## 9. Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `NUXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Yes | Clerk frontend publishable key |
| `NUXT_CLERK_SECRET_KEY` | Yes | Clerk backend secret key |
| `CLERK_WEBHOOK_SECRET` | Yes | For webhook signature verification |
| `CONVEX_URL` | Yes | Convex deployment URL |
| `CONVEX_DEPLOY_KEY` | Yes | Token for `npx convex deploy` |
| `RESEND_API_KEY` | Yes | Resend email API key |
| `RESEND_FROM_EMAIL` | Yes | Verified sender email address |
| `CLOUDFLARE_API_TOKEN` | Yes | For `npx wrangler deploy` |
| `CLOUDFLARE_ACCOUNT_ID` | Yes | Cloudflare account ID |
| `CLOUDFLARE_PROJECT_NAME` | Yes | Cloudflare Workers project name |
| `CONVEX_DEPLOY_HOOK` | Optional | Webhook for post-deploy notifications |

## 10. Git Hooks

Installed via:

```bash
node docs/scripts/setup-hooks.js
```

| Hook | Command | Purpose |
|------|---------|---------|
| `pre-commit` | `npx tsx docs/scripts/doc-lint.ts` | Structural doc validation before every commit |
| `pre-push` | (none by default) | Can be added for lint + typecheck in CI |
