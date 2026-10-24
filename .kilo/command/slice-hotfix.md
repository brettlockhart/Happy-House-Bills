# Slice Hotfix Command

Run an emergency hotfix with controlled bypasses. Bundles common bypass flags for time-critical fixes.

## Usage
```
/slice-hotfix <slice-name> [--type <type>] [--reason <reason>]
```

## Types
| Type | Bypasses | Use Case |
|------|----------|----------|
| `security` | `--force --no-review --skip-checks` | Emergency security patch |
| `config` | `--no-plan --no-review` | Config typo, env var fix |
| `doc` | `--no-plan --no-spec-review` | Documentation typo, prose fix |
| `revert` | `--force --no-review` | Revert breaking change |

## Templates

- Security review: `.kilo/templates/security-review.md` → saved to `docs/2-development/supporting-docs/reviews/<slice-name>-security-review.md`
- Transition record: `.kilo/templates/lifecycle-transition-record.md` → appended to slice doc

## Workflow
1. **Validates** slice exists in `01-draft`, `02-in-progress`, or `03-ready-for-review`
2. **Applies type-specific bypasses** (see table above)
3. **Logs bypass reason** to slice doc frontmatter: `hotfix: { type, reason, timestamp }`
4. **Runs** `/slice-implement` with bypasses
5. **Runs** `/slice-review` with bypasses
6. **Runs** `/slice-promote --force` with bypasses
7. **Tags** commit with `hotfix/<slice-name>-<timestamp>`

## Safety
- **Requires explicit `--reason`** — explains why hotfix is needed
- **Records in audit log** — `docs/2-development/supporting-docs/hotfixes.md`
- **Auto-queues for full review** — bypassed slices appear in next review cycle
- **Limited scope** — only allows listed bypass combinations

## Examples
```
/slice-hotfix slice-2-viewport --type security --reason "XSS in preview iframe"
/slice-hotfix slice-1-core-engine --type config --reason "Typo in engine config"
/slice-hotfix slice-3-export --type doc --reason "Fix typo in export docs"
/slice-hotfix slice-3-export --type revert --reason "Revert breaking API change"
```

## Post-Hotfix
After hotfix promotion:
1. Slice marked with `hotfix: true` in frontmatter
2. Added to hotfix audit log
3. Auto-assigned to next review cycle for full verification
4. Original bypass flags documented for audit trail