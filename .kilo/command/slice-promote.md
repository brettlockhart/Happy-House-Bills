# Slice Promote Command

Promote a reviewed slice from 03-ready-for-review to 04-implemented.

## Usage
```
/slice-promote <slice-name> [--force]
```

## Options
- `--force` — Skip review report check (emergency hotfix only)

## Templates

- Lifecycle report: `.kilo/templates/lifecycle-report.md` → appended to slice doc
- Transition record: `.kilo/templates/lifecycle-transition-record.md` → appended to slice doc
- Review report: `.kilo/templates/review-report.md` (must exist in `supporting-docs/reviews/`)

**Requires explicit user approval** before promotion proceeds.

## Workflow
1. Reads the slice spec from `docs/2-development/03-ready-for-review/`
2. **Review gate** (unless `--force`):
   - Verifies review report exists in `docs/2-development/supporting-docs/reviews/<slice-name>-review.md`
   - Verifies verdict = "Pass"
   - Requires explicit user confirmation
3. Moves slice doc to `04-implemented`
4. Updates frontmatter: lifecycle 04-implemented, status Complete
5. Populate `.kilo/templates/lifecycle-report.md` and `.kilo/templates/lifecycle-transition-record.md`; append both completed artifacts to `docs/2-development/04-implemented/<slice-name>.md` (includes bypass reason if `--force`)
6. **Updates priority table in `docs/2-development/README.md`**
7. **Updates roadmap/milestone tracking in `docs/2-development/roadmap.md`**
8. Runs `npm run docs:lint` and `npm run docs:audit`

## Bypass Rules
| Flag | Gate Skipped | Allowed When | Logged In Slice Doc |
|------|--------------|--------------|---------------------|
| `--force` | Review report check | Emergency security fix, hotfix | ✅ Required + audit flag |

## Examples
```
/slice-promote slice-1-core-engine
/slice-promote slice-2-viewport
/slice-promote slice-3-export --force  # emergency only
```