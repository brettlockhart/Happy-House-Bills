---
description: Team workspaces with RBAC, project collaboration, and member management
mode: primary
---

# D13 — Team Workspaces & Collaboration

## Purpose

Implement multi-user workspace management with role-based access control, team collaboration features, and project organization capabilities. Enables multiple users to work together within organized teams with appropriate permissions.

## Scope

### In scope
- Role-based access control (RBAC) system
- Team creation and management
- Project/workspace organization and hierarchy
- Member invitation and role assignment
- Permission management per workspace
- Team-based billing and subscription management
- Collaboration tools integration
- Audit trails and activity logging
- Team dashboards and analytics

### Out of scope
- External authentication providers for teams
- Advanced enterprise SSO integration
- Large organization (>100 users) optimizations
- Custom workflow automation
- Advanced reporting on team activities

## Key Decisions

| Decision | Rationale |
|----------|-----------|
| RBAC from scratch | Full control over permissions and custom roles |
| Team-first approach | Organization as primary unit |
| Flat hierarchy | Simple, predictable team structure |
| Role-based invitations | Secure, trackable member onboarding |
| Usage-based pricing | Fair billing for team members |

## Acceptance Criteria

- [ ] Role-based access control functional
- [ ] Team creation and management working
- [ ] Member invitation and assignment operational
- [ ] Permission hierarchy enforced
- [ ] Team billing system integrated
- [ ] Collaboration tools integrated
- [ ] Audit logging functional
- [ ] Team dashboards created

## Files Created/Modified

| Path | Action |
|------|--------|
| `convex/functions/orgs.ts` | Create — org/team management |
| `convex/functions/teams.ts` | Create — team collaboration |
| `app/components/TeamDashboard.vue` | Create — team overview interface |
| `app/composables/useTeamStore` | Create — team state management |
| `app/composables/useRoles` | Create — role management hook |
| `app/utils/team-permissions` | Create — permission utilities |
| `docs/specs/team/team-spec.md` | Create — team collaboration spec |
| `__tests__/convex/teams.test.ts` | Create — team management tests |

## Open Questions

| ID | Question | Status | Resolution Owner | Target Phase |
|----|----------|--------|------------------|--------------||
| TEAM-Q1 | What's the optimal RBAC model for this application? | Open | backend-engineer | Phase 3 |
| TEAM-Q2 | How should we handle team invitations and security? | Open | security-engineer | Phase 3 |
| TEAM-Q3 | What's the best approach for team billing integration? | Open | backend-engineer | Phase 3 |

> Team collaboration is essential for business adoption; prioritize this slice after D11.

## Blocks

- None (this can run concurrently with D12)

(End of file - total 184 lines)