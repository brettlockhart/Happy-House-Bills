---
status: Draft
package: frontend
priority: medium
created: 25-October-2026
updated: 25-October-2026
tags: [frontend, mobile, responsive, accessibility, pwa, viewport]
---

# Tech Spec: Mobile Compatibility

**Date:** 25-October-2026
**Status:** Draft
**Audience:** Frontend engineers

## 1. Purpose

Define how the Happy House Bills Nuxt 4 application delivers an optimised mobile experience. Mobile is the primary device for users (they photograph receipts at the register). This spec covers viewport configuration, touch target sizing, camera access for photo capture, Progressive Web App (PWA) support, and browser compatibility testing targets.

## 2. Scope

### In scope

- Viewport meta tag and responsive design conventions (mobile-first)
- Touch target sizing: 44 × 44 px minimum on interactive elements
- Camera access via `<input type="file" accept="image/*" capture="environment">` for receipt photo capture
- PWA manifest for installability on iOS Safari and Android Chrome
- Browser compatibility: iOS Safari 15+, Android Chrome 90+, desktop Chrome/Firefox latest
- Performance budget: initial load < 200 KB; OCR worker loaded lazily
- `prefers-reduced-motion` media query handling
- Image handling: EXIF orientation correction, compression before upload

### Out of scope

- Native mobile app (out of scope per `project_brief.md`)
- Camera UI component design (covered by `tech-specs/frontend/ui-spec.md`)
- OCR processing logic (covered by `tech-specs/frontend/ocr-pipeline.md`)
- Deep link handling for mobile (covered by `tech-specs/backend/email-notifications.md` (## 8. Deep Link Format))

## 3. Key Decisions

| ID | Decision | Rationale | Source |
|----|----------|-----------|--------|
| D1 | Mobile-first CSS with single-column stack below 768 px | Most usage is on mobile; single column is simplest and least error-prone for expense tracking | `tech-specs/frontend/ui-spec.md` D4 |
| D2 | Use native `<input type="file">` with `capture="environment"` for photo capture | No native app; leverages device camera directly; works on iOS Safari and Android Chrome | `project_brief.md` (## Acceptance Criteria) |
| D3 | 44 × 44 px minimum touch targets | WCAG 2.2 AA target-size requirement; prevents accidental taps | `tech-specs/frontend/ui-spec.md` D5 |
| D4 | Lazy-load Tesseract.js worker and English language data | Keeps initial JS bundle under 200 KB; 8 MB OCR model loads only when needed | `tech-specs/frontend/ocr-pipeline.md` D7 |
| D5 | PWA manifest with `display: standalone` and home-screen icons | Allows users to install the web app on their home screen for app-like experience | `project_brief.md` (## Acceptance Criteria) |
| D6 | EXIF orientation correction via `canvas` before OCR/upload | Mobile cameras embed orientation; without correction, OCR fails on rotated receipts | `user-flows.md` (## 2. Receipt Upload & OCR) |
| D7 | Respect `prefers-reduced-motion` by disabling all animations | Accessibility compliance; motion sickness risk for some users | `docs/AGENTS.md` (## 4. Code Style) |

## 4. Open Questions

| ID | Question | Status | Notes |
|----|----------|--------|-------|
| (none) | — | — | — |

## 5. Cross-References

- `tech-specs/frontend/ui-spec.md` — D4/D5 touch targets and responsive layout, D6 motion preference
- `tech-specs/frontend/ocr-pipeline.md` — D7 lazy worker loading
- `domains/05-receipts/receipt-upload.md` — photo capture flow
- `spec-gaps.md` — gap tracking

## 6. Implementation Dependencies

- **Depends on:** `ui-spec.md` (spacing, breakpoints, motion variables)
- **Blocks:** `domains/05-receipts/receipt-upload.md`, `domains/02-expenses/expense-management.md`
- **Consumer integration:** `app/components/AddExpenseModal.vue` (camera input), `app/assets/css/main.css` (PWA viewport, touch target overrides)

## 7. Viewport & PWA Configuration

```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  app: {
    head: {
      meta: [
        { name: "viewport", content: "width=device-width, initial-scale=1" },
        { name: "theme-color", content: "#10b981" },
      ],
      link: [
        { rel: "manifest", href: "/manifest.webmanifest" },
        { rel: "apple-touch-icon", href: "/icons/icon-192.png" },
      ],
    },
  },
  // ... pwa module config
});
```

```json
// public/manifest.webmanifest
{
  "name": "Happy House Bills",
  "short_name": "HHB",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#10b981",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

## 8. Touch Target Enforcement

```css
/* app/assets/css/main.css */

/* Ensure all interactive elements meet 44x44px minimum */
button, a[href], input[type="button"], input[type="submit"], input[type="file"] {
  min-height: 44px;
  min-width: 44px;
}

/* Remove default styling on file input for mobile */
input[type="file"] {
  opacity: 0;
  position: absolute;
  width: 100%;
  height: 100%;
}

.HhbButton {
  min-height: 44px;
  padding: var(--hhb-space-3) var(--hhb-space-4);
}
```

## 9. Browser Compatibility Targets

| Feature | iOS Safari | Android Chrome | Desktop Chrome | Desktop Firefox |
|---------|-----------|----------------|----------------|-----------------|
| Camera capture | 11+ | 90+ | — | — |
| Tesseract.js Web Worker | 13+ | 90+ | 90+ | 90+ |
| CSS `prefers-reduced-motion` | 12.1+ | 90+ | 90+ | 90+ |
| PWA install | 11.3+ | 90+ | 90+ | — |
| AVIF image support | 16+ | 90+ | 90+ | 93+ |

For unsupported browsers (iOS Safari < 15), the app degrades gracefully: camera input falls back to file picker, PWA install prompt is hidden.
