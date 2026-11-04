---
status: Draft
package: app
priority: medium
created: 25-October-2026
updated: 25-October-2026
tags: [receipts, upload, r2, storage, file-storage]
---

# Domain Spec: Receipt Upload

**Date:** 25-October-2026
**Status:** Draft
**Audience:** Frontend engineers, backend engineers

## 1. Purpose

Define the receipt upload domain: the end-to-end flow from photo capture to R2 storage and OCR pre-fill. The user photographs a receipt at the register → the image is uploaded to Cloudflare R2 via the `expenses:uploadReceipt` Convex action → the storage ID is returned → the frontend displays a preview → OCR runs client-side to pre-fill the expense form.

## 2. Scope

### In scope

- Camera capture via `<input type="file" accept="image/*" capture="environment">` on mobile
- Image preprocessing: EXIF orientation correction, compression to < 5 MB
- Upload to R2 via `expenses:uploadReceipt` Convex action (returns storage ID)
- Preview display of uploaded receipt
- EXIF metadata stripping before storage (security: prevents GPS leakage)
- Content-Type and extension validation (JPEG, PNG, HEIC only)

### Out of scope

- R2 storage mechanics / `@convex-dev/r2` component (covered by `tech-specs/backend/file-storage.md`)
- API contract / function signatures (covered by `tech-specs/backend/api-contract.md`)
- OCR field extraction (covered by `tech-specs/frontend/ocr-pipeline.md`)
- Convex schema fields (covered by `tech-specs/backend/data-model.md`)
- Duplicate detection from receipt (covered by `tech-specs/backend/duplicate-detection.md`)

## 3. Key Decisions

| ID | Decision | Rationale | Source |
|----|----------|-----------|--------|
| D1 | Use native `<input type="file" capture="environment">` instead of a custom camera component | Works natively on iOS Safari and Android Chrome; no WebRTC permissions prompt; simplest implementation | `tech-specs/frontend/mobile-compat.md` D2 |
| D2 | EXIF orientation corrected in-browser before upload | Mobile cameras embed orientation in EXIF; without correction, OCR fails on rotated receipts and the preview appears sideways | `tech-specs/frontend/mobile-compat.md` D6 |
| D3 | EXIF metadata stripped from image before storage | Receipts may carry GPS location; stripping prevents inadvertent PII leakage | `domains/11-security/security.md` D4 |
| D4 | Image compressed to max 5 MB before upload | Reduces R2 bandwidth costs; matches server-side 5 MB limit | `tech-specs/backend/file-storage.md` (## 8. Upload Handler) | `tech-specs/backend/file-storage.md` D5 |
| D5 | Base64 encoding used for upload (not direct blob POST) | Convex actions accept base64 strings via the Convex SDK; simpler than presigned POST | `tech-specs/backend/file-storage.md` (## 8. Upload Handler) |

## 4. Open Questions

| ID | Question | Status | Notes |
|----|----------|--------|-------|
| REC-Q1 | Should we use direct R2 presigned POST instead of Convex action base64 upload? | Resolved | Stay with Convex action base64 upload — simpler, 5MB limit is sufficient |

## 5. Cross-References

- `tech-specs/backend/file-storage.md` — `expenses:uploadReceipt` action, storage ID lifecycle, size limits
- `tech-specs/backend/api-contract.md` — action input/output types
- `domains/06-ocr/ocr-pipeline.md` — OCR runs on the captured image
- `domains/07-duplicates/duplicate-detection.md` — receipt hashing
- `domains/02-expenses/expense-management.md` — receipt attached during expense creation
- `domains/11-security/security.md` — ## 10. Authz Matrix (authz), ## 12. Upload Content-Type Allowlist
- `spec-gaps.md` — gap tracking

## 6. Implementation Dependencies

- **Depends on:** `file-storage.md`, `api-contract.md`, `ocr-pipeline.md`
- **Blocks:** `domains/02-expenses/expense-management.md` (receipt attachment), `domains/07-duplicates/duplicate-detection.md` (receipt hashing)
- **Consumer integration:** `AddExpenseModal` calls `useOCR` composable for photo capture + preprocessing + upload

## 7. Receipt Upload Flow

```
1. User clicks "Add Photo" in AddExpenseModal
2. Mobile: camera opens via <input type="file" capture="environment">
   Desktop: file picker opens
3. Image selected → preprocessImage(file):
   a. Load as Image object
   b. Draw to canvas at max 1200px width (maintains aspect ratio)
   c. Convert to grayscale, enhance contrast
   d. Strip EXIF metadata (create new canvas without metadata)
   e. Encode as base64 JPEG at quality 0.9
4. Upload via convex.expenses.uploadReceipt({ image: base64String })
5. Receive { storageId } from Convex
6. Display preview: ctx.storage.getUrl(storageId) → <img src={url}>
7. OCR runs on the original image (before R2 upload) for pre-fill
```

## 8. EXIF Stripping

```typescript
// app/utils/imageUtils.ts — client-side EXIF stripping before upload
export async function stripExif(file: File): Promise<File> {
  const img = await loadImage(file);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;
  canvas.width = img.width;
  canvas.height = img.height;
  ctx.drawImage(img, 0, 0);
  // Drawing to a fresh canvas strips EXIF by design
  return canvasToFile(canvas, "image/jpeg", 0.9);
}
```
