# Slice Demote Command

Move a slice back from 03-ready-for-review to 02-in-progress when review fails or issues are found.

## Usage
```
/slice-demote <slice-name> [--reason <reason>]
```

## Template

Use `.kilo/templates/lifecycle-transition-record.md` and append the completed record to `docs/2-development/02-in-progress/<slice-name>.md`.

## Workflow
1. Reads the slice spec from `docs/2-development/03-ready-for-review/`
2. Verifies slice is in 03-ready-for-review (not 04-implemented)
3. Moves slice doc back to `02-in-progress`
4. Updates frontmatter: lifecycle → 02-in-progress, status → In Progress, updated → today
5. Appends demotion record to slice doc with reason
6. Optionally re-invokes `implementation-reviewer` after fixes

## Examples
```
/slice-demote slice-2-viewport
/slice-demote slice-3-export --reason "Security review failed: iframe sandbox too permissive"
```

## Notes
- Cannot demote from 04-implemented (use new slice for fixes)
- Preserves review report in `supporting-docs/reviews/archive/`
- Updates priority table in `docs/2-development/README.md`