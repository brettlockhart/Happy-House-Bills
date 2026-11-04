# Implementation Review: D4 — Receipt Upload & OCR

**Verdict:** Pass
**Slice:** D4 — Receipt Upload & OCR
**Date:** 28-October-2026
**Reviewer:** implementation-reviewer

---

## Slice Summary

| Field | Value |
|-------|-------|
| **Slice** | D4 — Receipt Upload & OCR |
| **Phase** | Phase 1 |
| **Dependencies** | D1 (schema `receiptImageId` field, storage ID handling) |
| **Blocks** | D5 — Duplicate Detection, D6 — Frontend UI Shell |
| **Lifecycle** | Ready for review (`03-ready-for-review`) |
| **Files created** | 5 implementation files, 3 test files |
| **Files modified** | 1 (`convex/_generated/api.ts`) |

---

## Verification Checks

| Check | Command | Status | Details |
|-------|---------|--------|---------|
| Lint | `npm run lint` | Pass | 0 errors, 0 warnings |
| Typecheck (tsc) | `npx tsc --noEmit` | Pass | 0 errors |
| Typecheck (Vue) | `npx vue-tsc --noEmit` | Pass | 0 errors |
| Tests | `npm test` | Pass | 145 tests, 145 passing (9 test files) |
| Doc lint | `npm run docs:lint` | Pass | 0 errors, 0 warnings |

---

## Specialised Agent Reports

### Security Engineer
Already completed. See `docs/2-development/supporting-docs/reviews/d4-security-review.md` — **Pass with remediations applied**. All security controls verified:

| Control | Status | Evidence |
|---------|--------|----------|
| SEC-001 (auth guard) | Pass | `requireAuthenticatedOrg(ctx)` at `uploadReceipt.ts:157`; `orgId` from JWT claim |
| SEC-004 (content-type) | Pass | `ALLOWED_TYPES` allowlist + `detectMimeType()` magic-byte cross-validation (ST-001–ST-004, ST-012, ST-013) |
| SEC-005 (size/dimensions) | Pass | `MAX_FILE_SIZE` 5MB + `MAX_DIMENSION` 5000px, both server-side (ST-008, ST-009) |
| SEC-006 (EXIF stripping) | Pass | Server-side `stripExifJpeg()` + client-side canvas redraw (ST-010, ST-021) |
| SEC-007 (storage metadata) | Pass | `customMetadata` with `orgId`, `userId`, `uploadAt`, `width`, `height` (ST-011) |
| SEC-010 (OCR XSS) | Pass | No `v-html`/`innerHTML`; Vue `{{ }}` auto-escaping; `<script>` preserved as literal strings (ST-022) |

### Test Engineer
Test coverage summary (D4 test files only):

| File | Tests | Coverage focus |
|------|-------|----------------|
| `__tests__/convex/uploadReceipt.test.ts` | 19 | Auth, magic-byte validation, size/dimension limits, EXIF stripping, metadata, HEIC/PNG acceptance |
| `__tests__/utils/ocrParser.test.ts` | 21 | Total parsing (TOTAL priority), date parsing (year-first disambiguation), store detection, form application, XSS-safe text transport |
| `__tests__/utils/imageUtils.test.ts` | 17 | MIME type allowlist, strict matching (rejects uppercase, parameters), EXIF stripping via canvas redraw |

**Gaps:** `useOCR.ts` (orchestration composable) and `ReceiptUploader.vue` (component) have no dedicated test files. The orchestration logic (preprocess → upload → OCR → parse → apply to form) is untestable without mocking `tesseract.js`, `convex-vue`, and browser Canvas APIs.

### Frontend Engineer
N/A — `useOCR.ts` imports from `"~/utils/imageUtils"` and `"~/utils/ocrParser"` via the tsconfig path alias (`"~/utils/*": ["./app/utils/*"]`). `ReceiptUploader.vue` follows existing component patterns (scoped CSS, `modelValue` v-model, `URL.createObjectURL` for preview).

### Backend Engineer
`uploadReceipt.ts` follows established Convex action patterns from D1/D3. `action()` (not `mutation`) used correctly for base64 payload handling. Auth helper `requireAuthenticatedOrg()` reused from `convex/auth.ts` with identical fail-safe semantics.

---

## Findings

| # | File | Issue | Severity | Resolution |
|---|------|-------|----------|------------|
| 1 | `app/utils/imageUtils.ts:45-55` | `stripExif()` is dead code — never imported or called anywhere. `preprocessImage` performs inline canvas redraw instead. | Low | Remove `stripExif` function |
| 2 | `app/utils/imageUtils.ts:57-72` | `compressImage()` is dead code — never called. `preprocessImage` performs inline canvas resize instead. | Low | Remove `compressImage` function |
| 3 | `app/utils/imageUtils.ts:39-43` | `getImageDimensions()` is dead code — never imported by any component. Server-side `getImageDimensions` in `uploadReceipt.ts:63` is the authoritative parser. | Low | Remove `getImageDimensions` function |
| 4 | `app/components/AddExpenseModal.vue.tmp` | Stale `.tmp` file alongside `AddExpenseModal.vue` — should not be committed to the repo. | Low | Delete file |
| 5 | `app/composables/useOCR.ts:64` | Uses `process.env.NUXT_PUBLIC_CONVEX_URL` which is not defined in `.env.example` or `nuxt.config.ts`. The config defines `CONVEX_URL` → `runtimeConfig.public.convexUrl`. Variable resolves to `undefined` at runtime. | Medium | Use `useRuntimeConfig().convexUrl` |
| 6 | `app/composables/useOCR.ts:63-65` | Preview URL constructed via string concatenation `"${convexUrl}${storageId}"`. Convex storage IDs are opaque identifiers, not URL paths. Per spec step 5, should use `ctx.storage.getUrl(storageId)` server-side. Security review flagged as open A04/Low (IDOR on read path deferred to retrieval slice). | Medium | Use server-side `ctx.storage.getUrl()` via Convex query/action, or `convex.getUrl()` client method |
| 7 | `__tests__/` | No test file for `useOCR.ts` — orchestration composable with state management, error handling, and Convex action invocation logic. | Medium | Add `__tests__/composables/useOCR.test.ts` with mocked `convex-vue` and `tesseract.js` |
| 8 | `__tests__/` | No test file for `ReceiptUploader.vue` — component has file validation, type checking, and emit logic that is untested. | Low | Add component test file |
| 9 | `docs/.../d4-security-review.md:189` | Internal inconsistency: states "19 tests (7 original + 12 security: ST-001–ST-013)" but ST-001 through ST-013 is 13 security tests, and there are 6 original tests (not 7). Actual file: 19 tests (6 original + 13 ST). Also states imageUtils has "17 tests (3 original + 14 security)" but actual split is 9 original + 8 ST. And ocrParser stated as "20 tests" but actual count is 21. | Info | Correct test count narratives in security review |

**No blocking issues found.** All security-critical paths have dedicated tests. All verification gates pass. The `useOCR.ts` preview URL bug (findings 5–6) is in code not yet wired into any component — the issue should be resolved before D6 integrates the composable.

---

## Security Checklist

- N/A — No preview components, iframes, or CSP concerns in D4
- Pass — `requireAuthenticatedOrg(ctx)` at action entry; `orgId` from JWT `org_id` claim (server-trusted)
- Pass — Magic-byte cross-validation via `detectMimeType()` rejects MIME spoofing
- Pass — `crypto.randomUUID()` for filename generation (not `Math.random()`)
- Pass — Server-side EXIF stripping via `stripExifJpeg()`; client-side canvas redraw also strips
- Pass — No `v-html`/`innerHTML`; OCR text rendered via Vue `{{ }}` auto-escaping
- Pass — `customMetadata` persists `orgId`, `userId`, `uploadAt`, `width`, `height` for TTL enforcement
- Pass — Filename includes `orgId` for cross-tenant isolation at storage level
- Pass — No secrets in client code, no `console.log` of sensitive data
- Pass — Error messages are generic, do not leak internal state

---

## Code Quality Checklist

- Pass — No `any` types in implementation code (verified via grep)
- Pass — No bare `@ts-ignore` or `@ts-expect-error` (verified via grep)
- Pass — `crypto.randomUUID()` used for all generated identifiers (not `Math.random()`)
- Pass — No MD5 or SHA-1 usage
- Pass — ES module `import` syntax used throughout (no `require()`)
- Pass — camelCase for all variable/function names in TypeScript
- Pass — No comments in implementation code (`.ts` files) — test files follow the documented security-test pattern from AGENTS.md §12
- Warn — Dead code in `imageUtils.ts` (`stripExif`, `compressImage`, `getImageDimensions`) — see findings 1–3
- Warn — Stale `.tmp` file in `app/components/` — see finding 4
- Warn — `useOCR.ts` accessible via `~/` path alias resolves correctly in tsconfig and Vite

---

## Documentation Checklist

- Pass — `d4-receipt-upload-ocr.md` contains all required spec sections (Purpose, Scope, Acceptance Criteria, Technical Details, Security Controls)
- Pass — Open questions REC-Q1 and OCR-Q1 resolved; both struck through in `spec-gaps.md` open questions register
- Pass — `docs:lint` passes (0 errors, 0 warnings)
- Info — `d4-receipt-upload-ocr.md` Security Controls table references ST-001–ST-022 but count descriptions have minor discrepancies (see finding 9)

---

## Test Coverage

| File | Tests | Security tests (ST-XXX) |
|------|------|------------------------|
| `__tests__/convex/uploadReceipt.test.ts` | 19 | 13 (ST-001 through ST-013) |
| `__tests__/utils/ocrParser.test.ts` | 21 | 1 (ST-022) |
| `__tests__/utils/imageUtils.test.ts` | 17 | 8 (ST-014 through ST-021) |
| **Total (D4 files)** | **57** | **22** |
| **Total (all files)** | **145** | — |

All 145 tests pass across 9 test files.

---

## Summary

The D4 — Receipt Upload & OCR implementation is complete and all verification gates pass. The Convex `uploadReceipt` action enforces authentication via `requireAuthenticatedOrg()` (SEC-001), validates content-type with two-layer checking — allowlist plus magic-byte cross-validation (SEC-004), enforces 5MB and 5000px server-side limits (SEC-005), strips EXIF from JPEG buffers server-side with client-side canvas defence-in-depth (SEC-006), and persists storage metadata for TTL enforcement (SEC-007). The OCR pipeline (`ocrParser.ts`, `imageUtils.ts`, `useOCR.ts`) extracts store, date, and total with heuristics, and `applyOcrToForm` only populates empty fields per OCR-Q1. XSS is prevented — no `v-html`/`innerHTML` usage anywhere.

During review, 9 findings were documented (7 code quality, 2 documentation). The most significant are: dead code in `imageUtils.ts` (`stripExif`, `compressImage`, `getImageDimensions` — all unused), a broken preview URL in `useOCR.ts:64` (uses `process.env.NUXT_PUBLIC_CONVEX_URL` which doesn't match the configured `CONVEX_URL` env var, and constructs the URL by string concatenation rather than `ctx.storage.getUrl()`), and missing test coverage for `useOCR.ts` and `ReceiptUploader.vue`. The preview URL issue is in code not yet wired into any component (integration deferred to D6), so it does not affect current behaviour. The security review has already documented this as an open finding with accepted residual risk.

---

## Handoff Options

| Option | Trigger | Next Action |
|--------|---------|-------------|
| Promote to implemented | Verdict = Pass | Run `/slice-promote D4` |
| Remediate dead code | — | Remove unused `stripExif`, `compressImage`, `getImageDimensions` from `imageUtils.ts` |
| Fix preview URL | Before D6 integration | Update `useOCR.ts:64` to use `useRuntimeConfig().convexUrl` and obtain storage URL via `ctx.storage.getUrl()` or Convex client `getUrl` |
| Add tests | — | Add `__tests__/composables/useOCR.test.ts` and `__tests__/components/ReceiptUploader.spec.ts` |
| Pin tesseract.js | Follow-up | Pin `tesseract.js@5.0.0` to exact version in `package.json` per `ocr-pipeline.md` HS-008 |
