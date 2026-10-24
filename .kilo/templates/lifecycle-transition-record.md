# Lifecycle Transition Record: {{slice-name}}

**Status:** Draft
**Slice:** {{slice-name}}
**Date:** {{today}}
**Actor:** {{actor}}
**Transition:** {{from-lifecycle}} → {{to-lifecycle}}
**Reason:** {{reason}}

---

## Before

| Field | Value |
|-------|-------|
| Document path | {{from-document-path}} |
| Lifecycle | {{from-lifecycle}} |
| Status | {{from-status}} |
| Updated | {{from-updated}} |

## After

| Field | Value |
|-------|-------|
| Document path | {{to-document-path}} |
| Lifecycle | {{to-lifecycle}} |
| Status | {{to-status}} |
| Updated | {{to-updated}} |
| Promoted or transitioned | {{date}} |

## Required Gates

| Gate | Status | Evidence |
|------|--------|----------|
| Dependency validation | {{status}} | {{evidence}} |
| Review report exists | {{status}} | {{evidence}} |
| Review verdict is Pass | {{status}} | {{evidence}} |
| Explicit user approval | {{status}} | {{evidence}} |
| Documentation updates complete | {{status}} | {{evidence}} |
| Validation commands pass | {{status}} | {{evidence}} |

## Bypasses

| Gate | Flag | Reason | Timestamp | Audit location |
|------|------|--------|-----------|----------------|
| {{gate}} | {{flag}} | {{reason}} | {{timestamp}} | {{audit-location}} |

## Artifacts

| Artifact | Path | Status |
|----------|------|--------|
| Lifecycle report | {{lifecycle-report-path}} | {{status}} |
| Review report | {{review-report-path}} | {{status}} |
| Roadmap update | {{roadmap-path}} | {{status}} |
| Hotfix or audit log | {{audit-log-path}} | {{status}} |

## Approval

| Decision | Approver | Date | Notes |
|----------|----------|------|-------|
| {{decision}} | {{approver}} | {{date}} | {{notes}} |

## Next Gate

{{next-gate}}
