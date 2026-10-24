---
description: Review a completed spec for overlap, missing decisions, unclear scope, and incomplete cross-references
agent: spec-reviewer
---

# Review Spec

Read the completed spec file, compare it against sibling specs in the same domain, and
produce a review report. Do not modify the spec file.

For the full review checklist and output format, use `.kilo/templates/spec-review-report.md` → saved to `docs/2-development/supporting-docs/reviews/<spec-name>-spec-review.md`.

## Scope

Applies to any spec or slice proposal in any lifecycle folder, **including `01-draft`**. It is
the correct command for reviewing a proposal before it is implemented — `/slice-review`
requires an implementation and stops via its lifecycle guard when there is none.

Reviewing a `01-draft` proposal is worth doing: findings at that point are cheap to fix and
expensive to discover after implementation.

The `spec-reviewer` agent owns the checklist, including the **security trigger checklist**.
When it flags a spec as introducing authentication, authorisation, webhook ingress, file
upload, iframe or export handling, a spec-level `security-engineer` review is required before
the spec is ratified. A spec-level Pass means the controls are *specified*, not implemented.

## Process

1. Read the spec file provided in `$ARGUMENTS` or the current working file.
2. Read at least two sibling specs in the same domain.
3. Check for overlap, missing decisions, unclear scope, incomplete cross-references,
   unregistered open questions, and unresolved factual conflicts.
4. Produce a review report with one of three verdicts:
   - **Pass**
   - **Needs revision**
   - **Blocked**

## Output format

```markdown
# Spec Review: <spec-filename>

**Verdict:** Pass / Needs revision / Blocked
**Date:** <today>

## Findings

| # | Section | Issue | Severity | Suggested fix |
|---|---------|-------|----------|---------------|

## Summary

<one-paragraph assessment>
```
