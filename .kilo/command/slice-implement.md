# Slice Implementation Command

Start implementing a slice with the slice-implementer agent, enforcing all AGENTS.md gates.

## Usage
```
/slice-implement <slice-name> [--agent] [--worktree] [--force] [--no-plan] [--skip-checks]
```

## Options
- `--agent` — Run in Agent Manager local session (same directory)
- `--worktree` — Run in Agent Manager git worktree (isolated)
- `--force` — Skip dependency validation (use with caution)
- `--no-plan` — Skip spec plan summary gate (doc-only, typo, config changes)
- `--skip-checks` — Skip start/end-of-slice checklists (throwaway spikes only)

## Templates

- Plan: `.kilo/templates/slice-plan.md` → saved to `docs/2-development/supporting-docs/slices/<slice-name>-plan.md`
- Pre-flight: `.kilo/templates/preflight-report.md` → saved to `.slice-baseline/<slice-name>/preflight-report.md`
- Lifecycle: `.kilo/templates/lifecycle-report.md` → appended to slice doc on promotion

**Plan requires explicit user approval** before implementation proceeds.

## Workflow
1. **Dependency validation** (unless `--force`):
   - Reads `depends_on` from slice frontmatter
   - Verifies all dependencies are in `04-implemented` lifecycle
   - Blocks if any dependency is not yet implemented
2. **Spec plan summary gate** (unless `--no-plan`):
   - Populate `.kilo/templates/slice-plan.md` with sections, key decisions, open questions, and dependencies.
   - Save long plans to `docs/2-development/supporting-docs/slices/<slice-name>-plan.md`.
   - Present the plan summary and require explicit user approval before implementation.
3. **Pre-flight baseline** (run once per slice):
   - Populate `.kilo/templates/preflight-report.md` with lint, typecheck, test, and build results.
   - Save the completed report to `.slice-baseline/<slice-name>/preflight-report.md`.
   - `npm run lint --workspace=<affected-packages> 2>&1 | tee .slice-baseline/<slice-name>/lint.txt`
   - `npm run typecheck --workspace=<affected-packages> 2>&1 | tee .slice-baseline/<slice-name>/typecheck.txt`
   - `npm run test --workspace=<affected-packages> 2>&1 | tee .slice-baseline/<slice-name>/test.txt`
   - Records pre-existing warnings/errors to distinguish new regressions.
4. Reads the slice spec from `docs/2-development/01-draft/`
5. Moves it to `02-in-progress` and updates frontmatter
6. Runs start-of-slice verification (build, test, lint, typecheck)
7. Implements the slice per the spec
8. Runs end-of-slice verification
9. **Diff against baseline** — flags any new lint/typecheck issues introduced
10. **Code review prompt** (unless `--skip-checks`):
    - Asks user if they want a code review
11. If yes: moves to `03-ready-for-review`, invokes `implementation-reviewer`
12. If no: moves to `03-ready-for-review` (awaiting manual review)
13. **Lifecycle record** — Populate `.kilo/templates/lifecycle-report.md` and append the completed report to `docs/2-development/<lifecycle>/<slice-name>.md`.

## Bypass Rules
| Flag | Gate Skipped | Allowed When | Logged In Slice Doc |
|------|--------------|--------------|---------------------|
| `--force` | Dependency validation | Hotfix, revert, spike | ✅ Required |
| `--no-plan` | Spec plan summary | Doc-only, typo, config | ✅ Required |
| `--skip-checks` | Start/end checklists | Throwaway spike only | ✅ Required |

## Agent Manager Modes

| Mode | Flag | Use Case |
|------|------|----------|
| Local | `--agent` | Quick iteration, shared deps |
| Worktree | `--worktree` | Full isolation, parallel slices |
| Parallel | (via `/slice-parallel`) | Multiple slices concurrently |

## Dependency Graph

Slices declare dependencies in frontmatter:
```yaml
depends_on: [slice-1-core-engine, slice-2-viewport]
blocks: [slice-3-export, slice-4-content]
```

Validation checks `docs/2-development/04-implemented/` for each dependency.

## Examples
```
/slice-implement slice-3-export
/slice-implement slice-4-content --worktree
/slice-implement slice-5-ai --agent
/slice-implement slice-3-export --force  # skip dependency check
/slice-implement slice-3-export --no-plan  # doc-only change
/slice-implement spike-xyz --skip-checks  # throwaway spike
```