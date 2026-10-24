# Slice Pre-flight Report: {{slice-name}}

**Status:** Draft
**Slice:** {{slice-name}}
**Date:** {{today}}
**Owner:** {{owner}}
**Packages:** {{packages}}
**Baseline Directory:** {{baseline-directory}}

---

## Purpose

Establish the repository baseline before implementation or review so new regressions can be distinguished from pre-existing findings.

## Commands

| Check | Command | Status | Errors | Warnings | Output |
|-------|---------|--------|--------|----------|--------|
| Lint | {{lint-command}} | {{status}} | {{errors}} | {{warnings}} | {{output-path}} |
| Typecheck | {{typecheck-command}} | {{status}} | {{errors}} | {{warnings}} | {{output-path}} |
| Tests | {{test-command}} | {{status}} | {{errors}} | {{warnings}} | {{output-path}} |
| Build | {{build-command}} | {{status}} | {{errors}} | {{warnings}} | {{output-path}} |

## Baseline Summary

- Lint: {{lint-summary}}
- Typecheck: {{typecheck-summary}}
- Tests: {{test-summary}}
- Build: {{build-summary}}

## Regression Diff

| Check | Baseline | Current | Delta | Action |
|-------|----------|---------|-------|--------|
| {{check}} | {{baseline-result}} | {{current-result}} | {{delta}} | {{action}} |

## Blockers

{{blockers-or-none}}

## Evidence

- Baseline files: {{baseline-files}}
- Command output: {{command-output-paths}}
- Reviewer: {{reviewer}}

## Next Gate

{{next-gate}}
