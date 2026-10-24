# Slice Pre-flight Command

Run baseline lint/typecheck/test checks before starting or reviewing a slice. Useful for establishing a clean baseline and detecting regressions.

## Usage
```
/slice-preflight <slice-name> [--package <pkg>]
```

## Template

Use `.kilo/templates/preflight-report.md` and save the completed report to `.slice-baseline/<slice-name>/preflight-report.md`. Baseline outputs are also saved as:
- `.slice-baseline/<slice-name>/lint.txt`
- `.slice-baseline/<slice-name>/typecheck.txt`
- `.slice-baseline/<slice-name>/test.txt`

## Workflow
1. Determines affected packages from slice spec (or uses --package override)
2. Runs and captures:
   - `npm run lint --workspace=<pkg>` → `.slice-baseline/<slice-name>/lint.txt`
   - `npm run typecheck --workspace=<pkg>` → `.slice-baseline/<slice-name>/typecheck.txt`
   - `npm run test --workspace=<pkg>` → `.slice-baseline/<slice-name>/test.txt`
3. Reports summary:
   - Errors (must be 0 to proceed)
   - Warnings (recorded as baseline)
   - Test count
4. On subsequent runs, diffs against baseline to show new issues

## Examples
```
/slice-preflight slice-3-export
/slice-preflight slice-4-content --package @Happy House Bills/engine
/slice-preflight slice-2-viewport --package @Happy House Bills/web-app
```

## Integration
- Called automatically by `/slice-implement` (step 1)
- Called automatically by `/slice-review` (step 1)
- Can be run manually anytime to check slice health