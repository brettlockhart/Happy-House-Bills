# Documentation Audit Report: {{scope}}

**Status:** Draft
**Scope:** {{scope}}
**Date:** {{today}}
**Auditor:** {{auditor}}
**Verdict:** {{Pass | Needs revision | Blocked}}

---

## Commands Run

| Check | Command | Result | Output path |
|-------|---------|--------|-------------|
| Structural doc lint | {{doc-lint-command}} | {{result}} | {{output-path}} |
| Quality docs audit | {{docs-audit-command}} | {{result}} | {{output-path}} |
| Prose lint | {{textlint-command}} | {{result}} | {{output-path}} |

## Findings

| # | File | Check | Finding | Severity | Suggested fix |
|---|------|-------|---------|----------|---------------|
| 1 | {{file}} | {{check}} | {{finding}} | {{error | warning | info}} | {{suggested-fix}} |

## Systemic Patterns

| Pattern | Evidence | Interpretation | Follow-up |
|---------|----------|----------------|-----------|
| {{pattern}} | {{evidence}} | {{interpretation}} | {{follow-up}} |

## Fixes Applied

- {{fix}}

## Revalidation

| Check | Result | Evidence |
|-------|--------|----------|
| Doc lint | {{result}} | {{evidence}} |
| Docs audit | {{result}} | {{evidence}} |
| Prose lint | {{result}} | {{evidence}} |

## Summary

{{one-paragraph-assessment}}

## Next Gate

{{next-gate}}
