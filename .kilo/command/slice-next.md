# Slice Next Command

Run the full slice lifecycle in one command: draft, implement, review, promote.

## Usage
```
/slice-next <slice-name|roadmap-keyword> [--worktree] [--no-review] [--force]
```

## Options
- `<slice-name|roadmap-keyword>` — Either an existing draft in `01-draft/` or a roadmap keyword to draft first
- `--worktree` — Run implementation in an isolated Agent Manager worktree
- `--no-review` — Skip the code review gate (trivial: <5 lines, no logic change)
- `--force` — Skip dependency validation (hotfix, revert, spike)

## Workflow

### Phase 1: Draft (if not already drafted)
If no matching draft exists in `docs/2-development/01-draft/`:
1. Read `docs/2-development/roadmap.md` and find the matching unchecked item
2. Filter to items whose `depends_on` slices are all in `04-implemented/`
3. Read sibling completed slices for structure conventions
4. Read relevant domain spec or tech-spec
5. **Draft Plan Summary Gate** — present plan summary and wait for explicit approval
6. After approval, write draft to `docs/2-development/01-draft/<slice-name>.md`
7. Register open questions in `docs/3-reference/spec-gaps.md` §6
8. Strike the roadmap checklist item and add pointer to draft path
9. Run `npm run docs:lint` and `npx tsx docs/scripts/docs-audit.ts`

### Phase 2: Implement
1. Move slice doc from `01-draft` → `02-in-progress`
2. Update frontmatter: status In Progress, lifecycle 02-in-progress, updated today
3. Run pre-flight baseline (lint, typecheck, test) → `.slice-baseline/<slice-name>/`
4. Implement the slice per the spec
5. Run end-of-slice verification (lint, test, typecheck)
6. Diff against baseline to flag new regressions

### Phase 3: Review (unless `--no-review`)
1. Move slice doc to `03-ready-for-review`
2. Invoke `implementation-reviewer` agent
3. Auto-spawn specialised agents based on changed files:
   - `**/LivePreview.vue`, `**/preview/**`, `**/iframe/**` → security-engineer
   - `**/*.vue`, `**/composables/**` → frontend-engineer
   - `**/engine/**`, `**/convex/**`, `**/api/**` → backend-engineer
   - Test files → test-engineer
4. Wait for review verdict

### Phase 4: Promote
1. If verdict = Pass: move slice doc to `04-implemented`
2. Update frontmatter: lifecycle 04-implemented, status Complete
3. Append lifecycle report to slice doc
4. Update roadmap checklist item and cycle time tracking table
5. Update priority table in `docs/2-development/README.md`
6. Run `npm run docs:lint` and `npx tsx docs/scripts/docs-audit.ts`
7. Present lifecycle report in chat

## Examples
```
/slice-next slice-7-ai-generation
/slice-next "AI parameter generation" --worktree
/slice-next slice-7-ai-generation --no-review
/slice-next slice-7-ai-generation --force
```

## Gate Summary

| Gate | Default | Bypass Flag | Bypass Condition |
|------|---------|-------------|------------------|
| Draft plan summary | Enforced | (none) | Always required |
| Dependency validation | Enforced | `--force` | Hotfix, revert, spike |
| Code review | Enforced | `--no-review` | Trivial: <5 lines, no logic |
| Lifecycle order | Enforced | (none) | Never bypassable |

## Rules
- British English in all prose (colour, centre, behaviour, optimise, analyse, realise,
  standardise, organisation, grey).
- All documentation file names must be lowercase with hyphens.
- Never commit secrets, keys, or tokens.
- Do not skip `03-ready-for-review` — every slice must pass through it before
  `04-implemented`.
- The Draft Plan Summary Gate is non-negotiable: do not write the draft file before
  the user approves the plan summary.