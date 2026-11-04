---
status: In Progress
lifecycle: 02-in-progress
phase: Phase 1
slice: D3
created: 26-October-2026
updated: 30-October-2026
depends_on: [D1]
blocks: []
---

# Implementation Review: D3 Onboarding Flow

**Verdict:** Needs revision
**Slice:** D3
**Date:** 30-October-2026

## Findings

| # | File | Issue | Severity | Suggested fix |
|---|------|-------|----------|---------------|
| 1 | convex/functions/orgs.ts | Functions implemented as actions instead of mutations as specified | blocking | Change create and acceptInvite to use `export const create = mutation({...})` and `export const acceptInvite = mutation({...})` |
| 2 | convex/functions/orgs.ts | orgs:create argument 'name' should be optional (v.optional) but is required (v.string()) | blocking | Change `name: v.string()` to `name: v.optional(v.string())` |
| 3 | convex/functions/orgs.ts | orgs:acceptInvite should check Clerk API to add user to org (per spec) | blocking | Replace the current implementation with Clerk Backend API call for adding users |
| 4 | convex/functions/orgs.ts | orgs:invite function signature doesn't match spec (args include orgId, orgName) | blocking | Update function signature to match spec: `args: { email: v.string(), orgId: v.string(), orgName: v.optional(v.string()) }` |
| 5 | app/pages/invite.vue | File is missing - spec requires invite page for token-based auto-accept | blocking | Create app/pages/invite.vue with auto-accept logic when token present |
| 6 | app/middleware/auth.global.ts | Route guard incomplete - doesn't redirect to onboard when authenticated but no org | blocking | Implement missing redirect logic per spec |
| 7 | docs/2-development/roadmap.md | D3 Onboarding & organisation marked as completed but still 02-in-progress | minor | Update status to reflect actual implementation state |

## Specialised Agent Reports

- frontend-engineer: Pending (agent sessions queued)
- backend-engineer: Pending (agent sessions queued)
- security-engineer: Not applicable (no preview/iframe files)
- test-engineer: Pending (agent sessions queued)

## Summary

The D3 Onboarding Flow implementation has multiple blocking issues that prevent it from meeting the slice specification:

1. **Critical Implementation Errors:** The core Convex functions (create, acceptInvite) are implemented with wrong persistence levels (actions vs mutations), missing optional parameters, and incorrect logic.

2. **Missing Components:** The invite page and complete route guard middleware are not implemented.

3. **Inconsistency:** The roadmap incorrectly marks this feature as completed while it's still in development.

The implementation requires significant refactoring to align with the specification. All blocking issues must be resolved before the slice can proceed to 03-ready-for-review.