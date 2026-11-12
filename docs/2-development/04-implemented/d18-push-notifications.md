---
status: In Progress
package: app
priority: high
created: 09-November-2026
updated: 09-November-2026
tags: [notifications, push, realtime, convex, phase2]
lifecycle: 02-in-progress
---

# Slice D18: Push Notifications

**Date:** 09-November-2026
**Status:** Draft → In-Progress
**Phase:** Phase 2 Enhancement

## 1. Purpose

Add real-time WebSocket notifications via Convex subscriptions, replacing email-only for in-app users. Email remains fallback for offline users. Notifications cover: pending expense, expense approved/rejected, settlement created, invite sent.

## 2. Scope

### In scope

- New `notifications` table in Convex schema (org-scoped, user-targeted)
- Convex mutations: `notifications.create`, `notifications.markRead`, `notifications.markAllRead`
- Convex queries: `notifications.list` (real-time subscription), `notifications.unreadCount`
- Frontend composable `useNotifications.ts` with reactive unread count + list
- UI components: `NotificationBell.vue` (header icon + dropdown), `NotificationToast.vue` (ephemeral toast)
- Integration: trigger notifications from `expenses.create/approve/reject`, `settlements.create`, `orgs.invite`
- Email still sent for all events (push is enhancement, not replacement)

### Out of scope

- Push to mobile/desktop when app closed (requires service worker / native)
- Notification preferences per user (Phase 3)
- Rich actions in notifications (e.g., "Approve" button in toast)
- Cross-org notifications (not applicable — user in one org)

## 3. Key Decisions

| ID | Decision | Rationale | Source |
|----|----------|-----------|--------|
| D1 | Convex subscriptions (not raw WebSockets) | Native Convex reactivity; no separate infra; auth integrated | Phase 2 plan |
| D2 | In-app toast + notification centre | Non-intrusive; user can dismiss or view history | Phase 2 plan |
| D3 | Email still sent for offline users | Push is enhancement; email remains delivery guarantee | `domains/08-notifications/email-notifications.md` |
| D4 | Notification types: `expense_pending`, `expense_approved`, `expense_rejected`, `settlement_created`, `invite_sent` | Covers all existing email triggers | Phase 2 plan |
| D5 | TTL: 30 days, then auto-delete via scheduler | Prevents unbounded growth; user can mark read anytime | Phase 2 plan |

## 4. Open Questions

| ID | Question | Status | Notes |
|----|----------|--------|-------|
| P2-Q2 | Push notification retention policy (TTL)? | Open | Proposed: 30 days |
| P2-Q3 | Should push notifications batch multiple events within N seconds? | Open | Debounce 2s to avoid toast spam |

## 5. Cross-References

- `docs/3-reference/domains/08-notifications/email-notifications.md` — email triggers (unchanged)
- `convex/functions/expenses.ts` — `create`, `approve`, `reject` mutations
- `convex/functions/settlements.ts` — `create` mutation
- `convex/functions/orgs.ts` — `invite` action
- `convex/schema.ts` — new `notifications` table
- `spec-gaps.md` — gap tracking

## 6. Implementation Dependencies

- **Depends on:** Convex schema migration (notifications table), Convex reactive queries working
- **Blocks:** None (UI enhancement only)
- **Consumer integration:** `index.vue` imports `NotificationBell` + `NotificationToast`; mutations schedule `notifications.create`

## 7. Technical Approach

### Schema: `convex/schema.ts`

```typescript
notifications: defineTable({
  orgId: v.string(),
  userId: v.string(),           // recipient
  type: v.union(
    v.literal("expense_pending"),
    v.literal("expense_approved"),
    v.literal("expense_rejected"),
    v.literal("settlement_created"),
    v.literal("invite_sent"),
  ),
  title: v.string(),
  body: v.string(),
  data: v.optional(v.any()),    // { expenseId?, settlementId?, inviteToken? }
  read: v.boolean(),
  createdAt: v.number(),
})
  .index("by_org_user_read", ["orgId", "userId", "read"])
  .index("by_org_user_created", ["orgId", "userId", "createdAt"])
```

### Convex Functions: `convex/functions/notifications.ts`

```typescript
// create: mutation — inserts notification, returns id
// markRead: mutation — patches read=true
// markAllRead: mutation — patches all unread for user
// list: query — reactive, ordered by createdAt desc, filter read=false for bell badge
// unreadCount: query — reactive count for badge
// cleanup: internal action — run daily, delete notifications older than 30 days
```

### Frontend: `app/composables/useNotifications.ts`

```typescript
export function useNotifications() {
  const client = useConvexClient();
  const notifications = useConvexQuery(api.functions.notifications.list, () => ({}));
  const unreadCount = useConvexQuery(api.functions.notifications.unreadCount, () => ({}));

  async function markRead(notificationId: Id<"notifications">) { ... }
  async function markAllRead() { ... }

  return { notifications, unreadCount, markRead, markAllRead };
}
```

### UI Components

- `NotificationBell.vue` — header icon with badge (unreadCount), dropdown list (click → markRead, navigate)
- `NotificationToast.vue` — ephemeral toast (auto-dismiss 5s, click to dismiss, shows title+body)
- `index.vue` — integrate both; `useNotifications` provides toast trigger via watch on `notifications` (new unread)

### Integration Points

```typescript
// expenses.ts create → after insert:
await ctx.runMutation(internal.functions.notifications.create, {
  orgId, userId: partnerId,
  type: "expense_pending",
  title: "New expense pending",
  body: `${payerName} added $${amount} for ${category}`,
  data: { expenseId: id },
});

// expenses.ts approve/reject → similar
// settlements.ts create → type: "settlement_created"
// orgs.ts invite → type: "invite_sent", data: { inviteToken }
```

## 8. Testing

- Unit tests: notifications CRUD, read/unread filters, TTL cleanup
- Integration: create expense → verify notification appears in real-time for partner
- UI: bell badge updates reactively; toast appears on new notification; markRead works
- Fallback: email still sent (unchanged)

## 9. Rollout Plan

1. Add schema + Convex functions → deploy to dev
2. Build UI components + composable → test in dev
3. Wire integration points in expenses/settlements/orgs
4. Deploy to production
5. Monitor notification delivery latency (<500ms target)

## Lifecycle

- `01-draft` → `02-in-progress`: 09-November-2026
- `02-in-progress` → `03-ready-for-review`: TBD
- `03-ready-for-review` → `04-implemented`: TBD