---
status: Draft
package: frontend
priority: high
created: 25-October-2026
updated: 25-October-2026
tags: [frontend, ocr, tesseract, receipts, image-processing]
---

# Tech Spec: OCR Pipeline

**Date:** 25-October-2026
**Status:** Draft
**Audience:** Frontend engineers

## 1. Purpose

Define the client-side OCR pipeline for Happy House Bills. When a user photographs a receipt, Tesseract.js processes the image in the browser to extract the store name, date, and total amount. The extracted fields are then pre-filled into the manual expense entry form, giving the user the opportunity to correct values before submission.

## 2. Scope

### In scope

- Tesseract.js worker initialisation and language data loading (English only in v1)
- Image preprocessing: grayscale conversion, contrast enhancement, noise reduction before OCR
- Receipt field extraction: store name (top of receipt), date (regex-matched), total (bottom of receipt)
- Low-confidence fallback handling — when OCR confidence is below threshold, prompt user to fill manually
- Form pre-fill UX: populated fields are editable, OCR source is indicated
- Performance: OCR runs off the main thread via Web Worker; progress events update the UI
- Error handling: worker failure, unsupported image format, timeout

### Out of scope

- Server-side OCR (Google Document AI, future — see `project_brief.md`)
- Receipt image storage in R2 (covered by `tech-specs/backend/file-storage.md`)
- Duplicate detection from OCR results (covered by `tech-specs/backend/duplicate-detection.md`)
- Camera capture UX (covered by `tech-specs/frontend/mobile-compat.md`)

## 3. Key Decisions

| ID | Decision | Rationale | Source |
|----|----------|-----------|--------|
| D1 | Tesseract.js v5 via npm package with pinned version; language data fetched from jsdelivr CDN with SRI | No server-side compute needed; respects user privacy; works offline-capable in v1 | `project_brief.md` D31, `domains/11-security/security.md` (## 13. Secrets Management — SRI enforcement) |
| D2 | English language model only in Happy House Bills v1 | All target users are English-speaking couples; reduces initial load to ~8 MB | `project_brief.md` (## Acceptance Criteria) |
| D3 | OCR confidence threshold of 60% for auto-fill | Balances aggressive pre-fill (better UX) with user review (correctness) | Adapted from UIBuilder OCR pattern |
| D4 | Store name extracted via positional heuristic (top 30% of image) | Receipts consistently have the store name at the top; more reliable than key-value parsing | `user-flows.md` (## 2. Receipt Upload & OCR) |
| D5 | Total extracted via regex: `total.*\d+\.\d{2}` | Receipt "total" lines consistently show a decimal amount; this regex is currency-agnostic | `user-flows.md` (## 2. Receipt Upload & OCR) |
| D6 | Date extracted via regex: `\d{1,2}[/-]\d{1,2}[/-]\d{2,4}` | Matches all common US receipt date formats; user confirms before submission | `user-flows.md` (## 2. Receipt Upload & OCR) |
| D7 | Worker loaded lazily — only when user opens the camera/upload flow | Avoids 8 MB download on page load; initial app load stays under 200 KB | `project_brief.md` (## Acceptance Criteria) |

## 4. Open Questions

| ID | Question | Status | Notes |
|----|----------|--------|-------|
| (none) | — | — | — |

## 5. Cross-References

- `tech-specs/frontend/ui-spec.md` — OCR feedback display (loading, confidence indicators)
- `tech-specs/backend/file-storage.md` — uploadReceipt action that receives the base64 image
- `tech-specs/backend/duplicate-detection.md` — fingerprint generated from OCR-extracted fields
- `domains/05-receipts/receipt-upload.md` — domain-level receipt upload flow
- `tech-specs/backend/api-contract.md` — `expenses:uploadReceipt` action
| `domains/11-security/security.md` — ## 13. Secrets Management (SRI enforcement, CSP for Tesseract.js worker) |
- `spec-gaps.md` — gap tracking

## 6. Implementation Dependencies

- **Depends on:** `data-model.md` (amount, date, category, notes fields), `file-storage.md` (uploadReceipt action)
- **Blocks:** `domains/05-receipts/receipt-upload.md`, `domains/02-expenses/expense-management.md`
- **Consumer integration:** Frontend `useOCR` composable wraps Tesseract.js; `AddExpenseModal` receives pre-filled values

## 7. OCR Worker Initialisation

```typescript
// app/composables/useOCR.ts
import { createWorker } from "tesseract.js";

export const useOCR = () => {
  const worker = ref<any>(null);
  const isLoaded = ref(false);
  const progress = ref(0);

  const initWorker = async () => {
    worker.value = await createWorker({
      logger: (m: any) => {
        if (m.status === "progress") {
          progress.value = m.progress * 100;
        }
      },
    });

    await worker.value.load();
    await worker.value.loadLanguage("eng");
    await worker.value.initialize("eng");
    isLoaded.value = true;
  };

  return { worker, isLoaded, progress, initWorker };
};
```

**HS-008 (SRI + version pinning):** `tesseract.js` must be pinned to an exact version in `package.json` (not `^5.x.x`). Language data files (`.traineddata`) fetched from `cdn.jsdelivr.net` must include `integrity` attributes with SHA-384 hashes. See `domains/11-security/security.md` (## 13. Secrets Management — SRI enforcement).

## 8. Image Preprocessing

```typescript
// app/utils/ocrPreprocessing.ts
export async function preprocessImage(file: File): Promise<File> {
  const img = await loadImage(file);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;
  canvas.width = Math.min(img.width, 1200);
  canvas.height = (img.height / img.width) * canvas.width;
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  // Enhance contrast for receipt OCR
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    data[i] = data[i + 1] = data[i + 2] = gray;
  }
  ctx.putImageData(imageData, 0, 0);

  return canvasToFile(canvas, "image/jpeg", 0.9);
}
```

## 9. Field Extraction Regexes

```typescript
// app/utils/ocrParsing.ts
export const OCR_PATTERNS = {
  // Total: looks for "total" followed by a number with cents
  total: /total\s*\$?\s*(\d+\.\d{2})/i,

  // Date: supports MM/DD/YY, MM-DD-YYYY, M/D/YYYY etc.
  date: /\b(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})\b/,

  // Store name: heuristic — first non-empty line in the top 30% of text
  // Not a regex; uses positional logic
};

export function extractFields(ocrResult: Tesseract.Parsing.Result) {
  const text = ocrResult.data.text;

  const totalMatch = text.match(OCR_PATTERNS.total);
  const dateMatch = text.match(OCR_PATTERNS.date);

  const total = totalMatch ? parseFloat(totalMatch[1]) : undefined;
  const date = dateMatch ? parseDate(dateMatch[1]) : undefined;

  // Store name: first line of text (positional heuristic)
  const lines = text.trim().split("\n").filter((l) => l.trim().length > 0);
  const store = lines[0]?.trim();

  const confidence = ocrResult.data.confidence;

  return {
    store,
    date,
    total,
    confidence,
    raw: text,
  };
}

**HS-010 (XSS prevention):** The `raw` OCR text field must **never** be rendered via `innerHTML`, `v-html`, or `dangerouslySetInnerHTML`. Always render OCR-extracted text using Vue's text interpolation (`{{ text }}`), which automatically HTML-escapes content. Receipt text is user-supplied and could contain malicious scripts (e.g. if a receipt was printed with `<script>` tags). See `domains/11-security/security.md` (## 12. Upload Content-Type Allowlist — magic byte validation) for defence-in-depth on the upload side.
```
