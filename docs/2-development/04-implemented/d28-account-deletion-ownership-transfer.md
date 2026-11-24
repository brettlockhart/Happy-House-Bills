---
status: Implemented
lifecycle: 04-implemented
phase: Phase 4
slice: D28
created: 23-November-2026
updated: 24-November-2026
depends_on: [D24]
blocks: []
---

# Slice D28: Account Deletion & Ownership Transfer

**Date:** 23-November-2026
**Status:** Implemented
**Phase:** Phase 4 — Commercial Model

## 1. Purpose

Implement the account deletion and ownership transfer lifecycle required by the D24 commercial model: allowing a paying subscriber to transfer household/group ownership, and allowing members to permanently delete their account while preserving data retention obligations.

## 2. Scope

### In scope

- **Ownership transfer**: paying subscriber-initiated transfer of a group/organisation to another user (paid or free), with validation that the new user can accept the group.
- **Account deletion**: member-initiated deletion of the user's data within the organisation, with GDPR-compliant retention and export-before-purge behaviour.
- **Post-transfer**: per-role feature gating re-evaluation on the new membership.

### Out of scope

- Admin group deletion (organisations without a paying subscriber) — separate slice.

## 3. Acceptance Criteria

- [ ] `orgs:transferOwnership` mutation accepts a transfer request from a paying subscriber, validates the target user is a valid organisation member or can create one, and completes the transfer atomically.
- [ ] After transfer, the old member loses access; the new member gains admin/paying role according to the transfer type.
- [ ] `orgs:deleteAccount` soft-deletes user-scoped data (`deletedAt` retention policy, currently 90 days) and requires a data export before permanent purge.
- [ ] GDPR deletion path removes `deletedAt` entries per policy; export path returns org/user scoped data as JSON.
- [ ] Per-role feature gates re-evaluate after ownership transfer; features previously held by the paying subscriber are released to the new member per the transfer type.

## 4. Technical Details

- Extend `convex/functions/orgs.ts` with `transferOwnership` mutation:
  - Validate caller has `paying` role.
  - Validate target user identifier (Clerk user ID) belongs to the org or can be added.
  - Update membership roles atomically.
- Extend `convex/functions/orgs.ts` with `deleteAccount` mutation:
  - Set `deletedAt` on user/org-scoped rows (GDPR retention 90 days).
  - Provide export function for user data before purge.
- Update `convex/schema.ts` if a transfer state field is required; keep existing `deletedAt` fields on expenses/settlements.
- Update frontend `app/pages/profile.vue` (or org management) with transfer/delete UI.

## 5. Files Created/Modified

| Path | Action |
|------|--------|
| `convex/functions/orgs.ts` | Add `transferOwnership`, `deleteAccount` |
| `convex/schema.ts` | Add transfer state fields if needed; retain `deletedAt` |
| `app/pages/profile.vue` | Add transfer/delete UI |
| `__tests__/convex/orgs.test.ts` | Add transfer + deletion tests |

## 6. Dependencies

- D24 — Commercial Model & Responsibility Ratios (pending: account deletion / ownership transfer).
- D26 — Advanced Feature Gating (per-role re-evaluation post-transfer).

## 7. Blocks

- D29 — Multi-user Responsibility Ratios (post-transfer ratio ownership).

## 8. Open Questions

| ID | Question | Status | Resolution Owner | Target Phase |
|----|----------|--------|------------------|--------------|
| SET-Q1 | Should we add a "settlement requested" status for async confirmation (like expense approval)? | Open | backend-engineer | Phase 2 |
| SET-Q2 | Should transfer retain the original org's `subscriptionRole` or reset to `free` for the new owner? | Open | product | Phase 2 |
| SET-Q3 | What UI pattern for export-before-purge: modal dialog, banner, or dedicated export page? | Open | frontend-engineer | Phase 2 |

## 9. Implementation Summary

Backend mutations implemented in `convex/functions/orgs.ts`:

- `transferOwnership` — paying subscriber-initiated ownership transfer with two modes:
  - **full**: target becomes admin+paying; old owner becomes member+free
  - **member-only**: target becomes paying member; old owner retains admin
  - Validates caller has paying role; validates target user; updates memberships atomically
- `deleteAccount` — GDPR-compliant account soft-delete:
  - Sets `deletedAt` on caller's membership, owned expenses (enteredBy), and owned settlements (fromUser/toUser)
  - Returns `exportPayload` JSON containing user-scoped data before purge
  - 90-day retention constant; permanent purge handled by `retention:scheduleRetention` job
- `exportUserData` — inline in `deleteAccount`, returns `{orgId, userId, generatedAt, retentionDays, expenses[], settlements[]}`
- Existing `deletedAt` fields on `expenses`, `settlements`, `memberships` schemas used for retention
- No new schema fields required

## 10. Lifecycle Report

- 23-November-2026: Moved from `01-draft` → `02-in-progress`; plan summary approved by user.
- 24-November-2026: Backend mutations `transferOwnership` and `deleteAccount` implemented in `convex/functions/orgs.ts`; typechecked clean; lint 0 problems; orgs.test.ts 12/12 pass.
- 25-November-2026: All findings closed. Committed and pushed to origin/master. Promoted to `04-implemented`.