# Slice Review Command

Run a code review for a completed slice using the implementation-reviewer agent.

## Usage
```
/slice-review <slice-name> [--no-spec-review] [--no-review]
```

## Options
- `--no-spec-review` — Skip spec-reviewer agent (non-spec docs, README, AGENTS.md)
- `--no-review` — Skip code review entirely (trivial: <5 lines, no logic change)

## Templates

- Implementation review: `.kilo/templates/review-report.md` → saved to `docs/2-development/supporting-docs/reviews/<slice-name>-review.md`
- Spec review: `.kilo/templates/spec-review-report.md` → saved to `docs/2-development/supporting-docs/reviews/<slice-name>-spec-review.md`
- Security review: `.kilo/templates/security-review.md` → saved to `docs/2-development/supporting-docs/reviews/<slice-name>-security-review.md`
- Test strategy: `.kilo/templates/test-strategy.md` → saved to `docs/2-development/supporting-docs/slices/<slice-name>-test-strategy.md`

**Review produces a report with findings and user-facing handoff options** (fix/review, promote, security deep-dive, test improvement).

## Workflow
0. **Lifecycle guard** (fail fast — run before anything else):
   - Locate the slice doc and read its `lifecycle` frontmatter field.
   - If the slice is **not** in `02-in-progress` or `03-ready-for-review`, **stop** and report the actual lifecycle. Do not run any further stage.
   - `01-draft` → the slice has no implementation, so there is no diff and no code for `implementation-reviewer` to inspect. Point the user at `/spec-review <slice-name>` for reviewing the proposal itself, or `/slice-implement <slice-name>` to write the code first.
   - `04-implemented` → the slice is already promoted. Point the user at `/slice-demote <slice-name>` if it needs re-review, or at the existing review report.
   - Rationale: steps 3–5 all require an implementation. Running them against a draft produces a partial review that looks complete and reports findings against code that does not exist.
1. **Pre-flight checks** (fail fast):
   - `npm run lint --workspace=<affected-packages>` — must be 0 errors
   - `npm run typecheck --workspace=<affected-packages>` — must pass
   - `npm run test --workspace=<affected-packages>` — all passing
   - If these fail on inherited debt rather than on the slice's own changes, do not silently continue. Report the baseline figures and ask whether to apply the delta-based criterion used by previous slices, or to log a bypass.
2. **Spec review gate** (unless `--no-spec-review`):
   - Spawns spec-reviewer subagent for spec changes
   - Checks template compliance, cross-references, gap references
3. Reads the slice spec from `docs/2-development/03-ready-for-review/`
4. Runs verification checks (lint, test, typecheck)
5. **Code review** (unless `--no-review`):
   - Invokes implementation-reviewer to coordinate specialised reviews
6. Saves the completed implementation review to `docs/2-development/supporting-docs/reviews/<slice-name>-review.md`.
7. Presents the report's findings and handoff options to the user; do not promote without explicit user approval.

**Do not produce a `<slice-name>-review.md` when stages 3–5 could not run.** A review report for a feature with no implementation misrepresents unwritten code as reviewed. Record the gate results and the reason in the response instead.

## Bypass Rules
| Flag | Gate Skipped | Allowed When | Logged In Slice Doc |
|------|--------------|--------------|---------------------|
| `--no-spec-review` | Spec reviewer agent | Non-spec docs (README, AGENTS.md, guides) | ✅ Required |
| `--no-review` | Code review | Trivial: <5 lines, no logic change, typo fix | ✅ Required |

## Specialised Agent Delegation
Auto-spawned based on changed files:
- `**/LivePreview.vue`, `**/preview/**`, `**/iframe/**` → security-engineer
- `**/*.vue`, `**/composables/**` → frontend-engineer
- `**/engine/**`, `**/convex/**`, `**/api/**` → backend-engineer
- Test files or feature slices → test-engineer

## Examples
```
/slice-review slice-1-core-engine
/slice-review slice-2-viewport
/slice-review slice-3-export --no-spec-review  # doc-only update
/slice-review slice-3-export --no-review  # typo fix
```