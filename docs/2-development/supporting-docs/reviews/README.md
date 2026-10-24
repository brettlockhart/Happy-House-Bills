# Review Queue

This file tracks all pending, in-progress, and completed reviews for Happy House Bills.

## Active Reviews

| Slice | Type | Reviewer | Status | Submitted | Last updated |
|-------|------|----------|--------|-----------|--------------|
| (none) | — | — | — | — | — |

## Review Process

1. When a slice is moved to `03-ready-for-review/`, add an entry here with status "Awaiting review"
2. After the implementation-reviewer agent completes, update status to "In review"
3. After the user decides: "Pass" → remove from active, archive report; "Needs revision" → keep active, status "Revision requested"
4. After re-review passes: mark "Approved", archive the report

## Archival

Completed review reports are archived at `docs/2-development/supporting-docs/reviews/archive/`.
