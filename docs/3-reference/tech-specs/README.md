# Tech Specs

Reference list of all technical specification documents for Happy House Bills. Each spec
includes YAML frontmatter (status, package, priority, created, updated, tags) so AI agents
can filter and prioritise docs.

## Status Legend

| Status | Meaning |
|--------|---------|
| Missing | Pending; tracked in `spec-gaps.md` (## 1. Missing Referenced Documents) |
| Complete | Spec written and reviewed |
| Part complete | Spec partially written (sections missing) |
| Updated | Existing spec that has been modified |

## Architecture Specs

### Architecture (`tech-specs/architecture/`)

| Filename | Status |
|----------|--------|
| `project-scaffolding.md` | Draft |
| `ci-cd.md` | Draft |
| `deployment.md` | Draft |

## Backend Specs

### Backend (`tech-specs/backend/`)

| Filename | Status |
|----------|--------|
| `data-model.md` | Draft |
| `api-contract.md` | Draft |
| `file-storage.md` | Draft |
| `email-notifications.md` | Draft |
| `duplicate-detection.md` | Draft |

## Frontend Specs

### Frontend (`tech-specs/frontend/`)

| Filename | Status |
|----------|--------|
| `ui-spec.md` | Draft |
| `ocr-pipeline.md` | Draft |
| `mobile-compat.md` | Draft |

## Tech Spec Template

All tech-specs follow this structure (sections 1–6 minimum):

1. **Purpose** — one paragraph: what this spec describes and why it exists
2. **Scope** — in scope / out of scope
3. **Key Decisions** — table with columns: ID | Decision | Rationale | Source
4. **Open Questions** — table with columns: ID | Question | Status | Notes
5. **Cross-References** — backtick paths to related tech-specs, domain specs, and 3-reference docs
6. **Implementation Dependencies** — blocking relationships, depends-on, consumer integration

Each tech-spec must also include YAML frontmatter:

```yaml
---
status: Draft
package: <relevant-package>
priority: high
created: dd-MonthName-yyyy
updated: dd-MonthName-yyyy
tags: [tag1, tag2]
---
```
