---
description: Fix doc-lint and docs-audit findings across the Happy House Bills docs tree
agent: docs-lint-fixer
---

# Fix Docs Lint Findings

Run `doc-lint.ts` and `docs-audit.ts`, then iteratively fix every finding until both
validators report clean. Do not write new content — repair existing docs only.

Use `.kilo/templates/docs-audit-report.md` → saved to `docs/2-development/supporting-docs/audits/docs-lint-fix-<date>.md` to record findings, fixes, and final validator results.

## Process

1. Run `npm run docs:lint` and `npm run docs:audit`.
2. Read the output and categorise each finding.
3. For each finding, apply the minimal fix.
4. Re-run both validators after each batch of fixes. Iterate until clean.
5. Present a summary of what changed and the final validator output.
