# Process Guide: Agent Instructions Template (AIT)

A human-readable walkthrough of the complete development process. This guide explains
**why** each step exists and **how** the gates work together — not just what to do.

## Table of Contents

1. [The Slice System](#1-the-slice-system)
2. [Spec Plan Summary Gate](#2-spec-plan-summary-gate)
3. [Writing Specs](#3-writing-specs)
4. [Spec Review Gate](#4-spec-review-gate)
5. [Implementation Lifecycle](#5-implementation-lifecycle)
6. [Implementation Review Gate](#6-implementation-review-gate)
7. [Test Coverage Approval](#7-test-coverage-approval)
8. [Security Review](#8-security-review)
9. [Slice Promotion](#9-slice-promotion)
10. [Documentation Validation](#10-documentation-validation)
11. [Open Questions Management](#11-open-questions-management)

---

## 1. The Slice System

Features are broken into **slices** — small, self-contained implementation units that
follow a standard lifecycle. Each slice is a single git branch, a single doc, and a
single promotion cycle.

A slice typically covers one discrete piece of functionality:
- One API endpoint
- One component or composable
- One UX interaction
- One security control

Slices are numbered sequentially (slice-1, slice-2, ...) regardless of phase.

---

## 2. Spec Plan Summary Gate

**Before writing any spec document**, present a plan summary to the user:

- Sections to be written (matching the template)
- Key decisions (Decision + Rationale table entries)
- Open questions to be registered

This gate prevents silent scope drift and ensures the user has reviewed the approach
before implementation effort is expended.

**Template sections required:**
1. Purpose
2. Scope (in/out)
3. Acceptance Criteria
4. Key Decisions (Decision/Rationale table)
5. Implementation Dependencies
6. Open Questions
7. Test Strategy
8. Risks & Mitigations
9. Cross-References
10. Security Review (with trigger checklist)

---

## 3. Writing Specs

Place draft specs in `docs/2-development/01-draft/`. Use the template at
`docs-system/templates/draft-proposal.md`.

**Frontmatter fields required:**
```yaml
status: Draft
lifecycle: 01-draft
phase: phase-X
slice: N
created: YYYY-MM-DD
updated: YYYY-MM-DD
depends_on: [slice-name]
blocks: []
tags: [tag1, tag2]
```

**Key requirements:**
- British English in all prose (colour, centre, behaviour, etc.)
- All backtick path references must resolve to actual files
- Every tech-spec must have AI-consumable frontmatter (status, package, priority, created, updated, tags)
- Decision tables must have "Decision" and "Rationale" columns

---

## 4. Spec Review Gate

After writing a spec:

1. Run `npx tsx docs/scripts/doc-lint.ts` — must pass
2. Spawn `spec-reviewer` agent via `task` tool to review template compliance
3. If security triggers match, hand off to `security-engineer` for spec-level review

**Spec-level security review** is different from code-level:
- **Spec-level Pass** = requirements are *specified*, not implemented
- Mark N/A items as **N/A** (not Pass) — no implementation to assess
- Produce: store inventory, retention/basis per store, egress paths, authz per operation

---

## 5. Implementation Lifecycle

### Moving through lifecycle folders:

1. **`01-draft`** → Start writing spec here. Move to `02-in-progress` before implementation begins.
2. **`02-in-progress`** — Actively writing code. Update frontmatter: `status: In Progress`, `updated: today`.
3. **`03-ready-for-review`** — Code complete, all tests pass. This is the mandatory checkpoint.
4. **`04-implemented`** — After review passes. Update roadmap and priority tables.

**Never skip `03-ready-for-review`.** Jumping straight to `04-implemented` violates the
lifecycle order guard.

**All 5 folders must always exist** (use `.gitkeep` to preserve them when empty).

### End-of-slice checklist (before promoting to `04-implemented`):

- [ ] `npm run lint` — 0 problems
- [ ] `npm test` — all workspaces: 0 failures
- [ ] `npx tsc --noEmit` — clean for touched workspaces
- [ ] Test coverage approval — run test-engineer agent; get user approval
- [ ] Proposal moved to correct lifecycle folder in order
- [ ] Proposal frontmatter updated
- [ ] Lifecycle report appended to proposal doc
- [ ] `npm run docs:lint` — doc lifecycle and cross-references validated
- [ ] `npx tsx docs/scripts/docs-audit.ts` — full quality audit (0 warnings before merge)
- [ ] Open questions resolved — scan the register; resolve any touched questions

---

## 6. Implementation Review Gate

Run the `implementation-reviewer` agent (via `task` tool) when implementation is complete.

The reviewer:
1. Reads the slice spec
2. Reads all new/modified files
3. Runs verification checks (lint, tests, typecheck)
4. Delegates to specialised agents based on file types:
   - `.vue`, `composables/**` → **frontend-engineer**
   - `engine/**`, `convex/**`, `api/**` → **backend-engineer**
   - `LivePreview.vue`, `preview/**`, `iframe/**` → **security-engineer**
   - Test files → **test-engineer**
5. Synthesises findings into a review report
6. Presents verdict: **Pass / Needs revision / Blocked**

Place the review report at `docs/2-development/supporting-docs/reviews/<slice-name>-review.md`.

---

## 7. Test Coverage Approval

Run the `test-engineer` agent after implementation:

- **100% coverage** on new source files (statements, branches, functions, lines)
- **Full coverage** on all new lines in modified files
- Edge cases: empty inputs, guard clauses, error paths, keyboard interactions

The test engineer presents a coverage report. **User must approve** before promoting
to `04-implemented`.

---

## 8. Security Review

### When to trigger:

1. Phase 1 slice ready for review touching security-sensitive areas
2. Auth, billing, webhook, iframe, export, or file upload changes
3. Dependency updates triggering `npm audit` above `moderate`
4. Spec review identifies security gaps
5. Incident response
6. Spec-level review (trigger 4 from spec-reviewer)

### Security-sensitive areas (always review):
- Clerk auth integration
- Stripe webhooks
- Convex functions
- Preview iframe
- Engine output (HTML/CSS)
- File/SVG upload
- Export pipeline
- API contracts
- Secrets management

### Spec-level vs Code-level:

| | Spec-level | Code review |
|---|---|---|
| Code exists | No | Yes |
| Dependency scan | N/A | Required |
| Security tests | Deferred to implementation | Required, `SEC-` IDs |
| Threat model | Assets, stores, trust boundaries | Full STRIDE with attack trees |
| "Complete" means | Requirements are **specified** | Properties are **implemented and tested** |

### Re-review discipline:
1. Verify closure by inspecting current files (never accept remediation notes)
2. Check for defects introduced by fixes (fixes create new gaps)
3. Never self-certify — the agent that applies a fix does not mark it closed
4. Re-check invariants automated validators don't cover

---

## 9. Slice Promotion

Promotion is a **human gate** — the user must approve.

When review verdict is Pass:

1. Run `/slice-promote <slice-name>` to advance lifecycle
2. Verify roadmap milestone updated in `docs/2-development/roadmap.md`
3. Verify priority table updated in `docs/2-development/README.md` (if applicable)
4. Archive review report to `docs/2-development/supporting-docs/reviews/archive/` (optional)

**Bypass rules** (explicit opt-in only):
- Spec Plan Summary: `--no-plan` (for doc-only, typo, config changes)
- Spec Review: `--no-spec-review` (for non-spec docs)
- Code Review: `--no-review` (for <5 line trivial changes)
- Dependency Check: `--force` (for hotfixes)
- Review Report Check: `--force` (for emergency security fixes)

All bypasses must be **logged** in the slice doc with reason and are **auditable** —
`docs-audit` flags bypassed slices.

---

## 10. Documentation Validation

### doc-lint.ts (commit-time, fast)
- Cross-reference resolution
- Stale forward references
- Status table consistency
- Duplicate IDs
- Gap count accuracy
- Open-questions sync
- Frontmatter lifecycle
- Review queue status

Runs as a git pre-commit hook (install with `node docs/scripts/setup-hooks.js`).

### docs-audit.ts (occasional, quality-focused)
- Backtick path resolution (must resolve to real files)
- British English enforcement (check #3)
- Orphaned docs detection
- Filename conventions (lowercase)
- Spec section completeness
- Empty sections (check #6)
- Cross-reference reciprocity (check #9 — info level, tech-spec pairs only)
- AI frontmatter completeness (check #10)
- Vague cross-references (check #11)
- Decision table completeness (check #12)
- Code block presence (check #13)
- Cross-project contamination (check #14)

Run: `npx tsx docs/scripts/docs-audit.ts`

---

## 11. Open Questions Management

1. Add each open question to `spec-gaps.md` §Open Questions Register with:
   - Unique ID
   - Source spec path
   - Feature that will resolve it
   - Target phase

2. When resolved (feature implemented):
   - Strike through the row (don't delete — keep the resolution trail)
   - Update the source spec's open-questions section with the decision

3. Before starting any implementation slice:
   - Scan the register for questions the slice would touch
   - Resolve them before the slice is marked done

---

## Handoff Options

When any review is complete, present these options to the user:

| Option | Trigger | Next Action |
|--------|---------|-------------|
| Fix and re-review | Verdict = Needs revision | Fix issues, re-invoke the same reviewer |
| Promote to implemented | Verdict = Pass | Update lifecycle doc + roadmap |
| Security deep-dive | Security issues found | Invoke security-engineer |
| Test improvement | Test gaps found | Invoke test-engineer |
