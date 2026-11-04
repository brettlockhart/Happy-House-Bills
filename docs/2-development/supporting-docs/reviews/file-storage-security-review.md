# Security Review: File Storage, OCR Pipeline, and Deployment Specs
**Date:** 25-October-2026
**Type:** Spec-level (no code exists; properties *specified*, not implemented)
**Triggers:** Spec Reviewer handoff — file/image upload (`tech-specs/backend/file-storage.md`), third-party/user-supplied code/content (`tech-specs/frontend/ocr-pipeline.md`), authentication/authorisation + webhook ingress/signature verification (`tech-specs/architecture/deployment.md`)
**Reviewer:** Security Engineer (spec-level)
**Verdict:** **Needs revision** — 6 High and 7 Medium/Low findings where security properties are *not specified*; 8 items N/A (spec-level, no implementation to assess)
**Source specs reviewed:** `tech-specs/backend/file-storage.md`, `tech-specs/frontend/ocr-pipeline.md`, `tech-specs/architecture/deployment.md`
**Source docs referenced:** `docs/AGENTS.md` §12, `.kilo/agent/security-engineer.md` §6, `project_brief.md`, `lexicon.md`, `user-flows.md`, `spec-gaps.md`, `data-model.md`, `api-contract.md`, `onboarding-auth.md`, `duplicate-detection.md`, `convex/schema.ts`, `nuxt.config.ts`, `convex.json`, `wrangler.toml`, `.env.example`, `package.json`

---

## Summary

Three tech specs — file storage (R2 receipt upload), OCR pipeline (Tesseract.js via CDN worker), and deployment (Clerk auth + webhook ingress) — were reviewed at the spec level. All three trigger `security-engineer` by the trigger table in `.kilo/agent/security-engineer.md` §6: file/image upload, third-party code execution, and auth/webhook handling respectively.

**Core problem:** six High findings arise because security requirements are either absent from the specs or present in a *cross-referenced* spec but not applied to the spec's own code examples. Notably, the file-storage upload and retrieval actions have no auth or ownership checks in their code despite `api-contract.md` §8 specifying the auth pattern; webhook signature verification is defined as an env var but no verification logic exists; and no retention policy or lawful basis is specified for any durable store holding user data (`domains/11-security/security.md` §5 — listed as Missing in `spec-gaps.md` §1 — does not yet exist). Additionally, the OCR pipeline loads Tesseract.js worker scripts from an unspecified CDN with no SRI or version pinning, creating a browser-side supply-chain risk.

A **spec-level Pass** would mean the security requirements are *written down*. Several are not. These must be specified before the specs are ratified. A code-level review with `SEC-XXX` tests remains mandatory at implementation time.

---

## Scope and Sensitivity

| Field | Value |
|-------|-------|
| Affected files | `docs/3-reference/tech-specs/backend/file-storage.md` (primary), `docs/3-reference/tech-specs/frontend/ocr-pipeline.md` (appendix), `docs/3-reference/tech-specs/architecture/deployment.md` (appendix) |
| Authentication or authorisation | Yes |
| Billing or entitlements | No (no payments in v1 — `project_brief.md` §204-218) |
| File upload or export | Yes (R2 receipt upload) |
| Iframe, CSP, or preview | No (no iframe/preview in v1 per trigger table) |
| User data or PII | Yes (receipt images, expense data, user accounts) |

---

## Properties Inventoried

### Store 1: R2 Object Storage (receipt images)
*Specified in:* `tech-specs/backend/file-storage.md`

| Property | Value |
|---------|-------|
| Type | Object storage (Cloudflare R2, via `@convex-dev/r2` Convex component v0.10.4) |
| Trust boundary | Browser (user device) → Nuxt frontend origin (`happy-house-bills.brettlockhart.com`) → Convex action (server-side, behind Clerk session) → R2. R2 objects are NOT publicly listed; access only via signed URLs from `getReceiptUrl`. |
| Lifecycle | Created on `expenses:uploadReceipt` action call. Storage ID stored on `expenses.receiptImageId`. Deleted when the referencing expense is soft-deleted. |
| Data class | User-supplied receipt images (financial data: store names, purchase items, totals, dates; potentially EXIF GPS/location) |
| Retention | "Deleted when expense soft-deleted" — no hard retention period. No TTL on R2 objects specified. |
| Lawful basis | **Not specified.** GDPR lawful basis missing. `domains/11-security/security.md` §5 — the retention/lawful-basis authority per `AGENTS.md` §12 and `security-engineer.md` §5 — does not exist (see `spec-gaps.md` §1). |

### Store 2: Client browser memory (base64 image buffer)
*Specified in:* `tech-specs/backend/file-storage.md` (upload flow)

| Property | Value |
|---------|-------|
| Type | Ephemeral in-memory buffer (browser JavaScript) |
| Trust boundary | Browser, origin-bound to the Nuxt app (`happy-house-bills.brettlockhart.com`). No egress except to Convex over HTTPS. |
| Lifecycle | Exists only during upload preparation. Lost on page refresh or navigation. |
| Data class | User-supplied receipt image (base64-encoded) |
| Retention | Non-durable, tab-scoped — no retention policy needed. |
| Lawful basis | N/A — not persisted. |

### Store 3: Tesseract.js Web Worker + language model (client memory)
*Specified in:* `tech-specs/frontend/ocr-pipeline.md`

| Property | Value |
|---------|-------|
| Type | Browser Web Worker running third-party code (Tesseract.js v5, `tesseract.js@^5.0.0` in `package.json`) |
| Trust boundary | Browser origin = app origin. Worker code and English language model (~8 MB) loaded from third-party CDN at runtime. |
| Lifecycle | Worker instantiated lazily when user opens camera/upload flow. Language model loaded on first OCR. Destroyed when component unmounts or page unloads. |
| Data class | Derived from user-supplied receipt image — processed in-browser, image bytes never leave the device. |
| Retention | Non-durable, tab-scoped — no retention policy needed. |
| Lawful basis | N/A — not persisted. |

### Store 4: OCR result memory (client)
*Specified in:* `tech-specs/frontend/ocr-pipeline.md`

| Property | Value |
|---------|-------|
| Type | In-memory JavaScript objects (extracted store/date/total, raw text, confidence values) |
| Trust boundary | Browser origin |
| Lifecycle | Exists during form pre-fill flow. Lost on navigation. Not persisted to IndexedDB or localStorage. |
| Data class | Derived text from receipt image |
| Retention | Non-durable. The spec explicitly states OCR results pre-fill a form; they are not stored client-side. |
| Lawful basis | N/A — not persisted. |

### Store 5: Clerk SaaS (user accounts, sessions, organisations)
*Specified in:* `tech-specs/architecture/deployment.md` §9

| Property | Value |
|---------|-------|
| Type | Managed SaaS (Clerk) |
| Trust boundary | External service. Browser ↔ Clerk (publishable key). Convex ↔ Clerk (secret key). Clerk → webhook endpoint (signed payloads). |
| Lifecycle | Accounts created on signup. Sessions expire per Clerk policy. Organisations persist until deleted. |
| Data class | PII: email addresses, user IDs, organisation names |
| Retention | Clerk's own policy — not documented in any Happy House Bills spec. |
| Lawful basis | **Not specified locally.** |

### Store 6: Convex document store (expenses, settlements)
*Specified in:* `convex/schema.ts`, `tech-specs/backend/data-model.md`

| Property | Value |
|---------|-------|
| Type | Document database (Convex) |
| Trust boundary | Convex runtime. Browser ↔ Convex via SDK behind Clerk auth. `orgId` index scoping at query level. |
| Lifecycle | Records created with `createdAt` field. No TTL or hard-delete configured in schema. Soft-delete mentioned in file-storage.md but not modelled in schema. |
| Data class | Financial expense data, Clerk user IDs, receipt storage ID references, dHash/fingerprint hashes |
| Retention | **Not specified.** No auto-deletion, no purge schedule. `createdAt` timestamp present but no retention TTL. |
| Lawful basis | **Not specified.** |

### Store 7: Cloudflare Workers (frontend serving)
*Specified in:* `tech-specs/architecture/deployment.md`

| Property | Value |
|---------|-------|
| Type | Serverless edge runtime (Cloudflare Worker) |
| Trust boundary | Edge. Serves static Nuxt SSR/payload assets. |
| Lifecycle | Stateless per request. |
| Data class | None — static assets only. |
| Retention | N/A — no data store. |
| Lawful basis | N/A. |

---

## Security Properties Specified

### file-storage.md — File/Image Upload

| # | Property | Specified in spec? | Where | Notes |
|---|----------|-------------------|-------|-------|
| 1 | Authentication on upload | Partially | `api-contract.md` §8 states "every function begins" with `getAuthUser(ctx)`; file-storage.md §7 code does **not** include this call | **HS-001** — auth pattern is specified elsewhere but not applied to the upload action |
| 2 | Authorisation (org scoping) on upload | Partially | `api-contract.md` §8 states org scoping; file-storage.md §8 env vars imply per-org isolation via prefix, but §7 code has no org check | **HS-001** |
| 3 | Image type validation (Content-Type/extension allowlist) | Specified but not implemented | §2 (in scope), §7 code accepts `v.string()` for contentType | **HS-004** — declared in scope, absent from code |
| 4 | Magic-byte / MIME sniffing validation | Not specified | §2 lists "Content-Type and extension enforcement" only | No file-signature verification specified |
| 5 | Size limit enforcement (5 MB) | Specified and coded | §2, §7 (`buffer.length > 5 * 1024 * 1024`) | Pass (specified) |
| 6 | Dimension limit (4000 × 4000 px) | Specified but not implemented | §2 (in scope), D5 ("Validate image dimensions server-side"); §7 code only checks buffer length | **HS-005** |
| 7 | EXIF / metadata stripping | Not specified | §2 in-scope list does not mention it | **HS-006** — receipts may carry GPS/location data |
| 8 | Signed-URL retrieval with TTL | Specified | D4 (signed URLs expire after 1 hour), §9 (`ctx.storage.getUrl`) | **HS-007** — TTL env var (`RECEIPT_SIGNED_URL_TTL`, §8) not wired into §9 code |
| 9 | Ownership/auth check on retrieval | Not specified | §9 `getReceiptUrl` query takes raw `storageId`, no org or ownership check | **HS-003** — IDOR / cross-tenant access |
| 10 | R2 secret isolation | Specified | §8 env table scopes R2 keys as private; AGENTS.md §4 (never log secrets) | Pass (specified) |

### ocr-pipeline.md — OCR Pipeline (Third-Party Code)

| # | Property | Specified in spec? | Where | Notes |
|---|----------|-------------------|-------|-------|
| 1 | CDN integrity / SRI for worker scripts | Not specified | D1 ("CDN-loaded worker"); §7 `createWorker` import | **HS-008** — no SRI, no pinned version, no integrity check |
| 2 | CSP compatibility | Not specified | No CSP section in any spec | N/A at spec level — no iframe/preview/export in v1, but Tesseract worker may need CSP `worker`/`script-src` allowances (see note below) |
| 3 | Worker isolation (Web Worker, off-main-thread) | Specified | D7, §2 (in scope: "runs off the main thread via Web Worker") | Pass (specified) |
| 4 | Raw OCR text safe rendering | Not specified | §9 returns `raw: text`; no rendering guidance | **HS-010** — if rendered as HTML, stored XSS risk |
| 5 | Error handling (worker failure, timeout) | Specified | §2 (in scope), §2 lists "Error handling: worker failure, unsupported image format, timeout" | Pass (specified) |
| 6 | Language model size / load budget | Specified | D7 (~8 MB, lazy-loaded) | Pass (specified) |
| 7 | Image type validation before OCR | Not specified | `preprocessImage(file: File)` accepts any File | The OCR pipeline does not validate that the input is a JPEG/PNG/HEIC before processing. However, OCR failure on non-image types is a functional issue, not a direct security vulnerability (Tesseract would simply fail to parse). |

### deployment.md — Auth, Session, Webhook

| # | Property | Specified in spec? | Where | Notes |
|---|----------|-------------------|-------|-------|
| 1 | Webhook signature verification | Not specified | §7 lists `CLERK_WEBHOOK_SECRET` env var; §9 lists endpoint + events subscribed | **HS-012** — secret defined, verification logic absent; `convex/http.ts` doesn't exist |
| 2 | Webhook event allow-list | Specified | §9 subscribes to specific events only | Pass (specified) |
| 3 | Clerk org membership limit | Specified | §9 ("Maximum organisations per user" = 1) | Pass (specified) |
| 4 | Invite expiry | Specified | §9 (auto-expire after 7 days) | Pass (specified) |
| 5 | Env var scope (private vs public) | Specified | §7 scope column | **HS-015** — R2 key permissions not specified as least-privilege |
| 6 | Secret naming consistency | Not specified | §7 lists `CONVEX_DEPLOY_AUTH_TOKEN`; `.env.example` and `nuxt.config.ts` use `CONVEX_DEPLOY_KEY` | **HS-013** — mismatch |
| 7 | `.env.example` completeness | Not specified | Missing 4 vars from §7 | **HS-014** |

---

## Threat Model

| Asset | Trust boundary | Data flow | Threat | Mitigation | Residual risk |
|-------|---------------|-----------|--------|------------|---------------|
| R2 receipt objects | Browser → Convex action → R2 | User uploads receipt → `uploadReceipt` stores blob in R2 → returns storage ID → stored on expense → retrieved via `getReceiptUrl` signed URL | Tampering: malicious upload (e.g. `text/html` content-type) stored in R2; IDOR: any user retrieves any receipt via guessed/exposed storage ID | No content-type validation; no ownership check on retrieval | High — **HS-004, HS-003** |
| R2 receipt objects | Same as above | Same as above | Information disclosure: receipts contain financial PII (store, items, totals); no retention/deletion | "Deleted when expense soft-deleted" only; no hard retention period; no `security.md` §5 | High — **HS-002** |
| Receipt upload action | Browser → Convex action (server) | Base64 image sent to `expenses:uploadReceipt` action | Spoofing / auth bypass: no `getAuthUser` call in action code; unauthenticated user could upload | `api-contract.md` §8 specifies auth, but file-storage.md §7 doesn't apply it | High — **HS-001** |
| Tesseract.js worker | Browser origin ← CDN worker code | Worker + language model loaded from unspecified CDN at runtime | Supply-chain: compromised CDN serves malicious worker to all users | No SRI, no version pinning, caret-range dependency | High — **HS-008** |
| OCR raw text output | Browser DOM | Worker returns text → pre-fills form fields | XSS: raw OCR text rendered as HTML → script injection | No rendering guidance in spec | Medium — **HS-010** |
| Clerk webhook endpoint | Clerk → Convex HTTP endpoint | Clerk sends `organization.created`/`user.updated` etc. to `/webhook/clerk` | Webhook forgery: no signature verification → fake org/user creation → data injection | `CLERK_WEBHOOK_SECRET` defined but no verification logic in spec | High — **HS-012** |
| Env var naming | Developer / CI | Local `.env` → runtime config | Misconfiguration: env var name mismatch causes deploy failure or secret not loaded | `CONVEX_DEPLOY_AUTH_TOKEN` vs `CONVEX_DEPLOY_KEY` | Medium — **HS-013, HS-014** |

---

## Security Checklist

| Control | Status | Evidence |
|---------|--------|----------|
| Authentication enforced at server boundary | Not specified | `api-contract.md` §8 specifies auth pattern for "every function" but `file-storage.md` §7 `uploadReceipt` code omits it — **HS-001** |
| Authorisation checked per operation | Not specified | `getReceiptUrl` query (`file-storage.md` §9) takes raw `storageId`, no ownership or org check — **HS-003** |
| Inputs validated and size-limited | Partially specified | Size limit (5 MB) specified + coded (`file-storage.md` §7); content-type/dimension validation specified in §2 scope but absent from §7 code — **HS-004, HS-005, HS-006** |
| Output encoded for HTML, CSS, and JavaScript contexts | N/A | No server-rendered HTML in v1; OCR results are text fields. Raw OCR text rendering is a frontend concern deferred to `ui-spec.md` — **HS-010** flags the risk |
| CSP configured for preview and exports | N/A | No iframe, preview, or export pipeline in v1 (per trigger table). *Note:* Tesseract.js worker may require CSP `worker-src`/`script-src` allowances not addressed in any spec. |
| Iframe sandbox and postMessage origin validated | N/A | No iframe or `postMessage` in v1 |
| Secrets absent from client code, logs, and errors | N/A (spec-level) | No code deployed; `AGENTS.md` §4 rule ("never log secrets") applies at implementation. Env var scope table specified in `deployment.md` §7 — `RESEND_FROM_EMAIL` marked "public" (**HS-015** notes this is low-risk but unusual) |
| Rate limits and replay protections configured | N/A (spec-level) | No rate limiting specified for Convex functions or upload action; Convex has no built-in function rate limits. Deferred to implementation. |
| Webhook signatures verified | Not specified | `deployment.md` §9 lists webhook endpoint + `CLERK_WEBHOOK_SECRET` env var but no verification logic; `convex/http.ts` does not exist — **HS-012** |
| Dependency findings triaged | N/A (spec-level) | No code deployed; no `npm audit` to run. `package.json` uses caret ranges (`tesseract.js@^5.0.0`, `@convex-dev/r2@^0.10.4`) allowing unreviewed upgrades — noted as **HS-008** for OCR CDN loading |

---

## Findings

### High Priority

| ID | Finding | Severity | Spec section |
|----|---------|----------|-------------|
| HS-001 | `uploadReceipt` action (`file-storage.md` §7) has no authentication or authorisation check — handler starts directly with buffer validation and `ctx.storage.store()`, no `getAuthUser(ctx)` or org scoping. `api-contract.md` §8 specifies auth on "every function" but `file-storage.md` §7 code does not apply it. | High | `file-storage.md` §7, `api-contract.md` §8 |
| HS-002 | No retention policy or lawful basis for R2 receipt storage. `domains/11-security/security.md` §5 (the retention/lawful-basis authority per `AGENTS.md` §12 and `security-engineer.md` §5) does not exist (`spec-gaps.md` §1 lists it as Missing). Receipts are user-supplied images containing financial PII with no auto-deletion beyond the undefined "soft-delete" trigger. | High | `file-storage.md` §2, `spec-gaps.md` §1 |
| HS-003 | `getReceiptUrl` query (`file-storage.md` §9) accepts a raw `storageId` with no ownership or org check — any authenticated user can request a signed URL for any receipt in any organisation (IDOR / cross-tenant access). | High | `file-storage.md` §9 |
| HS-008 | Tesseract.js v5 worker scripts and English language model (~8 MB) are loaded from an unspecified CDN (`ocr-pipeline.md` D1: "CDN-loaded worker") with no Subresource Integrity (SRI), no pinned version, and no integrity verification. `package.json` uses caret range `^5.0.0`, allowing unreviewed upgrades. A compromised CDN could serve malicious worker code to every user in the browser. | High | `ocr-pipeline.md` D1, §7 |
| HS-012 | Webhook signature verification is not specified. `deployment.md` §7 lists `CLERK_WEBHOOK_SECRET` as a private env var; §9 lists the webhook endpoint URL and subscribed events — but no verification logic (`verifyWebhook` / HMAC comparison) is defined. `convex/http.ts` (the handler) does not exist. Untested webhook ingress is a classic forgery vector. | High | `deployment.md` §7, §9 |
| HS-015 | No retention policy for Clerk PII (user accounts, email addresses) or Convex expense/settlement data. `domains/11-security/security.md` §5 — the data-governance authority — does not exist (`spec-gaps.md` §1 Domain 11). Schema (`convex/schema.ts`) records `createdAt` but no TTL or purge schedule is specified anywhere. | High | `deployment.md` §7, `spec-gaps.md` §1, `convex/schema.ts` |

### Medium Priority

| ID | Finding | Severity | Spec section |
|----|---------|----------|-------------|
| HS-004 | Content-Type is client-supplied (`v.string()` in `file-storage.md` §7) and passed directly to R2 with no server-side validation — no magic-byte / file-signature check, no allowlist enforcement, no extension validation. §2 lists "Content-Type and extension enforcement" as in-scope but §7 code only checks buffer length. An attacker could store `text/html` content with an `image/jpeg` declared type or vice-versa. | Medium | `file-storage.md` §2, §7 |
| HS-005 | Image dimension validation (max 4000 × 4000 px) is specified in §2 scope and D5 ("Validate image dimensions server-side after upload") but is not implemented in the §7 code example — only `buffer.length` is checked. Oversized images could consume R2 budget and processing time. | Medium | `file-storage.md` §2, §7 |
| HS-006 | EXIF / metadata stripping is not mentioned anywhere in `file-storage.md`. Receipt images may carry GPS location, device identifiers, and timestamps in JPEG/HEIC metadata. Defence-in-depth privacy control is absent from the spec. | Medium | `file-storage.md` §2 |
| HS-009 | No lawful basis or retention policy for client-side OCR processing of user-supplied receipt images through third-party Tesseract.js worker code. While image bytes never leave the device, the third-party worker code executes on user data and no GDPR Article 28 (processor) or consent mechanism is specified. `domains/11-security/security.md` §5 does not exist. | Medium | `ocr-pipeline.md` §2, `spec-gaps.md` §1 |
| HS-010 | Raw OCR text is returned as `raw: text` in the `extractFields()` return value (`ocr-pipeline.md` §9). If the frontend renders this via `innerHTML` or a template that treats it as HTML, arbitrary OCR-extracted text could enable stored XSS. The spec does not specify text-only rendering. | Medium | `ocr-pipeline.md` §9 |
| HS-013 | Environment variable naming inconsistency — `deployment.md` §7 lists `CONVEX_DEPLOY_AUTH_TOKEN` (scope: private) but `.env.example` and `nuxt.config.ts` (lines 9, 17) use `CONVEX_DEPLOY_KEY`. The mismatch could cause deployment failure or a secret not being loaded in one environment but not the other. | Medium | `deployment.md` §7, `.env.example`, `nuxt.config.ts` |
| HS-014 | `.env.example` is missing 4 environment variables defined in `deployment.md` §7: `CLERK_WEBHOOK_SECRET`, `RESEND_FROM_EMAIL`, `WRANGLER_ACCOUNT_ID`, and `RECEIPT_SIGNED_URL_TTL` (from `file-storage.md` §8). New developers deploying from scratch would not know to set these secrets. | Medium | `deployment.md` §7, `file-storage.md` §8, `.env.example` |
| HS-016 | R2 access key permissions are not specified as least-privilege. `deployment.md` §7 and §8 list `R2_ACCESS_KEY_ID` and `R2_SECRET_ACCESS_KEY` as private env vars but do not specify that the keys should be scoped to a single bucket with read/write-only permissions. Full-admin keys would grant access to all R2 resources in the Cloudflare account. | Medium | `deployment.md` §7, §8 |

### Low Priority

| ID | Finding | Severity | Spec section |
|----|---------|----------|-------------|
| HS-007 | `RECEIPT_SIGNED_URL_TTL` env var (`file-storage.md` §8) is defined but never referenced in the §9 code example — `ctx.storage.getUrl(args.storageId)` uses Convex's default TTL with no override. The spec declares a configurable TTL but the implementation path doesn't use it. | Low | `file-storage.md` §8, §9 |
| HS-011 | Version mismatch between specs — `project_brief.md` §31 says "Tesseract.js (client-side, v1)" while `ocr-pipeline.md` D1 and `package.json` specify v5. Not a direct security risk but indicates spec drift that could mask a dependency upgrade decision. | Low | `project_brief.md` §31, `ocr-pipeline.md` D1, `package.json` |
| HS-017 | Domain name inconsistency — `deployment.md` text (§28: "happy-house-bill.brettlockhart.com") uses the singular form, but the `wrangler.toml` code block in §10 and the actual `wrangler.toml` file use the plural "happy-house-bills.brettlockhart.com". If the spec text is used as the deploy config, routing would fail. | Low | `deployment.md` §28, §136, §151, `wrangler.toml` |

---

## Retention and Lawful Basis Summary

Per `AGENTS.md` §12 and `security-engineer.md` §6: "If a store holds user-authored data and has no retention period, no `domains/11-security/security.md` §5 row, and no GDPR export or deletion path, that is a High finding."

| Store | Holds user data? | Retention specified? | `security.md` §5 row? | Export/deletion path? | Finding |
|-------|-----------------|---------------------|-----------------------|----------------------|---------|
| R2 receipt objects | Yes (financial PII) | No — only "soft-delete trigger" (undefined) | No (`security.md` doesn't exist) | No | **HS-002 (High)** |
| Convex document store | Yes (expense/settlement PII) | No — no TTL, no purge schedule | No | No | **HS-015 (High)** |
| Clerk SaaS | Yes (email, user IDs) | No — Clerk's policy only | No | No | **HS-015 (High)** |
| Client browser memory (base64) | Yes (ephemeral) | N/A — non-durable | N/A | N/A | None — correctly ephemeral |
| Tesseract.js worker | No — derived text only | N/A — non-durable | N/A | N/A | None — correctly ephemeral |
| OCR result memory | No — derived text only | N/A — non-durable | N/A | N/A | None — correctly ephemeral |
| Cloudflare Workers | No — static assets | N/A — no data store | N/A | N/A | None |

**Root cause:** `domains/11-security/security.md` (Domain 11 in `spec-gaps.md` §1) is listed as Missing. It is the designated authority for PII retention per `AGENTS.md` §12 and `security-engineer.md` §5 (which references "security.md §5" and "D8 (30 days)"). Until it is written, **HS-002** and **HS-015** cannot be closed — the retention and lawful-basis rows depend on it. The `domains/11-security/security.md` spec is the blocking dependency for both High findings.

---

## Third-Party Egress

| Egress target | Purpose | Consent / legal basis | Risk | Finding ref |
|--------------|---------|----------------------|------|-------------|
| Cloudflare R2 | Receipt image storage (S3-compatible) | Explicit user action (uploading a receipt for expense tracking); no retention/deletion path | Low if access-controlled; High if IDOR or no retention | HS-002, HS-003 |
| Resend | Transactional email (invite, expense/approval notifications) | Contract necessity (onboarding/email flows are core to the product) | PII (email addresses, expense details) sent to third party | None at spec level — `deployment.md` §7 marks `RESEND_API_KEY` private; `RESEND_FROM_EMAIL` marked public (minor) |
| Tesseract.js CDN | Worker scripts + English language model (~8 MB) loaded into browser | Not specified — third-party code executes on user-supplied images in-browser | Supply-chain: no SRI, no pinned version, caret-range dep; compromised CDN → malicious code in every user's browser | HS-008 |
| Clerk (SaaS API) | User authentication, organisation management, session handling | Contract necessity (auth is core); SSO/future MFA via Clerk dashboard config | PII (emails, user IDs, org names) in external SaaS | None at spec level — Clerk is an established auth provider |
| Convex (backend) | Document store, function execution, R2-backed storage | Contract necessity | PII (expense data, user IDs, receipt references) | HS-003 (IDOR on retrieval), HS-015 (retention) |
| Cloudflare Workers | Static asset serving (Nuxt SSR output) | N/A — no user data egress | Static assets only | None |
| Clerk webhook ingress | Real-time sync of `organization.created`, `organization.deleted`, `user.created`, `user.updated` events to Convex | — | Ingress, not egress; signature verification missing → forgery risk | HS-012 |

---

## Authorisation Requirements per Operation

### file-storage.md operations

| Operation | Spec'd requirement | Evidence | Gap |
|-----------|-------------------|----------|-----|
| `expenses:uploadReceipt` (Convex action → R2) | Authenticated Clerk session + org scoping | `api-contract.md` §8: "Every function begins" with `getAuthUser(ctx)`; D4 says `file-storage.md` cross-ref | `file-storage.md` §7 code omits `getAuthUser` — **HS-001** |
| `getReceiptUrl` (Convex query → signed URL) | Authenticated Clerk session + ownership of the expense referencing `storageId` | D4: "signed URLs expire after 1 hour"; §9 uses `ctx.storage.getUrl()` | `file-storage.md` §9 code has no ownership check — **HS-003** |
| R2 direct access | Must be impossible | D4: "prevents unauthenticated access"; signed URLs only | Not directly testable at spec level; depends on auth + ownership checks above |

### ocr-pipeline.md operations

| Operation | Spec'd requirement | Evidence | Gap |
|-----------|-------------------|----------|-----|
| Tesseract.js worker init | None (client-side, browser origin only) | D1, §7 | N/A — no server auth boundary |
| OCR image processing | None (client-side, image stays in-browser) | D1 (client-side), §2 | The image is never sent to a server for OCR; only the base64 buffer is later sent to R2 for storage. No data-plane risk beyond what file-storage.md covers. |

### deployment.md operations

| Operation | Spec'd requirement | Evidence | Gap |
|-----------|-------------------|----------|-----|
| Clerk webhook handler | Signature verification via `CLERK_WEBHOOK_SECRET` | §7 env var, §9 endpoint URL | No verification logic specified; `convex/http.ts` doesn't exist — **HS-012** |
| Convex function calls | Authenticated Clerk session | `onboarding-auth.md` §Auth Context, `api-contract.md` §8 | Not directly tested here; covered by HS-001 for upload action |
| Env var access | Private vars in server runtime only; public prefixed `NUXT_PUBLIC_` | §7 scope column, `nuxt.config.ts` | `RESEND_FROM_EMAIL` marked public — minor; HS-013 naming mismatch |

---

## N/A Items (spec-level review)

| Item | Reason |
|------|--------|
| Dependency scan (`npm audit`, SBOM, supply chain) | Spec-level review — no code deployed. `package.json` uses caret ranges (`^5.0.0`, `^0.10.4`) allowing unreviewed upgrades; noted as part of **HS-008** (Tesseract CDN) and **HS-011** (version drift). A dependency scan is required at slice level. |
| Security tests (`SEC-XXX` IDs) | Deferred to implementation. Per `AGENTS.md` §12 and `security-engineer.md` §6: "Any property table a spec-level review produces should gain a `SEC-` test per property at slice time." |
| Output encoding (HTML/CSS/JS contexts) | No server-rendered HTML in v1. OCR results are text fields, not HTML. *Exception noted:* raw OCR text rendering is flagged as **HS-010** (Medium) — must be text-only in implementation. |
| CSP headers for preview/export | N/A — no iframe, preview, or export pipeline in v1 (per trigger table). *Caveat:* Tesseract.js worker loading may require CSP `worker-src`/`script-src` allowances not addressed in any spec; should be specified at implementation. |
| Iframe sandbox / `postMessage` validation | N/A — no iframe or `postMessage` in v1. |
| Rate limiting on mutations/endpoints | N/A at spec level — Convex has no built-in function rate limits; no rate-limiting strategy is specified in any spec. Should be addressed at implementation. |
| Secret rotation schedule | N/A at spec level — no rotation policy specified. `AGENTS.md` §4 establishes the rule ("API keys live in env vars; never logged") but rotation cadence is an implementation concern. |
| SSRF protection | N/A — no server-side fetching of user-supplied URLs in v1. Convex actions don't fetch arbitrary URLs. |
| CSRF protection | N/A at spec level — Clerk + Convex handle session management server-side; client SDK uses bearer tokens. CSRF is a Convex/Clerk framework concern not specified in these specs. |
| Penetration testing | N/A — no deployment to test. Spec-level review only. Required at slice level before release. |

---

## Residual Risk

**Residual risk is HIGH at the pre-ratification stage.** Six High findings remain open across the three specs. A spec-level review verifies that requirements are *written down*, not that the feature is secure. Until these six High findings are specified into the specs (and subsequently implemented and tested with `SEC-XXX` tests at slice time), the file upload, OCR, and deployment surfaces are not ready for ratification.

The three blocking dependencies for the retained-data findings are:
1. **`domains/11-security/security.md`** must be written (Missing in `spec-gaps.md` §1, Domain 11) — resolves HS-002 and HS-015 by defining §5 (retention) and data export/deletion flows.
2. **Auth must be specified** on `uploadReceipt` and `getReceiptUrl` — resolves HS-001 and HS-003.
3. **Webhook verification logic** must be specified in `convex/http.ts` or `api-contract.md` — resolves HS-012.

The remaining Medium/Low findings are implementation concerns but should be tracked as `SEC-XXX` requirements at slice time.

---

## Approval

| Decision | Approver | Date | Notes |
|----------|----------|------|-------|
| Needs revision (6 High, 7 Medium/Low, 8 N/A) | Security Engineer (spec-level) | 25-October-2026 | Specs must be amended before ratification. Three High findings (HS-002, HS-015, and HS-012) block ratification until `domains/11-security/security.md` is written and auth/webhook verification logic is specified. |

## Next Gate

1. **Revise the three specs** to specify the missing security properties: auth on upload/retrieval actions (HS-001, HS-003), content-type/dimension validation (HS-004, HS-005), EXIF stripping (HS-006), webhook signature verification (HS-012), env var consistency (HS-013, HS-014), and least-privilege R2 keys (HS-016).
2. **Write `domains/11-security/security.md`** (Domain 11 in `spec-gaps.md` §1) to define §5 retention rows and data export/deletion flows — resolves HS-002 and HS-015.
3. **Specify Tesseract.js CDN integrity controls** (SRI, pinned version, integrity check) and reconcile version references — resolves HS-008, HS-011.
4. **Specify raw OCR text rendering as text-only** (no `innerHTML`) — resolves HS-010.
5. After specs are revised, **implement** the features, then **re-run a code-level (slice) security review** with `SEC-XXX` tests for every property in the tables above. A spec-level Pass does not grant release approval.
