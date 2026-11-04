# D4 — Test Coverage Report

## Summary

| Metric | Value |
|--------|-------|
| Total statements | 272 |
| Covered statements | 194 |
| Statement coverage | 71.3% |
| Total branches | 201 |
| Covered branches | 154 |
| Branch coverage | 76.6% |
| Total functions | 36 |
| Covered functions | 27 |
| Function coverage | 75.0% |
| Tests | 145 passed (9 files; 3 new D4 test files, 57 new tests) |

**Note:** `app/composables/useOCR.ts` (116 lines) could not be instrumented by the v8 coverage provider due to an alias resolution failure (`~/convex/_generated/api` import). It is analysed manually below. `app/components/ReceiptUploader.vue` has zero tests and 0% coverage.

## File-by-File Analysis

### convex/functions/uploadReceipt.ts

| Metric | Value |
|--------|-------|
| % Stmts | 87.75% |
| % Branch | 93.93% |
| % Funcs | 100% |
| % Lines | 90.21% |

**Uncovered lines:** 20, 92-93, 128-131, 134-136

**Covered:**
- `requireAuthenticatedOrg` auth guard at handler entry (SEC-001, ST-001)
- Content-Type allowlist validation — JPEG, PNG, HEIC only (SEC-004, ST-004)
- Magic-byte cross-validation via `detectMimeType()` — JPEG `FF D8 FF`, PNG `89 50 4E 47`, HEIC `ftyp` (ST-001–ST-004)
- Content-Type/MIME mismatch rejection (ST-001, ST-002, ST-003)
- 5MB file size enforcement — server-side buffer length check (SEC-005, ST-008)
- 5000px dimension enforcement — `parseJpegDimensions` SOF0 marker, `parsePngDimensions` IHDR (ST-009)
- Server-side EXIF stripping via `stripExifJpeg()` — APP1 marker removal (SEC-006, ST-010)
- Storage metadata: `customMetadata` with `orgId`, `userId`, `uploadAt`, `width`, `height` (SEC-007, ST-011)
- Filename uses `crypto.randomUUID()` with JWT-derived `orgId` prefix (ST-005, ST-006)
- Response embeds server-derived `orgId`, `userId`, dimensions, `uploadAt` (ST-007)
- Valid JPEG, PNG, and HEIC happy-path uploads returning storage ID (ST-012, ST-013)
- `detectMimeType` returns `null` for unrecognized magic bytes (ST-004)

**Uncovered code analysis:**
- **Line 20** — `return "jpg";` default case in `getExtension()`. Unreachable in normal operation: `args.contentType` is validated against `ALLOWED_TYPES` before `getExtension` is called. If a new MIME type were added to the allowlist without updating the switch, it would silently default to `.jpg`. Low severity.
- **Lines 92-93** — `if (marker >= 0xd0 && marker <= 0xd7)` RST marker skip in `parseJpegDimensions()`. Test JPEG buffers (constructed via `makeJpegBuffer`) contain only APP0 and SOF0 markers plus EOI; no restart markers. This is a dimension-parsing helper, not security-critical.
- **Lines 128-131** — `if (marker === 0xda)` SOS (Start of Scan) handling in `stripExifJpeg()`. Copies remaining bytes after SOS and breaks. Test JPEGs have no compressed image data (SOS marker), so this path is not exercised. If a real JPEG with SOSc marker is uploaded, this branch would execute but the APP1 stripping on earlier bytes has already occurred. Low risk: the APP1 segment is always before SOS, so EXIF removal still happens correctly.
- **Lines 134-136** — `if (marker >= 0xd0 && marker <= 0xd7)` RST marker handling in `stripExifJpeg()`. Same as above — test JPEGs lack restart markers.

**Uncovered branches:**
- `if (buffer.length < 2)` in `getImageDimensions()` — never false because all test buffers are ≥ 12 bytes
- `if (buffer.length < 24)` in `parsePngDimensions()` — never false because test PNG buffer is 33 bytes
- `switch` default in `getExtension()` — same as line 20 above
- `marker === 0xd9` (EOI) branch in `stripExifJpeg()` — covered (test JPEGs have EOI at end)

### app/utils/imageUtils.ts

| Metric | Value |
|--------|-------|
| % Stmts | 57.14% |
| % Branch | 100% |
| % Funcs | 64.28% |
| % Lines | 57.69% |

**Uncovered lines:** 40-71

**Covered:**
- `isAllowedFileType()` — all 11 tests (JPEG, PNG, HEIC allow; PDF, GIF, empty, text/html, octet-stream, svg+xml, uppercase spoofing, parameter spoofing — ST-014–ST-018)
- `preprocessImage()` — file type rejection paths (ST-019, ST-020)
- `fileToDataUrl()` — data URL conversion (2 tests)

**Uncovered code analysis:**
- **`getImageDimensions()`** (lines 39-43) — Not directly tested. Called internally during preprocessing but the canvas-based approach makes mocking difficult in happy-dom. No security tests.
- **`stripExif()`** (lines 45-55) — Standalone EXIF stripping via canvas redraw. Not tested independently. The server-side `stripExifJpeg()` in uploadReceipt.ts is tested (ST-010) and serves as the authoritative EXIF-stripping control (SEC-006). Client-side canvas redraw is a defence-in-depth measure.
- **`compressImage()`** (lines 57-72) — Standalone image compression. Not tested. `preprocessImage()` contains its own inline compression logic (not calling `compressImage`), so this function is effectively dead code in the current architecture. Should be removed or wired into `preprocessImage`.

**Uncovered branches:** 100% branch coverage because the only tested functions (`isAllowedFileType`, `preprocessImage`) have no conditional branches. The untested functions (`getImageDimensions`, `stripExif`, `compressImage`) contribute untested branches that don't appear in the coverage report because they are never called.

### app/utils/ocrParser.ts

| Metric | Value |
|--------|-------|
| % Stmts | 89.41% |
| % Branch | 74.68% |
| % Funcs | 100% |
| % Lines | 89.33% |

**Uncovered lines:** 51, 135-142

**Covered:**
- `parseTotal()` — TOTAL, SUBTOTAL (primary), AMOUNT DUE, BALANCE DUE, GRAND TOTAL patterns, same-line amount extraction, last-match fallback
- `parseDate()` — MM/DD/YYYY, MM/DD/YY, YYYY-MM-DD, month name formats, dash-separated dates, no-match returns undefined
- `parseStore()` — merchant name extraction, skip patterns (invoice, receipt, THANK YOU, etc.), first valid line selection, empty text handling
- `parseOcrText()` — full result object construction
- `applyOcrToForm()` — populates empty fields, does not overwrite user input, string-to-float parsing
- `applyOcrToForm()` XSS safety — script tags stored as literal strings (ST-022)

**Uncovered code analysis:**
- **Line 51** — `return line;` in `parseStore()`. This is the `upper === upper.replace(/[^A-Z]/g, "").slice(0, 4)` branch, which matches lines that are ≤4 uppercase characters (e.g., "CVS", "WALM"). The test cases use "TARGET" (6 chars) and "WALMART SUPERCENTER" (18 chars), both exceeding the 4-character threshold, so they hit the next `if` branch instead. This path handles very short all-caps store names. Low severity.
- **Lines 135-142** — SUBTOTAL fallback path in `parseTotal()`. The `fallbackPatterns` loop (SUBTOTAL, SUB TOTAL) is never triggered because all `parseTotal` tests use primary patterns (TOTAL, AMOUNT DUE, etc.) which match first. The code after the fallback loop (final last-match extraction, line 147-150) IS covered by the "extracts last currency amount as fallback" test. The uncovered lines are the SUBTOTAL-specific extraction logic (next-line and same-line money matching within the fallback loop).

### app/composables/useOCR.ts

| Metric | Value |
|--------|-------|
| % Stmts | 0% (not instrumented) |
| % Branch | — |
| % Funcs | — |
| % Lines | — |

**Uncovered:** All 116 lines.

`useOCR.ts` could not be instrumented by the v8 coverage provider due to an alias resolution failure when parsing the `~/convex/_generated/api` import. **No test file exists** for this composable.

**Code analysis:**
- `processReceipt()` orchestrates: `preprocessImage` → `client.action(api.uploadReceipt)` → Tesseract.js OCR → `parseOcrText` → `applyOcrToForm`. Each step is individually tested, but the orchestration with mocked Convex client and Tesseract is not covered.
- `reset()` — trivial state reset, not tested.
- Error handling path (catch block, lines 97-104) — sets error state and re-throws. Not tested.
- Progress tracking (lines 51, 56, 72, 78-81, 87-94) — not tested.
- The composable depends on `convex-vue`'s `useConvexClient()`, which would need mocking for unit testing.

### app/components/ReceiptUploader.vue

| Metric | Value |
|--------|-------|
| % Stmts | 0% |
| % Branch | 0% |
| % Funcs | 0% |
| % Lines | 0% |

**Uncovered lines:** 2-76 (all script logic)

**Covered:** None — no component tests exist.

**Code analysis:**
- `previewUrl` computed property (lines 38-41) — generates object URL from File, no tests.
- `handleFileSelect()` (lines 46-67) — file validation (allowed types, 5MB size), emits events, resets input. Client-side validation only; server-side enforcement exists in uploadReceipt.ts (SEC-004, SEC-005).
- `clearImage()` (lines 69-73) — emits null value, resets error. Not tested.
- `watch(previewUrl)` (line 75-77) — URL revocation on change. Not tested.
- Template rendering (v-if/v-else branches for preview vs upload label, error display) — no component tests.

## Security Test Verification (ST-001–ST-022)

All 22 security test cases are present and passing:

| ID | Test | File | Verified |
|----|------|------|----------|
| ST-001 | PNG bytes with JPEG content-type rejected | uploadReceipt.test.ts | ✅ |
| ST-002 | JPEG bytes with PNG content-type rejected | uploadReceipt.test.ts | ✅ |
| ST-003 | JPEG bytes with HEIC content-type rejected | uploadReceipt.test.ts | ✅ |
| ST-004 | Unrecognized magic bytes rejected | uploadReceipt.test.ts | ✅ |
| ST-005 | Filename uses crypto.randomUUID (not Math.random) | uploadReceipt.test.ts | ✅ |
| ST-006 | Filename uses JWT-derived orgId (not client-supplied) | uploadReceipt.test.ts | ✅ |
| ST-007 | Response embeds server-derived orgId and userId | uploadReceipt.test.ts | ✅ |
| ST-008 | Server enforces 5MB size limit | uploadReceipt.test.ts | ✅ |
| ST-009 | Server rejects images exceeding 5000px | uploadReceipt.test.ts | ✅ |
| ST-010 | EXIF APP1 segment stripped from JPEG before storage | uploadReceipt.test.ts | ✅ |
| ST-011 | Storage metadata (orgId, userId, uploadAt, width, height) via customMetadata | uploadReceipt.test.ts | ✅ |
| ST-012 | Valid HEIC file with correct magic bytes accepted | uploadReceipt.test.ts | ✅ |
| ST-013 | Valid PNG file with correct magic bytes accepted | uploadReceipt.test.ts | ✅ |
| ST-014 | text/html disguised as image rejected | imageUtils.test.ts | ✅ |
| ST-015 | application/octet-stream rejected | imageUtils.test.ts | ✅ |
| ST-016 | image/svg+xml rejected | imageUtils.test.ts | ✅ |
| ST-017 | Uppercase spoofed content type (image/JPEG) rejected | imageUtils.test.ts | ✅ |
| ST-018 | Content-Type with parameters (image/jpeg; charset=utf-8) rejected | imageUtils.test.ts | ✅ |
| ST-019 | preprocessImage relies on browser-reported MIME type (server validates magic bytes) | imageUtils.test.ts | ✅ |
| ST-020 | File with empty MIME type rejected | imageUtils.test.ts | ✅ |
| ST-021 | Canvas redraw produces JPEG output (EXIF-stripped) | imageUtils.test.ts | ✅ |
| ST-022 | Script tags preserved as literal string (XSS-safe transport) | ocrParser.test.ts | ✅ |

## Untested Security-Critical Paths

### High Priority (Security Concerns)

- [ ] **`stripExifJpeg()` SOS marker path** (uploadReceipt.ts:127-131) — The SOS (Start of Scan) marker handler in `stripExifJpeg()` is not tested. While the APP1 marker (which contains EXIF) always precedes SOS in valid JPEGs, a malformed or strategically crafted JPEG could place markers after SOS. The current implementation copies all post-SOS bytes verbatim, which is correct behaviour but untested. Adding a test with a full JPEG structure (SOI + APP1 + SOF0 + SOS + scan data + EOI) would verify the complete stripping path.
- [ ] **`stripExifJpeg()` RST marker path** (uploadReceipt.ts:133-136) — Restart markers (RST0-RST7, 0xD0-0xD7) in `stripExifJpeg()` are not tested. A JPEG with restart markers interleaved between markers would exercise this path. If the restart marker handling were buggy, it could corrupt the output or leave APP1 data intact.
- [ ] **`useOCR.ts` error handling** — The catch block (lines 97-104) sets error state and re-throws. If the Convex upload action throws a security-related error (e.g., content-type mismatch), the error propagates but the state management paths are untested.
- [ ] **`ReceiptUploader.vue` file validation** — All client-side validation (type allowlist, 5MB size check) is untested. While server-side enforcement exists (SEC-004, SEC-005), the client-side rejection provides immediate UX feedback that is not verified.
- [ ] **`stripExif()` and `compressImage()` standalone functions** (imageUtils.ts:45-72) — Not tested. `stripExif()` is a client-side EXIF removal function that runs before upload. While server-side `stripExifJpeg()` is tested (SEC-006), the client-side defence is unverified. `compressImage()` appears to be dead code (preprocessImage has its own inline compression).

### Medium Priority (Remaining)

- [ ] **`getExtension()` default case** (uploadReceipt.ts:20) — Returns "jpg" for unknown types. Unreachable currently, but no defensive guard.
- [ ] **`parseStore()` uppercase branch** (ocrParser.ts:51) — Short all-caps store names (≤4 chars) not tested.
- [ ] **`parseTotal()` SUBTOTAL fallback** (ocrParser.ts:135-142) — The SUBTOTAL fallback extraction (next-line and same-line money matching) is untested.
- [ ] **`getImageDimensions()`, `detectMimeType()` edge cases** — Sub-12-byte buffer (detectMimeType) and sub-2-byte buffer (getImageDimensions) rejection paths not tested.
- [ ] **`useOCR.ts` happy path** — Full orchestration (preprocess → upload → OCR → parse → apply) with mocked Convex client and Tesseract not tested.
- [ ] **`ReceiptUploader.vue` component behaviour** — Preview display, remove button, error message rendering, v-if/v-else branches.

### Low Priority

- [ ] **`parseJpegDimensions()` non-SOF0 marker skipping** (uploadReceipt.ts:92-93, 101) — RST and non-critical markers in JPEG parsing not tested with realistic JPEG structures.
- [ ] **`useOCR.ts` progress tracking** — Tesseract logger callback (lines 78-81) updating progress percentage not tested.
- [ ] **`useOCR.ts` reset()** — State reset not tested.

## Recommendations

1. **High:** Add a test with a complete JPEG structure (including SOS marker and compressed image data) to exercise the full `stripExifJpeg()` path. This is the most critical untested security path.
2. **High:** Add component tests for `ReceiptUploader.vue` using `@vue/test-utils` — verify file type rejection, size rejection, preview display, and remove button behaviour.
3. **High:** Add tests for `useOCR.ts` with mocked Convex client and Tesseract — cover both happy path and error handling.
4. **Medium:** Test `stripExif()` and `compressImage()` in `imageUtils.ts` using mocked canvas (happy-dom). Verify EXIF is stripped from the output data URL.
5. **Medium:** Add `parseTotal()` test for SUBTOTAL fallback (lines 135-142).
6. **Medium:** Add `parseStore()` test for short all-caps store names (line 51).
7. **Low:** Add edge-case tests for `detectMimeType()` with sub-12-byte buffers and `getImageDimensions()` with sub-2-byte buffers.
8. **Info:** `compressImage()` in `imageUtils.ts` (lines 57-72) appears to be dead code — `preprocessImage()` contains its own inline compression logic and does not call `compressImage()`. Recommend removing it or wiring it into `preprocessImage()`.

**Current coverage for D4 scope:** 71.3% statements, 76.6% branches, 75% functions across instrumented files. Excluding `ReceiptUploader.vue` (0%, no component tests) and `useOCR.ts` (0%, not instrumented, no tests), the covered files average 79-90% statement coverage. This meets the 80%+ target for security-relevant paths in `uploadReceipt.ts` (87.75%) and `ocrParser.ts` (89.41%). The uncovered code is primarily: (a) JPEG parser edge cases in `stripExifJpeg()` and `parseJpegDimensions()`, (b) untested standalone utility functions in `imageUtils.ts`, and (c) the complete absence of tests for `useOCR.ts` and `ReceiptUploader.vue`.
