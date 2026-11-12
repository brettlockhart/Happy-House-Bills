---
status: Complete
lifecycle: 04-implemented
phase: Phase 3
slice: D13
created: 03-November-2026
updated: 04-November-2026
depends_on: [D1, D11]
blocks: []
owner: backend-engineer
priority: P2
---

# D13 — Team Workspaces & Collaboration

## Purpose

Implement multi-user workspace management with role-based access control, team collaboration features, and project organisation capabilities. Enables multiple users to work together within organised teams with appropriate permissions.

## Scope

### In scope
- Role-based access control (RBAC) system
- Team creation and management
- Project/workspace organisation and hierarchy
- Member invitation and role assignment
- Permission management per workspace
- Audit trails and activity logging
- Team dashboards

### Out of scope
- External authentication providers for teams
- Advanced enterprise SSO integration
- Large organisation (>100 users) optimisations
- Custom workflow automation
- Advanced reporting on team activities
- Team-based billing and subscription management

## Key Decisions

| Decision | Rationale |
|----------|-----------|
| RBAC from scratch | Full control over permissions and custom roles |
| Team-first approach | Organisation as primary unit |
| Flat hierarchy | Simple, predictable team structure |
| Role-based invitations | Secure, trackable member onboarding |
| Admin/member/viewer roles | Simple, predictable permission model |

## Acceptance Criteria

- [x] Role-based access control functional
- [x] Team creation and management working
- [x] Member invitation and assignment operational
- [x] Permission hierarchy enforced
- [x] Audit logging functional
- [x] Team dashboards created

## Files Created/Modified

| Path | Action |
|------|--------|
| `convex/functions/teams.ts` | Create — RBAC, member management, audit logging |
| `convex/functions/orgs.ts` | Modify — create org now also creates admin membership |
| `app/components/TeamDashboard.vue` | Create — team overview interface |
| `app/components/MemberManager.vue` | Create — member management interface |
| `app/composables/useTeams.ts` | Create — team state management |
| `app/utils/team-permissions.ts` | Create — permission utilities |
| `__tests__/convex/teams.test.ts` | Create — team management tests (15 passing) |
| `convex/schema.ts` | Modify — added memberships, auditLogs tables |
| `convex/_generated/api.ts` | Modify — added teams API references |

## Open Questions

| ID | Question | Status | Resolution Owner | Target Phase |
|----|----------|--------|------------------|--------------|
| TEAM-Q1 | What's the optimal RBAC model for this application? | Resolved | backend-engineer | Phase 3 — Three-role RBAC (admin, member, viewer) implemented with permission checks per role |
| TEAM-Q2 | How should we handle team invitations and security? | Resolved | security-engineer | Phase 3 — Token-based invites with rate limiting (10/day/org), org-scoped validation, org ID mismatch rejection, self-action prevention |
| TEAM-Q3 | What's the best approach for team billing integration? | Deferred | backend-engineer | Phase 3 — Out of scope per D13; team-based billing not in v1 scope |

> Team collaboration is essential for business adoption; prioritize this slice after D11.

## Blocks

- None (this can run concurrently with D12)

## Lifecycle Report

#### Phase 3: Implementation Completed

**Implementation Review:** Complete
- RBAC with three roles (admin, member, viewer) implemented
- Permission model enforced per role
- Org-scoped data isolation maintained
- Audit logging on role changes and member removal
- All lint/typecheck issues resolved (duplicate `now` variable fixed in teams.ts:281)

**Test Coverage:** Complete
- 15 tests passing in `__tests__/convex/teams.test.ts`
- Covers auth, RBAC enforcement, invite creation/acceptance, audit logging

**Security Controls:**
- Org-scoped access via `requireAuthenticatedOrg`
- Role-based permission checks
- Audit trails for all membership changes
- Org ID mismatch rejection on invite creation
- Self-removal prevention on role change and member removal
