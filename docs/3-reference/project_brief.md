# Happy House Bills — Product Brief

## Product

Happy House Bills is a web app for couples to track shared household spending, split costs,
and settle up. The core value proposition: **photo a receipt at the register → expense is logged
before you're in the car.**

## Market Position

- **Category:** Household finance / expense splitting
- **Target users:** Couples living together who share household expenses
- **Key differentiator:** Receipt-first entry with instant OCR and duplicate detection
- **Revenue model:** Free (no monetisation planned for v1)

## Business Model

No revenue model in v1. The app is free to use. Potential future monetisation (subscription
tier, premium OCR) is deferred to post-launch.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Nuxt 4 (Vue 3, Composition API, TypeScript) |
| Hosting | Cloudflare Workers (`nitro.preset: 'cloudflare-module'`) |
| Backend / DB | Convex (TypeScript, document store) |
| Auth / Multi-tenancy | Clerk (Organizations for multi-tenancy) |
| File Storage | Cloudflare R2 (via `@convex-dev/r2` component) |
| Transactional Email | Resend |
| OCR | Tesseract.js (client-side, v1); Google Document AI (v1.1, future) |

## Key Modules

- `@clerk/nuxt` — Clerk integration
- `@j-boardman/convex-nuxt` — Convex + Nuxt bridging (supports `cloudflare-module` preset)
- `convex/react-clerk` — Clerk ↔ Convex auth bridge
- `@convex-dev/r2` — R2 file storage component

## Multi-Tenancy Model

- Each household = one Clerk organisation with exactly two members
- Every Convex table has an `orgId: string` field (Clerk organisation ID)
- Every query is scoped: `.withIndex('by_org', q => q.eq('orgId', orgId))`
- `orgId` is derived from the active Clerk session on every request
- A user belongs to exactly one organisation (enforced in onboarding)

## Acceptance Criteria

1. Two users can sign up, create a household, and invite each other
2. Either user can add an expense manually (amount, date, category, who paid)
3. Either user can upload a receipt image → OCR pre-fills the form → submit
4. The other user sees the pending expense and can approve or reject
5. Only approved expenses count toward the balance
6. Either user can record a settlement
7. The balance updates in real-time for both users
8. Duplicate receipt detection triggers a warning
9. The app works on mobile browsers (iOS Safari, Android Chrome)
10. Total deploy time from clean repo to production: < 10 minutes

## Non-Goals (v1)

- No line-item extraction from receipts
- No categories beyond groceries / utilities / other
- No reports, charts, or analytics
- No CSV/bank statement import
- No multi-currency
- No push notifications (email only)
- No dispute workflow (reject + note is sufficient)
- No audit trail UI (data is in the DB, no "history" screen)
- No "switch household" or multiple orgs per user
- No native mobile app
- No settings screen
- No browser-native flatbed scanning
