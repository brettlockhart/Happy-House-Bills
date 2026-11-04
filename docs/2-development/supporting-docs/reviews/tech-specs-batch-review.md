# Spec Review: Tech-Specs Batch Review

**Date:** 25-October-2026
**Prepared by:** Spec Reviewer (batch analysis)
**Source documents reviewed:** `docs/AGENTS.md`, `docs/3-reference/tech-specs/README.md`, `docs/3-reference/project_brief.md`, `docs/3-reference/user-flows.md`, `docs/3-reference/lexicon.md`, `docs/3-reference/spec-gaps.md`

## Executive Summary

| Spec | Verdict | Blocking Issues | Security Handoff? |
|------|---------|-----------------|-------------------|
| `project-scaffolding.md` | **Pass** | 1 (typo) | No |
| `file-storage.md` | **Pass** | 3 | **Yes** — file/image upload |
| `duplicate-detection.md` | **Pass** | 2 | No |
| `ocr-pipeline.md` | **Pass** | 3 | **Yes** — third-party code/content |
| `email-notifications.md` | **Pass** | 3 | No |
| `mobile-compat.md` | **Pass** | 5 | No |
| `ci-cd.md` | **Pass** | 2 | No |
| `deployment.md` | **Pass** | 4 | **Yes** — auth + webhook |

**3 of 8 specs require a security-engineer handoff before ratification.**

## Security Handoff Summary

| Spec | Security triggers matched |
|------|--------------------------|
| `file-storage.md` | File or image upload — owns receipt image upload pipeline to R2 |
| `ocr-pipeline.md` | Third-party or user-supplied code/content — Tesseract.js via CDN worker |
| `deployment.md` | Authentication/authorisation/session handling + Webhook ingress/signature verification |

Per `docs/AGENTS.md` §12`, these 3 specs require a spec-level security review by `security-engineer` before ratification. A spec-level Pass means security requirements are *specified*, not implemented.

## Findings

### Template Compliance
- All 8 specs pass: 6 required sections present (Purpose, Scope, Key Decisions, Open Questions, Cross-References, Implementation Dependencies)
- All have decision tables with ID/Decision/Rationale/Source columns
- All have at least 1 code example
- All have complete YAML frontmatter (6/6 fields)
- No empty sections

### § Citation Accuracy Errors (26 invalid/inaccurate citations)
**`project_brief.md`** has no numbered sections — all `§NN` references to it are invalid:
- Affected specs: project-scaffolding (D1–D3: §16, §26, §27), file-storage (D1, D3, D5: §29, §113, §48), duplicate-detection (D1: §125), ocr-pipeline (D1, D2, D7: §31, §48, §9), email-notifications (D1, D6: §30), mobile-compat (D2, D5: §58, §59), ci-cd (D1, D5, D6: §59), deployment (D6: §29)

**`user_flows.md`** has sections §1–§5 — 5 citations point to the wrong section:
- duplicate-detection D5 (`user_flows.md §8` — doesn't exist; should be §2)
- ocr-pipeline D4 (`user_flows.md §3` — should be §2 for OCR/start extraction)
- ocr-pipeline D6 (`user_flows.md §3` — should be §2 for date extraction)
- email-notifications D4 (`user_flows.md §4` — should be §2 for expense notification)
- mobile-compat D6 (`user_flows.md §3` — should be §2 for camera capture)

**`docs/AGENTS.md`** — 3 citations point to wrong sections:
- file-storage D4 (`AGENTS.md §4 (path safety)` — path safety is in §1, not §4)
- mobile-compat D7 (`AGENTS.md §4 (motion rule)` — motion rule is in `ui-spec.md §13`, not AGENTS.md §4)
- deployment D5 (`AGENTS.md §8 (dependency updates)` — rollback not documented in §8)

### Reciprocity Gaps (info-level, 4 found)
1. `api-contract.md` does not reference `ocr-pipeline.md` (ocr-pipeline depends on api-contract)
2. `deployment.md` does not reference `email-notifications.md` (shared env vars RESEND_API_KEY)
3. `ui-spec.md` does not reference `mobile-compat.md` (mobile-compat defers to ui-spec D4/D5)
4. `api-contract.md` does not reference `ci-cd.md` (ci-cd references api-contract)

### Factual Errors / Typos
1. `project-scaffolding.md` §7: `nuxi.config.ts` → should be `nuxt.config.ts` (file exists as nuxt.config.ts)
2. `deployment.md` §8: `redploy` → should be `redeploy` (appears twice)

### Env Var Naming Inconsistency
- `project-scaffolding.md` §9 uses `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` (Next.js convention)
- `deployment.md` §7 uses `NUXT_PUBLIC_CLERK_PUBLISHABLE_KEY` (Nuxt convention)
- `nuxt.config.ts` line 12 uses `NUXT_PUBLIC_CLERK_PUBLISHABLE_KEY` — Nuxt convention is correct

## Sibling Spec Overlap
No ownership overlap between specs. Each correctly defers to siblings in §2 Out of scope. The only overlap is env var duplication between project-scaffolding.md and deployment.md (project-scaffolding uses wrong prefix).

## Automated Validator Status
- docs-audit.ts: **Pass** (0 errors; 4 info-level reciprocity gaps)
- doc-lint.ts: **Pass** (0 errors; 1 info warning about spec-gaps.md §7 gap count needing update)
- British English: **Pass** (0 American spellings in prose)
- Cross-project contamination: **Pass** (no Tailwind, Supabase, WASM/Rust, etc.)
