# Security Review Report: Happy House Bills Spec-Level Security Review

**Status:** Draft
**Scope:** Spec-level review of 10 security-relevant specs — no code exists; "Pass" means requirements are *specified*, not implemented
**Date:** 25-October-2026
**Reviewer:** Security Engineer (spec-level)
**Verdict:** **Needs revision** — 1 Medium finding (HS-010) where the security requirement is not specified; 4 minor specification inconsistencies

**Source specs reviewed:**
- `tech-specs/backend/file-storage.md`
- `tech-specs/architecture/deployment.md`
- `tech-specs/frontend/ocr-pipeline.md`
- `domains/11-security/security.md`
- `tech-specs/backend/api-contract.md`
- `domains/05-receipts/receipt-upload.md`
- `domains/01-auth/onboarding-auth.md`
- `domains/10-deployment/deployment.md`
- `domains/06-ocr/ocr-pipeline.md`
- `domains/07-duplicates/duplicate-detection.md`

**Referenced docs:** `docs/AGENTS.md`, `spec-gaps.md`, `tech-specs/backend/duplicate-detection.md`, `docs/2-development/supporting-docs/reviews/file-storage-security-review.md` (prior review, now superseded)

---

## Background

A prior spec-level review (`file-storage-security-review.md`, 25-October-2026) found 6 High and 7 Medium/Low findings. That review was written against an earlier version of the specs in which `domains/11-security/security.md` did not yet exist — it was listed as Missing in `spec-gaps.md` §1.

The specs have since been substantially updated. `domains/11-security/security.md` now exists (201 lines) with comprehensive PII data catalogue, retention policy, auth enforcement pattern, webhook verification code, secrets management table, and content-type allowlist with magic bytes. The `file-storage.md` upload/retrieval code now includes `requireAuthenticatedOrg(ctx)`, ownership checks, EXIF stripping, and env-wired signed-URL TTL.

This review re-evaluates all HS checks against the **current** state of the specs.

---

## Scope and Sensitivity

| Field | Value |
|-------|-------|
| Authentication or authorisation | Yes |
| Billing or entitlements | No (no payments in v1) |
| File upload or export | Yes (R2 receipt upload) |
| Iframe, CSP, or preview | No (no iframe/preview/export in v1) |
| User data or PII | Yes (receipt images, expense data, user accounts) |

---

## Security Checklist: Control-by-Control Verification

| Check | What to verify | Status | Evidence | Notes |
|-------|---------------|--------|----------|-------|
| HS-001 | Auth guard `requireAuthenticatedOrg` on every Convex function entry point | **Pass (Spec)** | `api-contract.md` §8 ("Every function begins" pattern); `file-storage.md` §8 line 117 (`uploadReceipt` calls it); `file-storage.md` §9 line 167 (`getReceiptUrl` calls it); `security.md` §9 defines helper; `onboarding-auth.md` §8 defines same | `security.md` §9 and `onboarding-auth.md` §8 both define `requireAuthenticatedOrg` with identical signatures |
| HS-002 | PII retention policy documented with lawful basis and retention period | **Pass (Spec)** | `security.md` §7 (PII Data Catalogue with GDPR lawful basis); `security.md` §8 (Retention Policy with periods) | Lawful bases: Article 6.1.b (contract necessity) for PII; legitimate interest for dHash; N/A for transient OCR text |
| HS-003 | Ownership check on receipt retrieval (storageId belongs to caller's org) | **Pass (Spec)** | `file-storage.md` §9 lines 170–174 (`getReceiptUrl` queries expenses by `receiptImageId` AND filters by `orgId`); `security.md` §10; `file-storage.md` D7 | Cross-tenant IDOR blocked via org-scoped index query |
| HS-004 | Content-type allowlist with magic byte validation server-side | **Pass (Spec)** | `security.md` §12 (allowlist table with magic bytes); `security.md` §12 ("Server-side validation must check both the declared Content-Type and the file's magic bytes") | **Minor inconsistency:** `file-storage.md` §8 code lists `ALLOWED_CONTENT_TYPES = ["image/jpeg", "image/png"]` — omits HEIC which is in `security.md` §12 and D3 |
| HS-005 | Image dimension validation server-side (max 4096×4096 or similar) | **Pass (Spec)** | `file-storage.md` §2 ("max 4000 × 4000 px"); `file-storage.md` §8 (`MAX_DIMENSION = 4096`, `validateImageDimensions(buffer)`); `file-storage.md` D5 | Minor: scope says 4000px, code says 4096px — both acceptable as "or similar" |
| HS-006 | EXIF metadata stripping before storage (GPS, camera serial) | **Pass (Spec)** | `file-storage.md` §8 line 137 (`stripExif(buffer)` before `ctx.storage.store()`); `file-storage.md` D6; `security.md` D4; `receipt-upload.md` §8 (client-side defence-in-depth) | Defence in depth: both client-side (`receipt-upload.md` §8) and server-side (`file-storage.md` §8) stripping specified |
| HS-007 | Signed URL TTL wired into code (not hardcoded) | **Pass (Spec)** | `file-storage.md` §9 line 180 (`process.env.RECEIPT_SIGNED_URL_TTL || 3600`); `file-storage.md` §7 env var table | **Minor gap:** `RECEIPT_SIGNED_URL_TTL` not listed in `deployment.md` §7 environment variables table — new deployers may miss it |
| HS-008 | Tesseract.js version pinned + SRI for CDN language data | **Pass (Spec)** | `tech-specs/frontend/ocr-pipeline.md` §7 (HS-008: "pinned to exact version... integrity attributes with SHA-384 hashes"); `security.md` §13 (SRI enforcement); `ocr-pipeline.md` D1 | **Technical note:** Tesseract.js loads language data via `fetch()`, not `<script>` tags — standard `integrity` attributes may not apply unless Tesseract.js's `worker.loadLanguage()` is configured to verify integrity. The SRI requirement is specified; implementation feasibility should be confirmed at code time |
| HS-009 | Lawful basis documented for OCR text processing | **Pass (Spec)** | `security.md` §7 ("Raw OCR text (transient) — N/A — not persisted"); `domains/06-ocr/ocr-pipeline.md` D1 (client-side, image never leaves device) | OCR text classified as transient browser memory with N/A lawful basis (not persisted); dHash/fingerprint covered by legitimate interest |
| HS-010 | Raw OCR text not rendered as HTML (XSS prevention) | **FAIL (Not specified)** | — | `tech-specs/frontend/ocr-pipeline.md` §9 `extractFields()` returns `raw: text` with no rendering guidance; no mention of XSS prevention, `innerHTML`, `v-html`, or text-only rendering in any spec. If the frontend renders raw OCR text via `innerHTML` or `v-html`, arbitrary text from receipt images could enable stored XSS. |
| HS-012 | Webhook signature verification via `verifyWebhook` from Clerk | **Pass (Spec)** | `deployment.md` §9 (HS-012: "must call `verifyWebhook(payload, CLERK_WEBHOOK_SECRET)` before processing events"); `security.md` §11 (full code listing); `security.md` §13 (rotation) | **Minor inconsistency:** `deployment.md` §9 cites `verifyWebhook` from `@clerk/nuxt`; `security.md` §11 cites it from `@clerk/backend/http` |
| HS-015 | PII retention policy covers all data categories | **Pass (Spec)** | `security.md` §7 (7 PII data elements); `security.md` §8 (7 retention rows covering all categories) | All 7 PII elements mapped to retention entries: email/Clerk-id/org-name → user accounts (30d); expenses → expense records (30d); receipt image → R2 (30d); dHash/fingerprint → expense records; OCR text → browser memory (tab-scoped) |
| HS-016 | R2 API key scoped to single bucket (least-privilege) | **Pass (Spec)** | `file-storage.md` §7 (wrangler.toml `binding = "HHB_RECEIPTS"`, `bucket_name = "hhb-receipts"`); `file-storage.md` §7 HS-016 callout; `security.md` §13 (R2 keys scoped to `hhb-receipts` only, 90-day rotation); `security.md` §13 Cloudflare API token scoping | Fully specified with rotation cadence |

---

## Findings

### SEC-001 — Raw OCR text rendering safety not specified (HS-010)

| Field | Value |
|-------|-------|
| Severity | Medium |
| Map | HS-010 (not specified → Spec) |
| Status | Open |

The `extractFields()` function in `tech-specs/frontend/ocr-pipeline.md` §9 returns `raw: text` — the full OCR-extracted text from the receipt image. None of the 10 reviewed specs specify how this raw text must be rendered in the DOM. If the frontend uses `innerHTML`, `v-html`, or a template binding that does not auto-escape, attacker-controlled receipt text (e.g. `<script>` tags printed on a malicious receipt) would execute in the user's browser context as stored XSS.

The risk is mitigated by Vue's default text interpolation escaping, but the specs do not state this as a requirement. The OCR result is derived from **user-supplied image content** (the receipt), making it untrusted input from a security perspective.

**Required action:** Add a security property to `tech-specs/frontend/ocr-pipeline.md` §9 and `domains/06-ocr/ocr-pipeline.md` specifying that all OCR-extracted text (including `raw` and individual fields) must be rendered via text-only DOM APIs — never `innerHTML` or `v-html`. Reference this as HS-010.

---

### SEC-002 — HEIC missing from file-storage.md content-type allowlist (HS-004 inconsistency)

| Field | Value |
|-------|-------|
| Severity | Low |
| Map | HS-004 (specified in security.md §12, but code example inconsistent) |
| Status | Open |

`security.md` §12 and D3 specify that receipt upload accepts JPEG, PNG, and HEIC. However, `file-storage.md` §8 code defines `ALLOWED_CONTENT_TYPES = new Set(["image/jpeg", "image/png"])` — omitting HEIC. This is a spec-level inconsistency: the security requirement is documented in `security.md` §12, but the code example in `file-storage.md` §8 does not match.

**Required action:** Update `file-storage.md` §8 `ALLOWED_CONTENT_TYPES` to include `"image/heic"`, or explicitly note that HEIC is validated via magic bytes only (not Content-Type) since browser-sent HEIC may use `application/octet-stream`.

---

### SEC-003 — verifyWebhook import source discrepancy (HS-012)

| Field | Value |
|-------|-------|
| Severity | Low |
| Map | HS-012 (specified in both docs, source package differs) |
| Status | Open |

`deployment.md` §9 cites `verifyWebhook` from `@clerk/nuxt`. `security.md` §11 cites `verifyWebhook` from `@clerk/backend/http`. Both are valid Clerk packages with webhook verification, but the correct import for the Convex backend is `@clerk/backend/http` (used server-side), not `@clerk/nuxt` (used client-side via Nuxt middleware). The spec should standardise on the correct import path.

**Required action:** Standardise both `deployment.md` §9 and `security.md` §11 on `verifyWebhook` from `@clerk/backend/http` for the Convex HTTP action.

---

### SEC-004 — RECEIPT_SIGNED_URL_TTL missing from deployment.md env table (HS-007 gap)

| Field | Value |
|-------|-------|
| Severity | Low |
| Map | HS-007 (TTL wired in code, but env var not registered as deployment configuration) |
| Status | Open |

`file-storage.md` §9 wires `process.env.RECEIPT_SIGNED_URL_TTL` into the signed-URL generation code. `file-storage.md` §7 documents the env var. However, `deployment.md` §7 (Environment Variables table) lists 11 variables but omits `RECEIPT_SIGNED_URL_TTL`, along with `R2_BUCKET_NAME`. A deployer following `deployment.md` §7 would not know to set these.

**Required action:** Add `RECEIPT_SIGNED_URL_TTL` and `R2_BUCKET_NAME` to the `deployment.md` §7 environment variables table.

---

## Threat Model

| Asset | Trust boundary | Data flow | Threat | Mitigation | Residual risk |
|-------|---------------|-----------|--------|------------|---------------|
| R2 receipt objects | Browser → Convex action → R2 | User uploads receipt → `uploadReceipt` stores blob → returns storage ID → retrieved via `getReceiptUrl` signed URL | Content spoofing: attacker uploads non-image content with image Content-Type | `security.md` §12 magic-byte validation specified | Low — specified in security.md §12 |
| R2 receipt objects | Same as above | Same as above | IDOR / cross-tenant access: user retrieves another org's receipt | `file-storage.md` §9 ownership check (org-scoped query) | Low — specified in file-storage.md §9, security.md §10 |
| Raw OCR text | Browser DOM | Tesseract worker returns text → form pre-fill | Stored XSS: malicious text on receipt rendered as HTML | **Not specified** | **Medium — HS-010 / SEC-001** |
| R2 keys | CI/secrets store → Convex runtime | R2 access key injected as env var | Credential exposure: overly broad R2 key | `security.md` §13 least-privilege scoping | Low — specified |
| Webhook ingress | Clerk → Convex HTTP endpoint | Clerk sends events to `/webhook/clerk` | Webhook forgery: fake org/user creation | `security.md` §11 `verifyWebhook` | Low — specified (import path inconsistent, see SEC-003) |

---

## N/A Items (spec-level review)

| Item | Reason |
|------|--------|
| Dependency scan (`npm audit`, SBOM) | No code deployed. Should run at slice level. |
| Security tests (`SEC-XXX` IDs) | Deferred to implementation. Per AGENTS.md §12: "Any property table a spec-level review produces should gain a `SEC-` test per property at slice time." |
| CSP headers | N/A — no iframe, preview, or export pipeline in v1 (per `security.md` §2 out-of-scope). *Caveat:* Tesseract.js Web Worker may require CSP `worker-src`/`script-src` allowances; should be specified at implementation. |
| Rate limiting | N/A — `security.md` §2 lists rate limiting as deferred to slice-level review. |
| CSRF protection | N/A — Clerk + Convex handle session management server-side via bearer tokens. |
| Penetration testing | N/A — no deployment to test. Required at slice level. |

---

## Residual Risk

**Residual risk is MEDIUM at the pre-ratification stage.** The prior review (6 High findings) has been substantially addressed by the addition of `domains/11-security/security.md` and updates to `file-storage.md` code examples. All 14 HS checks now pass at the spec level except HS-010 (raw OCR text XSS prevention), which is not specified anywhere.

Four minor specification inconsistencies (SEC-002 through SEC-004) should be resolved before ratification to prevent implementation drift.

---

## Approval

| Decision | Approver | Date | Notes |
|----------|----------|------|-------|
| Needs revision (1 Medium, 4 Low) | Security Engineer (spec-level) | 25-October-2026 | HS-010 is the only un-specified control. 4 minor inconsistencies should be reconciled. A code-level review with `SEC-XXX` tests remains mandatory at implementation time. |

## Next Gate

1. **Specify HS-010:** Add rendering-safety requirement to `tech-specs/frontend/ocr-pipeline.md` §9 and `domains/06-ocr/ocr-pipeline.md` §3 — all OCR-extracted text must be rendered as text-only, never via `innerHTML` or `v-html`.
2. **Resolve SEC-002:** Align `file-storage.md` §8 `ALLOWED_CONTENT_TYPES` with `security.md` §12 (add HEIC).
3. **Resolve SEC-003:** Standardise `verifyWebhook` import path to `@clerk/backend/http` across `deployment.md` §9 and `security.md` §11.
4. **Resolve SEC-004:** Add `RECEIPT_SIGNED_URL_TTL` and `R2_BUCKET_NAME` to `deployment.md` §7 environment variables table.
5. After specs are revised, implement the features, then re-run a code-level (slice) security review with `SEC-XXX` tests for every property in the tables above. A spec-level Pass does not grant release approval.
