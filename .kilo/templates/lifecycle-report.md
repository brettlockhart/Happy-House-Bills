# Slice Lifecycle Report: {{slice-name}}

**Status:** Draft
**Slice:** {{slice-name}}
**Date:** {{today}}
**Owner:** {{owner}}
**Transition:** {{from-lifecycle}} → {{to-lifecycle}}

---

## Transition Summary

{{transition-summary}}

## Scope

| Field | Value |
|-------|-------|
| Source document | {{source-document}} |
| Target document | {{target-document}} |
| Dependencies | {{depends_on}} |
| Blocks | {{blocks}} |
| Review report | {{review-report}} |
| Bypass flags | {{bypass-flags}} |

## Changes

- {{change}}

## Verification Evidence

| Check | Command | Result | Evidence |
|-------|---------|--------|----------|
| Lint | {{lint-command}} | {{result}} | {{evidence}} |
| Typecheck | {{typecheck-command}} | {{result}} | {{evidence}} |
| Tests | {{test-command}} | {{result}} | {{evidence}} |
| Build | {{build-command}} | {{result}} | {{evidence}} |
| Doc lint | {{doc-lint-command}} | {{result}} | {{evidence}} |
| Docs audit | {{docs-audit-command}} | {{result}} | {{evidence}} |

## Open Questions

| ID | Question | Status | Resolution |
|----|----------|--------|------------|
| {{question-id}} | {{question}} | {{status}} | {{resolution}} |

## Documentation Updates

- {{documentation-update}}

## Approval

| Decision | Approver | Date | Notes |
|----------|----------|------|-------|
| {{decision}} | {{approver}} | {{date}} | {{notes}} |

## Next Gate

{{next-gate}}
