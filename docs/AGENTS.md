# AGENTS.md — Happy House Bills

Guidance for AI agents (Kilo, Codex, etc.) and human contributors working on
Happy House Bills.

## 1. Workflow & Context Management

- **Unified task context:** all development, architectural planning, and code reviews happen within the same task instance to preserve full context. Do not open a new task to review work; review in the current task.
- **Self-correction:** when external feedback is received, fold the findings into the active todo list and apply fixes directly here.
- **Continuous integration:** treat every change as part of a CI flow. Verify with tests or manual checks before marking a task complete.
- **No task switching for reviews:** never start a new task for a code review.

### Spec Plan Summary Gate

Before writing any spec document, the agent must present a concise plan summary to the user
for explicit approval. The summary must include:

- Sections to be written (numbered list matching the spec template)
- Key decisions (Decision/Rationale table entries)
- Open questions to be registered

This gate prevents silent scope drift and ensures the user has reviewed the approach before
implementation effort is expended.

- The plan must include all required template sections: Purpose, Scope, Key Decisions, Open Questions, Cross-References, Implementation Dependencies. Missing sections will be caught by `docs-audit.ts` check #6.

### Spec Review Gate

After a domain spec is written to disk and `doc-lint.ts` passes, the agent should spawn a
spec-reviewer subagent (via the `task` tool, `explore` type) to review the spec against the
spec-writer template (sections 1–10) and the source documents it was grounded in. The reviewer
catches issues the automated checks cannot: incorrect section citations (e.g. `§7.3` when the
section has no subsections), inaccurate gap references, template compliance, and cross-reference
reciprocity.

**Security handoff.** If the spec introduces an unauthenticated ingress, a webhook, secrets
management, authentication or authorisation, entitlement enforcement, payment or billing
state, PII retention, or file/iframe/export handling, the spec review must hand off to
`security-engineer` before the spec is considered ratified. This is security-engineer trigger
4, and it is the only path to it — without this line the trigger is unreachable from the
spec-review workflow.

The handoff produces a **spec-level** review (§12), whose "Pass" means the security
requirements are *specified*, not implemented. Present that distinction rather than reporting
a bare "Pass".

### Doc Lifecycle Management

When a feature implementation slice is complete and merged, update the proposal document's lifecycle state before declaring work done. Move through folders **in order**: `01-draft` → `02-in-progress` → `03-ready-for-review` → `04-implemented`.

- Move the doc to `02-in-progress` before starting implementation (start-of-slice trigger). Once you begin writing code, move its doc and update frontmatter.
- Do not skip `03-ready-for-review` and jump straight to `04-implemented`. That folder is the mandatory checkpoint: code is complete, tests pass, and the proposal is awaiting review. Only promote to `04-implemented` after review is complete.
- Ask the user whether they want a code review before promoting to `03-ready-for-review`.
- Present the lifecycle report in chat so the user can see what changed.
- After `04-implemented`, update the priority table in `docs/2-development/README.md` if applicable.
- Run `npm run docs:lint` to verify consistency.

### Open Questions Maintenance

When writing or updating a spec that contains open questions:

1. Add each open question to the [Open Questions Register](../3-reference/spec-gaps.md#open-questions-register) with a unique ID, the source spec path, the feature that will resolve it, and the target phase.
2. When a question is resolved (because the relevant feature is implemented), strike through the row in the register (do not delete — keep the resolution trail) and update the source spec's open-questions section with the decision.

The register is scanned as part of the end-of-slice checklist, so questions surface at implementation time — not before.

### Ask Before Commit/Push

The agent must present changes and ask the user for approval before committing or pushing anything. Do not auto-commit implementation code; leave it in the working tree for the user to review first.

### Path Safety

Every filesystem operation uses `path.resolve` and validates the result is inside the project workspace via containment checks.

### Origin Validation

All network-facing services implement strict origin validation.

### Never Log Secrets

API keys, tokens, and credentials live in env vars; never `console.log` them, never send them to the client.

### Gate Classification & Enforcement

Every gate in this document falls into one of two categories:

#### Human Gates (Require Your Explicit Approval)
| Gate | Section | Why You Approve |
|------|---------|-----------------|
| Spec Plan Summary | §13-26 | You decide scope/approach before effort spent |
| Code Review Prompt | §47, §203 | You decide if review needed |
| Commit/Push | §61-63 | You own the repo; agent never pushes without request |
| Slice Promotion | Doc Lifecycle | You ship the product; "Pass" ≠ "ship it" |

#### Agent Guards (Self-Enforcement)
| Gate | Section | Purpose |
|------|---------|---------|
| Lifecycle Order | §43-46 | Prevents skipping `03-ready-for-review` |
| Start/End Checklists | §190-210 | Ensures baseline/verification not forgotten |
| Dependency Validation | `/slice-implement` | Prevents implementing before deps promote |
| Open Questions Register | §52-59 | Prevents silently dropping questions |
| Spec Review Gate | §28-39 | Catches spec issues agent can't see |

#### Bypass Rules (Explicit Opt-In Only)
| Gate | Bypass Flag | Allowed When | Logged |
|------|-------------|--------------|--------|
| Spec Plan Summary | `--no-plan` | Doc-only, typo, config change | ✅ Required |
| Spec Review | `--no-spec-review` | Non-spec docs (README, AGENTS.md) | ✅ Required |
| Code Review | `--no-review` | Trivial: <5 lines, no logic change | ✅ Required |
| Dependency Check | `--force` | Hotfix, revert, spike | ✅ Required |
| Review Report Check | `--force` (promote) | Emergency security fix | ✅ Required + audit |
| Checklists | `--skip-checks` | Throwaway spike only | ✅ Required |

**Bypass Principles:**
1. **Never default** — must be explicit flag
2. **Logged** — bypass recorded in slice doc with reason
3. **Auditable** — `docs-audit` flags bypassed slices
4. **Review later** — bypassed slices auto-queued for review next cycle

#### Hotfix Shortcut
`/slice-hotfix <slice-name> --type <security|config|doc|revert> --reason "<reason>"`
Bundles common bypasses for time-critical fixes. Records in hotfix audit log.

## 2. Project Layout

Single-project layout (not a monorepo):

- **`app/`** — Nuxt 4 application: pages, components, composables, utils, types
- **`convex/`** — Convex backend: `_generated/`, functions (queries, mutations, actions), `schema.ts`, `http.ts`
- **`assets/`** — SCSS variables, design tokens, images
- **`public/`** — Static assets (favicons, etc.)

### Backend Modules

- **`convex/functions/expenses.ts`** — Expense queries/mutations (create, list, approve, reject, balance)
- **`convex/functions/settlements.ts`** — Settlement queries/mutations
- **`convex/functions/orgs.ts`** — Organization onboarding
- **`convex/auth.ts`** — Clerk auth configuration for Convex
- **`convex/schema.ts`** — Database schema (expenses, settlements)

### Frontend Modules

- **`app/pages/`** — Route pages (index page with balance header + action buttons + entry list)
- **`app/components/`** — Reusable UI components (AddExpenseModal, SettleUpModal, ExpenseRow, etc.)
- **`app/composables/`** — Vue composables (`useExpenses`, `useBalance`, `useAuth`, `useOCR`)
- **`app/utils/`** — Utility functions (OCR parsing, duplicate detection, formatting)

## 3. Build, Test, and Lint Commands

Run commands from the repo root unless noted.

```pwsh
# Install (root)
npm install

# Dev (Nuxt + Convex local)
npm run dev           # Nuxt dev server at localhost:3000
npx convex dev        # Convex dev server with local deployment

# Build
npm run build         # Build Nuxt app for Cloudflare Workers

# Test
npm test              # Vitest — all test files
npm test -- --coverage  # With coverage report

# Lint
npm run lint          # ESLint — must be 0 problems
npm run lint:fix      # Auto-fix stylistic findings

# Typecheck
npx vue-tsc --noEmit  # Vue/Nuxt typecheck (includes .vue files)
npx tsc --noEmit -p convex  # Convex-specific typecheck

# Doc validation
npm run docs:lint     # doc-lint.ts — structural validation, runs as pre-commit hook
npm run docs:audit    # docs-audit.ts — quality audit (British English, cross-refs, etc.)

# Deploy
npx convex deploy     # Deploy Convex backend
npx wrangler deploy   # Deploy Nuxt app to Cloudflare Workers
```

### Git Hooks

Install local git hooks (pre-commit runs doc-lint automatically):

```pwsh
node docs/scripts/setup-hooks.js
```

Hooks run `doc-lint` before each commit. Bypass with `git commit --no-verify` when needed.

- **Run both lint tools before considering docs complete:**
- `npm run docs:lint` — structural validation, fast
- `npm run docs:audit` — quality audit, catches section completeness, British English, reciprocity, frontmatter

## 4. Code Style

- **TypeScript strict mode** is on in `nuxt.config.ts` and `convex.json`.
- **No comments in code** unless explicitly requested.
- Match the existing style of the file you are editing. Do not add semicolons where the file omits them; do not reformat surrounding code.
- Follow existing patterns: look at neighbouring files and imports before introducing a library. Never assume a well-known library is available — check `package.json`.
- Never commit secrets or keys; never log or expose them.
- **All documentation file names must be lowercase** (e.g. `primitive-design-guide.md`, not `PRIMITIVE_DESIGN_GUIDE.md`). This ensures cross-platform consistency and avoids case-sensitivity issues on Windows/Linux.

### Code Quality Rules

**Cognitive complexity (threshold 15):**
- Keep functions under 15 cognitive complexity. When a function exceeds it, extract branches, switch cases, or rule checks into named helper methods.
- A `switch` with many cases is a smell: extract each case body into a named method rather than leaving long case blocks.

**Cryptographic IDs:**
- Never use `Math.random()` for identifiers, tokens, or IDs. Use `crypto.randomUUID()` (available in Node 19+ and all modern browsers).

**Hash algorithms:**
- Do not use MD5 or SHA-1 for content hashing, even for non-security purposes. Use SHA-256.

**`@ts-ignore` / `@ts-expect-error`:**
- Never use bare `@ts-ignore`. Use `@ts-expect-error` with a description of at least 3 characters.
- If the suppression is no longer needed, remove it.

**Unused variables:**
- Prefix intentionally-unused callback parameters with `_`. Remove genuinely dead imports.
- For `catch` blocks with an unused error, use `catch {}` (optional catch binding) rather than `catch (e)` with `e` unused.

**`Function` type:**
- Never use the bare `Function` type for parameters or variables. Define the call signature explicitly (e.g. `(...args: any[]) => void`).

**`this` aliasing:**
- Do not assign `this` to a variable (`const self = this`). Use arrow functions or `.bind()` instead.

**`require()` imports:**
- Use ES module `import` syntax in all `.ts` files. The ESLint config disables this rule only for structurally required CommonJS files.

**Generated files:**
- Never edit generated/build output (`dist/`, `out/`, `.nuxt/`, `.output/`, `build/`). Fix the source that generates it.

## 5. Prose & Documentation

- **British English** in all prose/docs: colour, centre, behaviour, optimise, realise, standardise, organisation, grey, etc.
- **Do not alter code identifiers.** The audit excludes code blocks and backtick paths, so identifiers like `dark-color`, `align` stay intact.
- **British English is enforced by `npm run docs:audit` (check 3).**

### Docs Tier System

| Tier | Location | Audience | Update trigger |
|------|----------|----------|---------------|
| **T1 — Governance** | `docs/1-governance/` | Contributors, agents | Only when the rule itself changes |
| **T2 — Development** | `docs/2-development/` | Contributors, agents | At end of every slice |
| **T3 — Reference** | `docs/3-reference/` | Users, contributors | When described behaviour changes |
| **T4 — Archive** | `docs/4-archive/` | Historical context | When a feature/doc is superseded |

### Feature Doc Lifecycle

Each feature has **one doc** that moves through folders as it matures. Proposals must move through folders **in order**. `01-draft` → `02-in-progress` → `03-ready-for-review` → `04-implemented`.

After `04-implemented`, the doc either stays (implemented features) or moves to `docs/4-archive/` (superseded/obsolete).

### Start-of-Slice Checklist

- Proposal doc moved from `01-draft` → `02-in-progress`
- Proposal frontmatter updated: `status` + `lifecycle` → `02-in-progress`, `updated` → today
- Engine built if needed: `npm run build`
- Verification: tests, lint, typecheck

### End-of-Slice Checklist

- `npm run lint` — 0 problems
- `npm test` — all workspaces: 0 failures
- **`npx tsc --noEmit`** — clean (for touched workspaces)
- **`npx vue-tsc --noEmit`** — clean (for Nuxt app changes)
- **`npx convex deploy --check`** — clean (for Convex function changes)
- **Test coverage approval gate** — run `/run-agent test-engineer` after implementation; get user approval on the coverage report for all new/modified source files before promoting to `04-implemented`
- Ask the user whether they want a code review before committing
- Proposal moved to correct lifecycle folder in order
- Proposal frontmatter updated
- Lifecycle report appended to proposal doc
- Lifecycle report presented in chat
- `npm run docs:lint` — doc lifecycle and cross-references validated
- `npx tsx docs/scripts/docs-audit.ts` — full quality audit (0 warnings before merge)
- **Open questions resolved** — scan the [Open Questions Register](spec-gaps.md#open-questions-register); if this slice touches any open question, resolve it and update both the source spec and the register before marking the slice done

## 6. Git

- Only commit, amend, push, or open PRs when explicitly requested.
- Before committing: inspect `git status`, `git diff`, and recent `git log`; stage only intended files.
- Write a concise commit message matching the repo style. If a commit fails a hook, fix the issue and create a new commit — do not amend the failed one.
- **Code review queue:** substantial uncommitted or committed work should be tracked in `docs/2-development/supporting-docs/reviews/README.md`.

## 7. Documentation Structure

```
docs/
├── AGENTS.md              — Master rules for agents (this file)
├── 1-governance/          — Project governance
├── 2-development/
│   ├── README.md          — Development index (priority table)
│   ├── roadmap.md         — Implementation roadmap
│   ├── 00-research/       — Research and strategy docs
│   ├── 01-draft/          — Proposals not yet started
│   ├── 02-in-progress/    — Active implementation
│   ├── 03-ready-for-review/ — Code complete, awaiting review
│   ├── 04-implemented/    — Merged and shipped
│   └── supporting-docs/
│       ├── slices/        — Implementation plans
│       ├── reviews/       — Review queue and reports
│       │   └── archive/   — Archived review reports
│       ├── audits/        — Doc audit reports
│       └── security-reviews/ — Security review documents
├── 3-reference/
│   ├── project_brief.md   — Product brief, market position
│   ├── lexicon.md         — Terminology
│   ├── functional-domains.md — Domain registry
│   ├── spec-gaps.md       — Spec gap tracker + Open Questions Register
│   ├── user-flows.md      — Core user journey flows
│   ├── tech-specs/        — Engineering specs (backend, frontend, data model)
│   └── domains/           — Domain-specific specs (expenses, settlements, auth, etc.)
└── 4-archive/
    └── historical/        — Superseded docs
```

## 8. Dependency Updates

- **Never run `npm audit fix --force`.** It introduces breaking transitive upgrades.
- **Never bulk-update unrelated dependencies** in a single PR. Pick one dependency per PR.
- Runtime dependency bumps require the full test matrix to pass before merge.
- Dev-dependency bumps require lint + tests for the consuming workspace only.
- Major version bumps on runtime deps require a dedicated branch and explicit review of changelogs.
- After merging a dependency update, rebuild and redeploy affected services.

## 9. British English

All prose and documentation uses British English:
- colour (not color)
- centre (not center)
- behaviour (not behavior)
- optimise (not optimize)
- analyse (not analyze)
- realise (not realize)
- licence (noun), license (verb)
- grey (not gray)
- standardise (not standardize)

## 10. Documentation Quality Standards

### Path conventions

- **Paths in `docs/3-reference/` must be relative to the file's own directory.** Do not use `../../3-reference/` from within the `3-reference/` directory — it resolves to the same location but is fragile and confusing. Use `tech-specs/`, `domains/`, or `./` directly.
- **All backtick path references must use the actual lowercase filename** (e.g. `` `tech-specs/backend/api-contract.md` ``, not `` `APIContract.md` ``). Filenames must be lowercase with hyphens per the AGENTS.md filename rule.
- **Backtick paths that reference plans or external tooling** (glob patterns like `` `docs/**/*.md` ``, paths outside `docs/` like `` `.kilo/agent/spec-writer.md` ``) are not real doc links and should not appear in backtick-enclosed `.md` references. Use plain quotes or code spans without the `.md` suffix if they must be mentioned in prose.

## 11. Kilo Commands & Agents

| Task | Command |
|------|---------|
| Start slice implementation | `/slice-implement <slice-name>` |
| Run pre-flight baseline | `/slice-preflight <slice-name>` |
| Run code review | `/slice-review <slice-name>` |
| Review a spec or slice proposal (any lifecycle, including `01-draft`) | `/spec-review <name-or-path>` |
| Promote to implemented | `/slice-promote <slice-name>` |
| Check slice status | `/slice-status` |
| Run security review | `/run-agent security-engineer` |
| Run test engineer | `/run-agent test-engineer` |

> `/slice-review` requires an implementation. Its lifecycle guard stops the command when
> the slice is not in `02-in-progress` or `03-ready-for-review`, because steps 3–5 all need
> code to inspect. To review a `01-draft` proposal before implementing it, use `/spec-review`
> — it runs the `spec-reviewer` agent, which checks template compliance, decision tables,
> cross-references, unregistered open questions and factual conflicts with other docs, and
> applies the security trigger checklist.

Agents available in `.kilo/agent/`:
- `slice-implementer` — full slice implementation
- `implementation-reviewer` — review gate coordination
- `frontend-engineer`, `backend-engineer`, `security-engineer`, `test-engineer` — specialised reviews

Load specialised skills with `skill` tool if needed (e.g. `clerk-setup`, `clerk-testing`, `clerk-webhooks`).

### run-agent Command

Execute any agent defined in `.kilo/agent/` by name:

```bash
/run-agent security-engineer              # Local session
/run-agent security-engineer --worktree   # Isolated git worktree
/run-agent test-engineer --prompt "Write tests for export API"
```

The command reads `.kilo/agent/<name>.md`, launches via Agent Manager, and passes the agent's default prompt (or custom `--prompt`).

## 12. Security Review Process

### Living Document Security Reviews

A **single-artifact** security review — one spec, one slice, one feature — is a single file:

```
docs/2-development/supporting-docs/reviews/<name>-security-review.md
```

A review that needs **multiple living artifacts** (a batch audit, or anything requiring a
separate threat model, dependency scan, compliance note, and test results that each evolve
independently) uses the directory structure:

```
docs/2-development/supporting-docs/security-reviews/<review-name>/
├── review-index.md              ← Master index (entry point)
├── <review-name>-security-review.md
├── threat-models/
│   └── <review-name>-threat-model.md
├── scans/
│   └── <review-name>-dependency-scan.md
├── compliance/
│   └── <review-name>-compliance.md
├── tests/
│   └── <review-name>-tests.md
└── continuation.md              ← Handoff for next agent (lowercase)
```

Choose by artifact count, not by importance. Each artifact is a **living document** — update
in place as work progresses. In the directory form, `review-index.md` is the single source of
truth linking all artifacts.

### Spec-Level Security Reviews

A `spec-review` may hand off to the security-engineer (trigger 4) **before any code exists**.
This is a distinct review type, and the structure above applies only to its single-artifact
form. There is no dependency scan, no `SEC-` test file, and no worktree.

| | Spec-level review | Slice-level review |
|---|---|---|
| Code exists | No | Yes |
| Dependency scan | N/A | Required |
| Security tests | Deferred to implementation | Required, `SEC-` IDs |
| Output location | `supporting-docs/reviews/<spec-name>-security-review.md` | `reviews/` or `security-reviews/<review-name>/` |
| Template | `.kilo/templates/security-review.md` | `.kilo/templates/security-review.md` |
| **"Complete"** means | Required properties are **specified** | Properties are **implemented and tested** |

That last row is the one that gets misread. A **Pass at spec level means the requirements are
written down, not that the feature is secure.** Every control is specified but unproven, and
a code-level review remains mandatory before release. Any property table a spec-level review
produces should gain a `SEC-` test per property at slice time.

Mark N/A items as **N/A rather than Pass** when no implementation exists to assess. A ticked
control nobody examined is a false assurance.

### Remediation Verification

When re-running a review after fixes:

1. **Verify closure by inspecting the current files.** Never accept the remediation note,
   the changelog, or a summary of what was changed as evidence that a finding is closed.
2. **Re-review for defects the remediation introduced.** Fixes routinely create new gaps.
   A hardening change on one axis can expose a missing path on another.
3. **Never self-certify.** The agent that applies a fix does not mark it closed. A separate
   re-review pass does, from inspection.
4. **Re-check invariants the automated validators do not cover.** `doc-lint.ts` and
   `docs-audit.ts` both pass on: a table with a misplaced separator row, a duplicated `### N.M`
   heading, and missing domain-to-domain back-references. `docs-audit.ts` check 9 inspects
   **tech-spec pairs only**, at info level, so it cannot see a domain spec citing a sibling
   domain spec with no reverse reference. Detect these with scripted checks — duplicate
   heading scan, table shape inspection, explicit reciprocity query — or by reading the diff
   back. Never treat a green validator run as proof that structure is intact.

### Security Review Templates

Templates live in two places. The flat form is used for single-artifact reviews; the
directory holds the supporting artifacts for multi-artifact reviews.

| Template | Location | Purpose |
|----------|----------|---------|
| Main review | `.kilo/templates/security-review.md` | OWASP Top 10, checklist, findings — **single-artifact and spec-level reviews** |
| Review index | `.kilo/templates/security/review-index.md` | Master index linking all artifacts |
| Threat model | `.kilo/templates/security/threat-model.md` | STRIDE analysis + attack trees |
| Dependency scan | `.kilo/templates/security/dependency-scan.md` | npm audit + SBOM + supply chain risk |
| Compliance validation | `.kilo/templates/security/compliance-validation.md` | GDPR/CCPA + security-arch alignment |
| Test results | `.kilo/templates/security/test-results.md` | Test execution tracking |
| Continuation | `.kilo/templates/security/continuation.md` | Handoff guide for next agent |

### Review Workflow

1. **Launch** security-engineer via `/run-agent security-engineer --worktree`
2. **Agent creates** test files documenting vulnerabilities (SEC-XXX)
3. **Implement fixes** in main repo
4. **Copy tests** from worktree to main repo
5. **Verify** all tests pass (`npm test`)
6. **Populate** the living documents in the location chosen above
7. **Update** `continuation.md` (directory form only) for next agent handoff

### Finding ID Convention

| Type | Prefix | Example |
|------|--------|---------|
| Security finding | `SEC-` | `SEC-001` = missing auth on export |
| Threat model | `T` | `T4` = privilege escalation |
| Test case | `ST-` | `ST-001` = export auth test |
| Compliance | `C` | `C1` = lawful basis gap |

### Agent Specialisation

| Agent | Focus | Trigger |
|-------|-------|---------|
| `security-engineer` | Threat modeling, code review, CSP/iframe, secrets, deps, compliance | Phase 1 slice ready, auth/billing/iframe/export changes, npm audit > moderate, spec review gaps |
| `test-engineer` | Vitest unit/integration, coverage | Spec/plan written, implementation complete, test gaps identified |

### Security Test Pattern

New security tests follow this pattern:

```typescript
// SEC-XXX: Finding description
it('REQUIRES <security control> — <expected behaviour> (SEC-XXX)', async () => {
  // Arrange: vulnerable state
  // Act: trigger vulnerability
  // Assert: control blocks it
})
```

Test files are named `<feature>.security.test.ts` or `<feature>-<control>.test.ts` and placed in `__tests__/` alongside existing tests.

### spec-gaps.md §1 maintenance

- **When a referenced document listed in §1 "Missing Referenced Documents" is created**, immediately strikethrough the row (`~~...~~`) and remove it from the "missing" count. The gap count summary in the Appendix must reflect the actual number of unresolved entries. The `checkGapCountAccuracy` and `check8StaleSpecGapsEntries` checks enforce this — do not leave §1 entries as "missing" after the file exists.

### Tech-spec frontmatter

- **Every tech-spec must include YAML frontmatter** at the top of the file with these fields: `status`, `package`, `priority`, `created`, `updated`, `tags`. This enables AI agents to filter and prioritise docs. The `check10FrontmatterCompleteness` check enforces this. Use inline array format for `tags` (e.g. `tags: [engine, html, css]`).
- The frontmatter `status` field should match the status in the tech-specs status table (`README.md`). If the table says "Complete" but the file says "Draft", update the file.

### Cross-reference quality

- **Cross-references in tech-specs must use explicit backtick paths**, not vague prose like "see open question AN-Q2" or "see Licence package". The `check11VagueCrossReferences` check flags these. Use `` `spec-gaps.md` `` or `` `tech-specs/shared/shared-features.md` `` instead.
- Lines containing backtick paths are exempt from the vague-reference check — adding a backtick path to the line resolves the finding.
- **Cross-references must be reciprocal.** When adding a reference to another tech-spec in your cross-references table, you must also add a back-reference in that target spec's cross-references table (unless the relationship is intentionally one-way, e.g. a domain spec referencing a tech-spec). The `docs-audit.ts` check #9 enforces this.
- **Section citations (§) must be accurate.** When referencing a specific section of another document (e.g. `icon-set.md §12`), verify the section number matches the current document structure. Use the heading text, not a stale number.
- **Avoid vague gap references.** Do not write `see spec-gaps.md §7` — §7 is too broad. Instead reference the specific gap by its ID or title (e.g. `spec-gaps.md gap "CSP for exported HTML" in §2.4`).

### Section heading formatting

- Section headings must use `## N. Title` format with **no leading/trailing whitespace**. The `docs-audit.ts` check #6 uses regex `^##\s+\d+\.\s+Title` — a leading space (e.g. ` ## 12. Open Questions`) will cause a false "missing section" warning.

### Audit tools

- **`doc-lint.ts`** (commit-time, fast): structural checks — cross-references, stale forward refs, status table, duplicate IDs, gap counts, open-questions sync, frontmatter lifecycle, review queue. Runs as a git pre-commit hook.
- **`docs-audit.ts`** (occasional, quality-focused): broader checks — backtick path resolution, date format, British English, orphaned docs, filename conventions, spec section completeness, empty sections, stale §1 entries, cross-reference reciprocity, AI frontmatter, vague refs, decision tables, code blocks. Run manually: `npx tsx docs/scripts/docs-audit.ts`.
