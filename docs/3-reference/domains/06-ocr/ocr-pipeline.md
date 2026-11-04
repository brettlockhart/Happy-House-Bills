---
status: Draft
package: app
priority: high
created: 25-October-2026
updated: 25-October-2026
tags: [ocr, ocr-pipeline, tesseract, receipts, frontend]
---

# Domain Spec: OCR Pipeline

**Date:** 25-October-2026
**Status:** Draft
**Audience:** Frontend engineers

## 1. Purpose

Define the OCR pipeline domain: the user-facing flow of photographing a receipt, running Tesseract.js client-side, and pre-filling the expense entry form with extracted fields (store name, date, total amount). The image is processed entirely in the browser — it never leaves the device for OCR processing.

## 2. Scope

### In scope

- Camera capture → image preprocessing → Tesseract.js OCR → field extraction
- Field pre-fill UI: extracted store/date/total shown as editable values in the form
- Confidence scoring: if OCR confidence < 60%, user is prompted to review all fields manually
- Low-confidence fallback: OCR is a convenience, not a replacement for user review
- Error states: worker failure, timeout, unsupported image format
- Progress feedback during worker and language-model loading

### Out of scope

- Tesseract.js worker initialisation (covered by `tech-specs/frontend/ocr-pipeline.md` (## 7. OCR Worker Initialisation))
- R2 receipt upload (covered by `domains/05-receipts/receipt-upload.md`, `tech-specs/backend/file-storage.md`)
- Duplicate detection (covered by `tech-specs/backend/duplicate-detection.md`)
- Regex/heuristic parsing implementation (covered by `tech-specs/frontend/ocr-pipeline.md` (## 9. Field Extraction Regexes))

## 3. Key Decisions

| ID | Decision | Rationale | Source |
|----|----------|-----------|--------|
| D1 | OCR runs entirely client-side (Tesseract.js in browser) | Matches `project_brief.md` (## Tech Stack — "Tesseract.js (client-side, v1)"); keeps receipt images private; no server-side processing cost | `project_brief.md` (## Tech Stack) |
| D2 | Confidence threshold of 60% for auto-accept | Below 60% means the text is unreliable; user review is mandatory | `tech-specs/frontend/ocr-pipeline.md` D3 |
| D3 | Store name heuristic: first non-empty text line in top 30% of image | Receipts consistently have store name at the top; more reliable than key-value parsing | `lexicon.md` |
| D4 | Total extraction via regex `total.*\d+\.\d{2}` | Receipt "total" lines consistently show a decimal amount; currency agnostic | `tech-specs/frontend/ocr-pipeline.md` (## 9. Field Extraction Regexes) |
| D5 | Date extraction via regex `\d{1,2}[/-]\d{1,2}[/-]\d{2,4}` | Matches all common US receipt date formats | `tech-specs/frontend/ocr-pipeline.md` (## 9. Field Extraction Regexes) |
| D6 | OCR runs before upload to R2 | User gets immediate feedback from OCR; upload only happens after form is confirmed | `user-flows.md` (## 2. Receipt Upload & OCR) |

## 4. Open Questions

| ID | Question | Status | Notes |
|----|----------|--------|-------|
| OCR-Q1 | Should OCR pre-fill overwrite user-entered fields, or only populate empty fields? | Resolved | Only populate empty fields — user's manual edits must not be overwritten |

## 5. Cross-References

- `tech-specs/frontend/ocr-pipeline.md` — worker initialization, preprocessing, regex patterns
- `domains/05-receipts/receipt-upload.md` — image capture and upload flow
- `domains/02-expenses/expense-management.md` — OCR pre-fills expense form fields
- `tech-specs/frontend/mobile-compat.md` — lazy worker loading (D7)
- `domains/11-security/security.md` — ## 7. PII Data Catalogue (receipt images), ## 12. Upload Content-Type Allowlist
- `spec-gaps.md` — gap tracking

## 6. Implementation Dependencies

- **Depends on:** `tech-specs/frontend/ocr-pipeline.md`, `receipt-upload.md`
- **Blocks:** `domains/02-expenses/expense-management.md` (form pre-fill during creation)
- **Consumer integration:** `AddExpenseModal` calls `useOCR` composable; `useExpenses` stores extracted fields

## 7. OCR Flow

```
1. User uploads receipt → OCR runs client-side on the image
2. Tesseract.js processes image → returns text + confidence
3. extractFields(text, confidence):
   - Store, date, total extracted from OCR output
   - If confidence >= 60%: auto-fill form fields
   - If confidence < 60%: show warning, prompt manual entry
4. Form pre-fills with extracted values (all editable)
5. User confirms or corrects → image uploaded to R2, expense created
```

## 8. Confidence Handling

```typescript
// app/composables/useOCR.ts
export function useOCRFieldConfidence(confidence: number): "high" | "medium" | "low" {
  if (confidence >= 80) return "high";
  if (confidence >= 60) return "medium";
  return "low";
}

export function shouldAutoFill(confidence: number): boolean {
  return confidence >= 60;
}
```

When confidence is "low", the UI shows:
- A warning banner: "OCR confidence is low — please verify all fields"
- All fields are editable (not pre-filled)
- A "Retake photo" option is available
