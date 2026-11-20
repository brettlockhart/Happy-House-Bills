---
status: 04-implemented
package: app
priority: medium
created: 11-November-2026
updated: 2026-11-20
tags: [notifications, preferences, push, phase3]
lifecycle: 04-implemented
---

# Slice D22: Notification Preferences & Rich Actions

**Date:** 11-November-2026
**Status:** Implemented
**Phase:** Phase 3 Enhancement

## 1. Purpose

Extend the D18 push notifications system with per-user notification preferences (enable/disable per type, quiet hours, batching) and rich interactive actions in toasts (e.g., "Approve" button on expense_pending toast).

## 2. Scope

### In scope

- Convex schema: `notificationPreferences` table (user-scoped, per org)
- Preferences: enable/disable per notification type, quiet hours (start/end), batching window (debounce), email fallback toggle
- Convex mutations/queries for preferences CRUD
- Frontend: Settings modal/page with preference controls
- Rich toast actions: approve/reject expense from toast, view settlement details, accept invite
- Toast action handlers: call Convex mutations, mark notification read, navigate
- Batching: group notifications within N seconds (configurable, default 2s) into single toast
- Quiet hours: suppress toasts (not storage) during user-defined hours, respect timezone

### Out of scope

- Cross-device sync of preferences (single device for v1)
- Notification templates/customisation per org
- Digest emails (daily/weekly summary) — separate slice
- Push to mobile when app closed (requires service worker / native)

## 3. Key Decisions

| ID | Decision | Rationale | Source |
|----|----------|-----------|--------|
| D1 | Preferences per user per org | Consistent with org-scoping; user in one org currently | D18 schema |
| D2 | Quiet hours suppress toasts only | Notifications still stored; user sees in bell on next open | UX principle |
| D3 | Batching default 2 seconds | Prevents toast spam; configurable per user | D18 P2-Q3 |
| D4 | Rich actions via Convex mutations | Same auth/validation as main UI; no new security surface | Security review |
| D5 | Toast actions: approve/reject, view, accept | Covers all D18 notification types with actions | D18 types |

## 4. Open Questions

| ID | Question | Status | Notes |
|----|----------|--------|-------|
| P3-Q1 | Quiet hours timezone: device or user-profile? | Resolved | Device-local time used (implemented in `useNotificationPreferences.isWithinQuietHours`); simpler and sufficient for v1 |
| P3-Q2 | Batch window: per-type or global? | Resolved | Global per-user `batchWindowMs` (default 2000ms) registered in spec-gaps.md |
| P3-Q3 | Rich action confirmation modal or inline? | Resolved | Inline actions (no confirmation modal) for MVP |
| P3-Q4 | Preferences UI: dedicated Settings page or modal? | Resolved | Modal via bell footer implemented; Settings page deferred if settings grow |

## 5. Cross-References

- `docs/2-development/04-implemented/d18-push-notifications.md` — Base push notifications
- `docs/2-development/04-implemented/d23-goal-tracking-budget-variance.md` — Goal alerts use notification preferences
- `docs/3-reference/domains/08-notifications/email-notifications.md` — Email fallback
- `docs/3-reference/tech-specs/frontend/ui-spec.md` — Toast/Modal patterns
- `spec-gaps.md` — gap tracking (P2-Q2, P2-Q3 from D18)

## 6. Implementation Dependencies

- **Depends on:** D18 (notifications table, Convex functions, UI components)
- **Blocks:** None (enhancement only)
- **Consumer integration:** `NotificationBell`, `NotificationToast`, `useNotifications`, Settings UI

## 7. Technical Approach

### Schema: `convex/schema.ts`

```typescript
notificationPreferences: defineTable({
  orgId: v.string(),
  userId: v.string(),           // recipient
  // Per-type enable/disable
  expensePending: v.boolean(),
  expenseApproved: v.boolean(),
  expenseRejected: v.boolean(),
  settlementCreated: v.boolean(),
  inviteSent: v.boolean(),
  // Quiet hours (24h format, user's local time)
  quietHoursStart: v.optional(v.string()),  // "22:00"
  quietHoursEnd: v.optional(v.string()),    // "08:00"
  // Batching
  batchWindowMs: v.number(),    // default 2000
  // Email fallback
  emailFallback: v.boolean(),   // default true
  // Metadata
  updatedAt: v.number(),
})
  .index("by_org_user", ["orgId", "userId"])
```

### Default Preferences

```typescript
const DEFAULT_PREFS = {
  expensePending: true,
  expenseApproved: true,
  expenseRejected: true,
  settlementCreated: true,
  inviteSent: true,
  quietHoursStart: "22:00",
  quietHoursEnd: "08:00",
  batchWindowMs: 2000,
  emailFallback: true,
}
```

### Convex Functions: `convex/functions/notificationPreferences.ts`

```typescript
// get: query — returns prefs or defaults
// update: mutation — partial update, validates quiet hours format, batchWindowMs 0-60000
// reset: mutation — restore defaults
```

### Rich Toast Actions

```typescript
// NotificationToast.vue props extension:
interface ToastAction {
  label: string
  icon: string
  variant: 'primary' | 'secondary' | 'destructive'
  handler: (notification: Notification) => Promise<void>
  confirm?: boolean  // show confirmation modal
}

// Type-specific actions:
expense_pending: [
  { label: "Approve", icon: "check", variant: "primary", handler: approveExpense },
  { label: "Reject", icon: "x", variant: "destructive", handler: rejectExpense },
]
expense_approved: [
  { label: "View", icon: "eye", variant: "secondary", handler: navigateToExpense },
]
expense_rejected: [
  { label: "View", icon: "eye", variant: "secondary", handler: navigateToExpense },
]
settlement_created: [
  { label: "View", icon: "eye", variant: "secondary", handler: navigateToSettlement },
]
invite_sent: [
  { label: "Accept", icon: "user-plus", variant: "primary", handler: acceptInvite },
]
```

### Batching Logic (in `useNotifications.ts`)

```typescript
// Watch notifications, debounce by batchWindowMs
// Group by type within window
// Show single toast with count badge if >1
// Click toast → open NotificationBell dropdown filtered to batch
```

### Quiet Hours Check

```typescript
function isQuietHours(prefs: NotificationPreferences): boolean {
  if (!prefs.quietHoursStart || !prefs.quietHoursEnd) return false
  const now = new Date()
  const current = now.getHours() * 60 + now.getMinutes()
  const start = parseTime(prefs.quietHoursStart)
  const end = parseTime(prefs.quietHoursEnd)
  if (start < end) return current >= start && current < end
  return current >= start || current < end  // overnight
}
```

### Frontend Integration

- `app/components/NotificationPreferencesModal.vue` — toggles per type, time pickers for quiet hours, number input for batch window, email fallback toggle
- `app/components/SettingsModal.vue` — add "Notifications" section linking to preferences modal
- `NotificationToast.vue` — render actions array, handle clicks, call handlers
- `useNotifications.ts` — integrate batching, quiet hours check before showing toast
- `index.vue` — wire settings button to SettingsModal

## 8. Testing

- Unit: preferences CRUD, quiet hours logic (overnight, same-day), batching grouping
- Integration: create expense → verify toast shows with actions → click Approve → expense approved
- Quiet hours: mock time → verify toast suppressed, notification stored, appears in bell
- Batching: fire 3 expense_pending within 1s → single toast with count=3
- Permissions: user can only modify own preferences
- Rich actions: approve/reject calls correct mutation, marks notification read, closes toast

## 9. Rollout Plan

1. Add `notificationPreferences` table + Convex functions → deploy to dev
2. Build NotificationPreferencesModal + integrate into SettingsModal
3. Extend NotificationToast with actions, add handlers
4. Implement batching + quiet hours in useNotifications
5. Test all notification types with actions in dev
6. Deploy to production

## Lifecycle

- `01-draft` → `02-in-progress`: 11-November-2026 (implementation started)
- `02-in-progress` → `03-ready-for-review`: 18-November-2026 (implementation complete)
- `03-ready-for-review` → `04-implemented`: 20-November-2026 (promoted after full Big Three review)

## Lifecycle Report — D22 Notification Preferences & Rich Actions

**Promoted to:** 04-implemented (20-November-2026)
**Tests:** 877 passed (64 test files); D22-specific: 16 tests across 3 files
**Lint:** 0 problems
**Typecheck:** clean for D22 files (pre-existing baseline in unrelated files)
**Docs audit:** 0 errors

### Completed
- Convex schema: `notificationPreferences` table (org-scoped, per-user) with `by_org_user` index
- Convex functions: `get` (query), `update` (mutation, partial patch), `reset` (mutation)
- `useNotificationPreferences` composable: reactive preferences, `DEFAULT_PREFERENCES`, `isWithinQuietHours`, `isTypeEnabled`
- `NotificationPreferencesModal.vue`: per-type toggles, quiet hours time pickers, batch window number input, email fallback toggle, reset to defaults
- `NotificationToast.vue`: rich action handlers (Approve → `expenses.approve`, Reject → `expenses.reject`, Accept → `orgs.acceptInviteDb`, View → router.push), dismiss id fix, batching via `batchWindowMs`
- `NotificationBell.vue`: notifications panel, badge, preferences button, `goal_alert` icon
- `index.vue`: `isNotificationPreferencesOpen` and `isNotificationsOpen` refs wired to modal and bell

### Big Three Review (2026-11-20)

| Specialist | Verdict / Status | Notes |
|-----------|-------------------|-------|
| **Implementation reviewer** | Pass (after fixes) | 7 critical + 1 minor findings remediated (cosmetic-only handlers, dismiss id mismatch, persist payload, batching unimplemented, batchWindowSeconds binding, missing View actions, missing goal_alert icon) |
| **Security engineer** | Pass | No XSS, auth/org-scoping, rate limits, crypto checks all pass |
| **Test engineer** | Pass | Full suite 877/877 passing; D22 coverage comprehensive |

### Open Questions Resolved
- P3-Q1: quiet hours timezone — device-local time
- P3-Q2: batch window — global per-user `batchWindowMs` (default 2000ms)
- P3-Q3: rich actions — inline (no confirmation modal)
- P3-Q4: preferences UI — modal via bell footer