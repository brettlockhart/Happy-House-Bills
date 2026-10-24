# Spec Review Report: {{spec-name}}

**Status:** Draft
**Spec:** {{spec-name}}
**Date:** {{today}}
**Reviewer:** {{reviewer}}
**Verdict:** {{Pass | Needs revision | Blocked}}

---

## Review Scope

| Field | Value |
|-------|-------|
| Source document | {{source-document}} |
| Sibling documents reviewed | {{sibling-documents}} |
| Domain or layer | {{domain-or-layer}} |
| Ground-truth sources | {{ground-truth-sources}} |

## Checklist

| Check | Status | Evidence |
|-------|--------|----------|
| Required sections present | {{status}} | {{evidence}} |
| Scope separates in/out | {{status}} | {{evidence}} |
| Key decisions have rationale | {{status}} | {{evidence}} |
| Open questions are registered | {{status}} | {{evidence}} |
| Cross-references resolve | {{status}} | {{evidence}} |
| Cross-references are reciprocal | {{status}} | {{evidence}} |
| No duplicate ownership | {{status}} | {{evidence}} |
| British English | {{status}} | {{evidence}} |

## Findings

| # | Section | Issue | Severity | Suggested fix |
|---|---------|-------|----------|---------------|
| 1 | {{section}} | {{issue}} | {{blocking | minor}} | {{suggested-fix}} |

## Summary

{{one-paragraph-assessment}}

## Handoff Options

| Option | Trigger | Next action |
|--------|---------|-------------|
| Revise spec | Verdict = Needs revision | Re-run `/spec-review {{spec-name}}` after fixes |
| Plan implementation | Verdict = Pass | Invoke `implementation-planner` |
| Security review | Security gaps found | Invoke `security-engineer` |
| Fix documentation | Lint or audit findings | Invoke `docs-lint-fixer` |
