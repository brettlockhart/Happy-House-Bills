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

Define the client-side OCR pipeline for Happy House Bills. When a user photographs a receipt, **OpenRouter LLM (vision model via `google/gemini-2.5-flash`)** processes the image in the browser to extract store name, date, and total amount. The extracted fields are then pre-filled into the manual expense entry form, giving the user the opportunity to correct values before submission.

## 2. Scope

### In scope

- OpenRouter vision LLM OCR pipeline via `convex/functions/ocrOpenRouter.ts` action
- Image preprocessing: EXIF stripping for JPEG, magic-byte validation, MIME type matching, size/dimension limits
- Receipt field extraction: store name, date (YYYY-MM-DD), total (decimal), confidence (0-100), raw text, line items
- Low-confidence fallback handling — when OCR confidence is below threshold, prompt user to fill manually
- Form pre-fill UX: populated fields are editable, OCR source is indicated (`ocrSource: "openrouter"`)
- Performance: OCR runs server-side via Convex action; progress events update the UI
- Error handling: OpenRouter rate limiting, timeout, invalid response, fallback to Tesseract.js

### Out of scope

- Server-side OCR (OpenRouter LLM, future — see `project_brief.md`)
- Receipt image storage in R2 (covered by `tech-specs/backend/file-storage.md`)
- Duplicate detection from OCR results (covered by `tech-specs/backend/duplicate-detection.md`)
- Camera capture UX (covered by `tech-specs/frontend/mobile-compat.md`)

## 3. Key Decisions

| ID | Decision | Rationale | Source |
|----|----------|-----------|--------|
| D1 | OpenRouter vision LLM via `google/gemini-2.5-flash` default, configurable via `OPENROUTER_OCR_MODEL` | Server-side API key protection; vision model handles receipts accurately; model swappable without code change | `project_brief.md` D31, `docs/2-development/04-implemented/d17-openrouter-ocr.md` |
| D2 | English-only receipts in Happy House Bills v1 | All target users are English-speaking couples | `project_brief.md` (## Acceptance Criteria) |
| D3 | OCR confidence threshold of 75% for auto-fill | Balances aggressive pre-fill (better UX) with user review (correctness) | `docs/2-development/04-implemented/d17-openrouter-ocr.md` D8 |
| D4 | Store name extracted from OpenRouter JSON-schema response (`store` field) | Structured output is more reliable than positional heuristics | `docs/2-development/04-implemented/d17-openrouter-ocr.md` |
| D5 | Total extracted from OpenRouter JSON-schema response (`total` field) | Structured output is more reliable than regex parsing | `docs/2-development/04-implemented/d17-openrouter-ocr.md` |
| D6 | Date extracted from OpenRouter JSON-schema response (`date` field, validated `YYYY-MM-DD`) | Structured output is more reliable than regex parsing | `docs/2-development/04-implemented/d17-openrouter-ocr.md` |
| D7 | OpenRouter action called lazily — only when user opens the camera/upload flow | Avoids API cost on page load; initial app load stays under 200 KB | `project_brief.md` (## Acceptance Criteria) |

## 4. Open Questions

| ID | Question | Status | Notes |
|----|----------|--------|-------|
| (none) | — | — | — |

## 5. Cross-References

- `tech-specs/frontend/ui-spec.md` — OCR feedback display (loading, confidence indicators)
- `tech-specs/backend/api-contract.md` — `expenses:uploadReceipt` action, `ocrSource` field
- `tech-specs/backend/duplicate-detection.md` — OpenRouter fingerprint (dHash + OCR result fingerprint)
- `domains/05-receipts/receipt-upload.md` — domain-level receipt upload flow
- `spec-gaps.md` — gap tracking

## 6. Implementation Dependencies

- **Depends on:** `data-model.md` (amount, date, category, notes fields), `api-contract.md` (`expenses:uploadReceipt` with `ocrSource`), `ocrOpenRouter.ts` Convex action, `receiptUpgrades.ts` quota tracking
- **Blocks:** `domains/05-receipts/receipt-upload.md`, `domains/02-expenses/expense-management.md`, `d19-line-item-extraction.md`
- **Consumer integration:** `expenses:create` accepts `ocrSource: "openrouter"`; `AddExpenseModal` receives pre-filled values from OpenRouter response; `useReceiptAI` composable for offline-to-online upgrade

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
