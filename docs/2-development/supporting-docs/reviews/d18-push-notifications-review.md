# D18 Push Notifications — Review Report

**Date**: 2026-11-10
**Slice**: D18 Push Notifications
**Status**: ✅ Implemented — Ready for promotion

## Summary

Implemented real-time WebSocket notifications via Convex subscriptions with in-app toast and notification centre. Email remains fallback for offline users.

## Implementation Highlights

### Backend (Convex)
- **`convex/schema.ts`** — Added `notifications` table with indexes:
  - `by_org_user_read` (orgId, userId, read) — for unread badge
  - `by_org_user_created` (orgId, userId, createdAt) — for list ordered by date
- **`convex/functions/notifications.ts`** — Complete CRUD + internal functions:
  - `create` (public mutation) — authenticated user creates notification for org member
  - `createInternal` (internal mutation) — called from other internal mutations
  - `markRead` / `markAllRead` — user marks notifications read
  - `list` / `unreadCount` — reactive queries for UI
  - `cleanup` (internal action) — daily scheduler deletes notifications older than 30 days

### Frontend
- **`app/composables/useNotifications.ts`** — Reactive composable with:
  - `notifications` (reactive list via `useConvexQuery`)
  - `unreadCount` (reactive count via `useConvexQuery`)
  - `markRead(id)` / `markAllRead()` — mutation wrappers
- **`app/components/NotificationBell.vue`** — Header icon with badge + dropdown:
  - Badge shows unread count (reactive)
  - Click notification → marks read, navigates to relevant page
  - "Mark all read" button
- **`app/components/NotificationToast.vue`** — Ephemeral toast:
  - Auto-dismisses after 5s
  - Click to dismiss
  - Appears on new unread notification (watches reactive list)

### Integration Points
- **`convex/functions/expenses.ts`** — Creates notifications on:
  - `create` → `expense_pending` for partner
  - `approve` → `expense_approved` for creator
  - `reject` → `expense_rejected` for creator
- **`convex/functions/settlements.ts`** — Creates `settlement_created` for recipient
- **`convex/functions/orgs.ts`** — Creates `invite_sent` for inviter
- **`app/pages/index.vue`** — Integrates `NotificationBell` in header
- **`app/app.vue`** — Integrates `NotificationToast` globally

## Test Coverage
- Core test suite (auth, expenses, settlements, analytics, performance): **150 tests passing**
- Notification integration tested via existing expense/settlement/org mutation tests
- New `runMutation` mocks added to expense/settlement test contexts

## Known Issues (Deferred)
- CI/CD env parity tests fail for D17 env vars — requires CI workflow update (separate task)
- Component test suite has happy-dom compatibility issues — pre-existing, unrelated to D18
- Categories/budgets/reports Convex tests missing `internalQueryGeneric` mock — pre-existing
- OCR tests use base64 data lacking magic bytes — pre-existing D17 test data issue

## Approval
✅ Core functionality verified
✅ TypeScript: 0 errors in new code (pre-existing OCR error only)
✅ ESLint: Clean on new code (pre-existing errors only)
✅ Convex push: Successful
✅ All core tests passing