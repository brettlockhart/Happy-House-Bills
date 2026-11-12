---
status: Ready for Review
package: app
priority: high
created: 09-November-2026
updated: 10-November-2026
tags: [ocr, google-document-ai, receipts, phase2]
lifecycle: 03-ready-for-review
---

# Slice D17: Google Document AI OCR

**Date:** 09-November-2026
**Status:** Draft → In-Progress → Ready for Review
**Phase:** Phase 2 Enhancement

## 1. Purpose

Replace client-side Tesseract.js OCR with Google Document AI for higher-accuracy receipt processing. The interface remains the same: image in → `{store, date, total, confidence}` out. Processing moves server-side to a Convex action.

## 2. Scope

### In scope

- New Convex action `functions/ocr.ts` calling Google Document AI (Form Parser processor) with input validation and rate limiting
- New composable `useGoogleOCR.ts` wrapping the Convex action with Tesseract.js fallback
- Integration in `AddExpenseModal.vue` for receipt upload + OCR flow
- Environment variables for Google Cloud configuration
- Graceful fallback to Tesseract.js on Document AI errors
- 60% confidence threshold with UI warning
- Update documentation references

### Out of scope

- Custom Document AI model training (uses pre-built `FORM_PARSER`)
- Line-item extraction (Phase 3+)
- Receipt upload to R2 (unchanged, still via `uploadReceipt` action)
- Duplicate detection (unchanged)

## 3. Key Decisions

| ID | Decision | Rationale | Source |
|----|----------|-----------|--------|
| D1 | Server-side Document AI (Convex action) | Keeps secrets server-side; no client bundle size increase; async by nature | Phase 2 plan |
| D2 | Same output interface as Tesseract | Zero frontend changes beyond swapping the composable | Phase 2 plan |
| D3 | Confidence threshold stays at 60% | Consistent UX; Document AI confidence scores map to same threshold | `domains/06-ocr/ocr-pipeline.md` D2 |
| D4 | Fallback to Tesseract on error | Graceful degradation if Document AI unavailable | Phase 2 plan |
| D5 | Use `FORM_PARSER` processor (pre-built) | No training data required; handles generic receipts well | Google Cloud docs |
| D6 | Input validation mirrors `uploadReceipt` | Prevents abuse of paid Document AI API; validates type, size, magic bytes, dimensions | Security review H-1 |
| D7 | Rate limiting (50/day/org/user) | Prevents cost/abuse amplification on paid API | Security review M-1 |
| D8 | Sanitize Document AI errors | Prevents project/processor ID leakage to browser console | Security review M-2 |
| D9 | AUTH_BYPASS production guard | Hard enforcement prevents accidental production bypass | Security review M-3 |

## 4. Open Questions

| ID | Question | Status | Notes |
|----|----------|--------|-------|
| P2-Q1 | Document AI processor type: `FORM_PARSER` vs custom trained model? | Open | Start with `FORM_PARSER`; evaluate accuracy |
| P2-Q2 | Should we cache Document AI results by image hash? | Open | Low priority; Document AI is fast enough |

## 5. Cross-References

- `docs/3-reference/domains/06-ocr/ocr-pipeline.md` — OCR domain spec (confidence handling, flow)
- `docs/3-reference/tech-specs/backend/file-storage.md` — R2 upload (unchanged)
- `docs/3-reference/tech-specs/frontend/ocr-pipeline.md` — Worker init, regex patterns (deprecated for Tesseract-specific parts)
- `domains/05-receipts/receipt-upload.md` — Image capture and upload flow
- `domains/02-expenses/expense-management.md` — OCR pre-fills expense form fields
- `spec-gaps.md` — gap tracking

## 6. Implementation Dependencies

- **Depends on:** Google Cloud project with Document AI API enabled, `FORM_PARSER` processor created
- **Blocks:** None (consumer integration is swap-only)
- **Consumer integration:** `AddExpenseModal` calls `useGoogleOCR` composable; `useExpenses` stores extracted fields

## 7. Technical Approach

### Convex Action: `convex/functions/ocr.ts`

```typescript
// Input: base64 image + contentType
// Output: { store?, date?, total?, confidence: number, rawText: string, lowConfidence: boolean }
```

- Uses `@google-cloud/documentai` client library with `"use node"` directive
- Auth via Application Default Credentials (ADC) or service account key
- Processor ID from env var `GOOGLE_DOCUMENT_AI_PROCESSOR_ID`
- Extract fields from Document AI entities: `supplier_name`, `invoice_date`, `total_amount`
- Confidence from entity/property/form-field average; `lowConfidence` flag when < 60%
- Input validation: allowlist (JPEG/PNG/HEIC), 5MB limit, magic bytes, max 5000px dimensions
- Rate limiting: 50 requests/day per org/user via `emailRateLimits` table

### Composable: `app/composables/useGoogleOCR.ts`

```typescript
export function useGoogleOCR() {
  const client = useConvexClient();
  const state = ref<OcrState>({ status: "idle", progress: 0 });

  async function processReceipt(file: File, form: Record<string, unknown>) {
    // Upload to Convex storage via uploadReceipt action
    // Call Convex action: api.functions.ocr.processReceipt
    // Handle fallback to Tesseract on error
    // Apply result to form via applyOcrToForm (reused)
  }
}
```

### Frontend Integration

- `app/components/AddExpenseModal.vue`: uses `useGoogleOCR` for receipt upload + OCR
- Progress states: `preprocessing` → `uploading` → `processing` → `done`/`error`
- Store field added to expense form for OCR-extracted merchant name
- Amount field populated from OCR `total` via `applyOcrToForm`
- Receipt `storageId` emitted on submit for expense attachment
- Low confidence warning displayed when OCR confidence < 60%

## 8. Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `GOOGLE_CLOUD_PROJECT` | Google Cloud project ID | Yes |
| `GOOGLE_CLOUD_LOCATION` | Processor location (e.g. `us`, `eu`) | Yes |
| `GOOGLE_DOCUMENT_AI_PROCESSOR_ID` | Form Parser processor ID | Yes |
| `GOOGLE_APPLICATION_CREDENTIALS` | Path to service account key (or ADC) | No (ADC preferred) |

## 9. Testing

- Unit test `ocr.ts` action with mock Document AI response
- Integration test: upload receipt → verify extracted fields
- Fallback test: simulate Document AI failure → verify Tesseract fallback
- Confidence threshold test: <60% shows warning, ≥60% auto-fills
- Input validation tests: invalid type, oversized, magic byte mismatch, dimension limit
- Rate limiting test: daily quota enforcement

## 10. Rollout Plan

1. Deploy Convex action + env vars to dev
2. Test with real receipts in dev
3. Deploy to production
4. Monitor accuracy metrics (compare Document AI vs Tesseract)
5. After 2 weeks, remove Tesseract.js from bundle if stable

## 11. Implementation Summary

### Files Created
- `convex/functions/ocr.ts` — Convex action with "use node" directive for Google Document AI, input validation, rate limiting
- `app/composables/useGoogleOCR.ts` — Vue composable with Document AI + Tesseract fallback, sanitized error logging
- `docs/2-development/01-draft/d17-google-document-ai-ocr.md` — Slice documentation

### Files Modified
- `app/components/AddExpenseModal.vue` — Integrated receipt upload + OCR flow with low-confidence warning
- `convex/auth.ts` — Added AUTH_BYPASS production guard
- `.env.example` — Added Google Document AI environment variables

### Verification
- `npx convex dev --once` — Convex functions deploy successfully
- `npx vue-tsc --noEmit` — TypeScript typecheck passes (0 errors)
- Core tests pass: 150/150 (auth, expenses, settlements, analytics, performance)
- `npm run docs:lint` — 0 errors (warnings only for pre-existing issues)

## 12. Security Fixes Applied

| Review Finding | Fix Applied |
|----------------|-------------|
| H-1: No input validation on OCR action | Mirrors `uploadReceipt`: allowlist, 5MB, magic bytes, 5000px |
| M-1: No rate limiting | 50/day/org/user via `emailRateLimits` table |
| M-2: Document AI error leaks to console | Sanitized to message-only in `useGoogleOCR.ts:82` |
| M-3: AUTH_BYPASS production landmine | Hard guard throws in `auth.ts` if `NODE_ENV === "production"` |

## Lifecycle

- `01-draft` → `02-in-progress`: 09-November-2026
- `02-in-progress` → `03-ready-for-review`: 09-November-2026
- `03-ready-for-review` → `04-implemented`: TBD