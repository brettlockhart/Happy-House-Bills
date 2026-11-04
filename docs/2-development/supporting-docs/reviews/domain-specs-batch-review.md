# Spec Review: Domain Specs Batch Review (11 specs)

**Date:** 25-October-2026  
**Reviewer:** Spec Reviewer (batch analysis)  
**Source documents reviewed:** All 11 domain specs, all 7 sibling tech-specs, `AGENTS.md`, `tech-specs/README.md`, `project_brief.md`, `user-flows.md`, `lexicon.md`, `spec-gaps.md`, `functional-domains.md`, `file-storage-security-review.md`, `.kilo/agent/spec-reviewer.md`, `.kilo/agent/security-engineer.md`, `.kilo/templates/spec-review-report.md`  
**Ground-truth sources:** `convex/schema.ts`, `nuxt.config.ts`, `convex.json`, `wrangler.toml`, `.env.example`, `package.json`

---

## Executive Summary

All 11 domain specs have the six required template sections (Purpose, Scope, Key Decisions,
Open Questions, Cross-References, Implementation Dependencies). All meet the D1–D3 minimum for
Key Decisions. All open questions are registered in `spec-gaps.md`. However, every spec with the
exception of Domain 11 has at least one issue — most commonly invalid `§NN` section citations to
`project_brief.md` (which has no numbered sections), a factual error against a ground-truth file,
or a cross-reference reciprocity gap.

| # | Spec | Verdict | Blocking issues | Security handoff? |
|---|------|:---:|:---------------:|:-----------------:|
| 01 | onboarding-auth.md | **Needs revision** | 5 | YES |
| 02 | expense-management.md | **Needs revision** | 2 | No |
| 03 | settlement-management.md | **Needs revision** | 2 | No |
| 04 | balance-calculation.md | **Needs revision** | 2 | No |
| 05 | receipt-upload.md | **Needs revision** | 2 | YES |
| 06 | ocr-pipeline.md | **Needs revision** | 2 | No* |
| 07 | duplicate-detection.md | **Conditional pass** | 1 | No |
| 08 | email-notifications.md | **Conditional pass** | 1 | No |
| 09 | ui-spec.md | **Needs revision** | 3 | No |
| 10 | deployment.md | **Needs revision** | 4 | No |
| 11 | security.md | **Needs revision** | 4 | YES (owns all triggers) |

\* Domain 06 loads third-party code (Tesseract.js from CDN) — flagged as HS-008 in the prior
tech-spec security review. The trigger table in `security-engineer.md` §6 lists
"Third-party or user-supplied code/content" as N/A for v1, but Tesseract.js is genuinely
third-party code executing in-browser. Recommend re-verification of HS-008 at implementation.

**Verdict definitions:**
- **Pass** — no blocking issues found.
- **Conditional pass** — minor issues only (citations, reciprocity); no factual errors or
  template violations. Can proceed with caveats noted.
- **Needs revision** — one or more blocking issues: template violation, factual error
  against ground-truth, or citation that does not resolve to the claimed content.

---

## Security Trigger Checklist

Per `security-engineer.md` §6 (Spec Security Triggers) and `AGENTS.md` §12:

| Trigger | D01 | D02 | D03 | D04 | D05 | D06 | D07 | D08 | D09 | D10 | D11 |
|---------|-----|-----|-----|-----|-----|-----|-----|-----|-----|-----|-----|
| Authentication / authorisation | **YES** | No (delegates §2 Out) | No (delegates §2 Out) | No (delegates §2 Out) | No | No | No | No | No | No | **YES** (§9) |
| Payment / billing / entitlement | No | No | No | No | No | No | No | No | No | No | No |
| Webhook ingress / signature | No | No | No | No | No | No | No | No | No | No | **YES** (§11) |
| File or image upload | No | No | No | No | **YES** (§7) | No | No | No | No | No | **YES** (§12) |
| Iframe / preview / public HTML | No | No | No | No | No | No | No | No | No | No | No |
| Export pipeline | No | No | No | No | No | No | No | No | No | No | **YES** (D6) |
| PII retention / export / deletion | No | No | No | No | **YES** (EXIF §7) | **YES** (OCR mem §7) | No | No | No | No | **YES** (§8, §7) |
| Cross-tenant / shared-resource access | **YES** (org multi-tenancy) | No (delegates §2 Out) | No (delegates §2 Out) | No | No | No | No | No | No | No | **YES** (§10, D2) |
| Third-party / user-supplied code | No | No | No | No | No | **YES** (Tesseract.js) | No | No | No | No | No |

**Specs requiring a spec-level `security-engineer` handoff:**
- **Domain 01** (`onboarding-auth.md`) — Authentication/authorisation and cross-tenant access
  control. The prior security review (`file-storage-security-review.md`) focused on the
  tech-specs; the domain auth spec introduces no new code but owns the auth boundary.
  Handoff is warranted because the `@convex-dev/clerk-auth` dependency is not in
  `package.json` (see Factual Accuracy findings) and the trust boundary between Clerk
  sessions and Convex queries must be specified concretely.
- **Domain 05** (`receipt-upload.md`) — File/image upload. The prior tech-spec security review
  already covered `file-storage.md`; the domain spec re-asserts the same upload surface.
  Recommend the security-engineer confirm the domain spec's additional claims (EXIF stripping
  via Domain 11 D4, dimension limits) are consistent with the tech-spec review's HS-004–HS-007.
- **Domain 11** (`security.md`) — This IS the security spec. It owns all security triggers.
  It self-specifies retention (§8), authz matrix (§10), webhook verification (§11), and
  content-type allowlist (§12). However, it references `security-engineer.md`,
  `.kilo/templates/security-review.md`, `convex/http.ts`, and `convex/auth.ts` — some of
  which do not exist or are outside `docs/`.

---

## Findings by Spec

### Domain 01 — `onboarding-auth.md`

**Verdict:** Needs revision

| # | Section | Issue | Severity | Suggested fix |
|---|---------|-------|----------|---------------|
| 1 | §1 headings | Uses unnumbered headings (`## Purpose`, `## Scope`, …) instead of `## 1. Purpose`. All other 10 domain specs use numbered `## N. Title` format per `AGENTS.md` §10 ("Section headings must use `## N. Title` format"). | Blocking | Add `## 1.` through `## 6.` prefix to the six core sections, then renumber additional sections (Onboarding Flow → §7, Auth Context → §8). |
| 2 | D1–D4 Source columns | All four decisions cite `project_brief.md §NN` (§26-32, §29-30, §170-182, §32, §25-32). `project_brief.md` uses unnumbered headings (`## Product`, `## Multi-Tenancy Model`, `## Acceptance Criteria`, `## Non-Goals`); there are only 74 lines total, so §170-182 references lines that don't exist. Every `§NN` citation to `project_brief.md` is invalid. | Blocking | Replace with the heading text: `## Multi-Tenancy Model` (for org/household model), `## Acceptance Criteria` (for onboarding flow), `## Non-Goals` (for single-org restriction). |
| 3 | §Auth Context code | Imports from `@convex-dev/clerk-auth` — package is NOT in `package.json` (verified). The project's auth module is `@clerk/nuxt` (nuxt.config.ts:4, package.json:29). | Blocking | Replace import with the actual Convex + Clerk integration path. At minimum, note that `@convex-dev/clerk-auth` is planned but not yet installed. |
| 4 | §Auth Context code | References `convex/auth.ts:84` — the file `convex/auth.ts` does not exist on disk (verified: only `convex/schema.ts` exists). `AGENTS.md` §2 lists it in the planned layout, but it is not yet scaffolded. | Minor | Either create the file or replace with a prose description that does not anchor to a non-existent file path. |
| 5 | §Auth Context code | `getOrgId` helper returns `user.org_id` (a string), but the security spec (Domain 11 §9) defines `requireAuthenticatedOrg(ctx)` returning `{ userId, orgId }`. These are inconsistent helper names and signatures — five other domain specs use `requireAuthenticatedOrg`. | Minor | Align with `requireAuthenticatedOrg(ctx)` as defined in Domain 11 §9 so all domain specs share one auth helper. |

**Open questions:** BB-Q3 is registered in `spec-gaps.md` ✓.

---

### Domain 02 — `expense-management.md`

**Verdict:** Needs revision

| # | Section | Issue | Severity | Suggested fix |
|---|---------|-------|----------|---------------|
| 1 | D1 Source | Cites `project_brief.md §50-54` — section number does not exist. Actual section is `## Acceptance Criteria` (lines 48–59). | Blocking | Replace with `## Acceptance Criteria` — the spec's own flow map already shows `§2` for user_flows, so this is a straightforward heading-text substitution. |
| 2 | D2, D6 Source | Cites `project_brief.md §54` and `project_brief.md §69` — both invalid. §54 exceeds the 10 acceptance-criteria items; §69 is within the Non-Goals bullet list (line 69 = "No dispute workflow"). | Blocking | Replace with `## Acceptance Criteria` (for pending/approval rules) and `## Non-Goals` (for dispute workflow deferral). |
| 3 | §6 Dependencies | "Blocks: `settlement-management.md`" — settlement spec §5 Cross-References does NOT list `expense-management.md`. Reciprocity gap. | Minor | Add `domains/02-expenses/expense-management.md` to settlement-management.md §5 Cross-References. |
| 4 | §9 code | `new Mutation("expenses:approve", {...})` — not the Convex API. Convex uses `mutation({ args, handler })` from `convex/server`. This syntax appears in both Domain 02 and Domain 03. | Minor | Replace with the correct Convex mutation syntax. |

**Open questions:** BB-Q1, EXP-Q1 registered ✓.

---

### Domain 03 — `settlement-management.md`

**Verdict:** Needs revision

| # | Section | Issue | Severity | Suggested fix |
|---|---------|-------|----------|---------------|
| 1 | §8 code | `const { storageId } = await ctx.db.insert("settlements", {...})` — Convex's `db.insert()` returns `Id<"settlements">` (a string ID), not an object with a `storageId` property. `storageId` is a Convex **storage** concept (`ctx.storage.store()`), not a database insert result. | Blocking | Replace with `const id = await ctx.db.insert(...)` and `return { id }`. |
| 2 | §8 code | Same `new Mutation(...)` API error as Domain 02 §9. | Minor | Use Convex's `mutation({ args, handler })` syntax. |
| 3 | D1 Source | Cites `project_brief.md §61 (Non-Goals: "No native mobile app, no settings screen")`. `project_brief.md` has no numbered sections; §61 is a line number, not a section. The Non-Goals section (lines 61–74) is a bullet list — there is no single item pairing "No native mobile app" with "No settings screen". | Blocking | Replace with `## Non-Goals (v1)`. |
| 4 | §6 Dependencies | "Blocks: `balance-calculation.md`" — balance spec §5 DOES cross-reference back ✓, but expense-management §6 also claims to block settlement-management.md and balance-calculation.md. Settlement spec does NOT cross-reference expense-management.md in §5. | Minor | Add `domains/02-expenses/expense-management.md` to settlement §5 Cross-References. |

**Open questions:** SET-Q1 registered ✓.

---

### Domain 04 — `balance-calculation.md`

**Verdict:** Needs revision

| # | Section | Issue | Severity | Suggested fix |
|---|---------|-------|----------|---------------|
| 1 | D4 Source | Cites `project_brief.md §57 (acceptance criteria)`. Invalid — no numbered sections in `project_brief.md`. Line 57 is acceptance criterion 7 ("The balance updates in real-time"). | Blocking | Replace with `## Acceptance Criteria` (real-time balance requirement). |
| 2 | D5, §5 | Cites `tech-specs/frontend/ui-spec.md §12` for "layout diagram". `ui-spec.md` §12 is titled "Responsive Behaviour" — it contains layout diagrams in subsections 12.1 and 12.2, but the section heading is not "Layout". The citation is misleading. | Minor | Reference `§12.1 Mobile Layout` and `§12.2 Desktop Layout` explicitly, or cite the section as "Responsive Behaviour (layout diagrams)". |
| 3 | §6 | "Blocks: `ui-spec.md`" — references `domains/09-ui/ui-spec.md` which DOES cross-reference back ✓ (§5 Cross-References). | — | No action needed. |

**Open questions:** BB-Q2 registered ✓.

---

### Domain 05 — `receipt-upload.md`

**Verdict:** Needs revision

| # | Section | Issue | Severity | Suggested fix |
|---|---------|-------|----------|---------------|
| 1 | D4 Source | Cites `tech-specs/backend/file-storage.md §8` for "size limit". File-storage.md §8 is "Environment Variables" — no size limits there. Size limits appear in §2 In scope (line 29: "Image size validation (max 5 MB, max 4000 × 4000 px)") and §3 D5. | Blocking | Replace `§8` with `§2` or `§3 D5`. |
| 2 | D2 Source | Cites `tech-specs/frontend/ocr-pipeline.md D6` for "EXIF orientation corrected in-browser". Tech-spec `ocr-pipeline.md` D6 is "Date extracted via regex" — completely unrelated to EXIF. The EXIF orientation decision is `tech-specs/frontend/mobile-compat.md` D6. | Blocking | Replace with `tech-specs/frontend/mobile-compat.md` D6. |
| 3 | §7 flow step 7 | States "OCR runs on the original image (before R2 upload)". This **directly contradicts** Domain 06's D6 ("OCR runs after upload to R2, not before") and `user-flows.md` §2 step 41 (OCR → then upload to R2). Resolution needed: one of these three must be corrected. | Blocking | Reconcile with Domain 06 D6. If OCR runs after upload (as the domain ocr-pipeline spec states), update receipt-upload §7 step 7. If OCR runs before upload (as user-flows shows), update ocr-pipeline D6 and §7 flow. |
| 4 | §8 code | References `// convex/storage.ts` — file does not exist (only `convex/schema.ts` on disk). | Minor | Replace with a prose description; do not anchor to a non-existent file. |

**Open questions:** REC-Q1 registered ✓.

---

### Domain 06 — `ocr-pipeline.md`

**Verdict:** Needs revision

| # | Section | Issue | Severity | Suggested fix |
|---|---------|-------|----------|---------------|
| 1 | D6 (and §7 flow) | Claims "OCR runs after upload to R2, not before", citing `receipt-upload.md §7`. But receipt-upload.md §7 step 7 states the **opposite**: "OCR runs on the original image (before R2 upload)." And `user-flows.md` §2 steps 30–41 show OCR before upload (step 30: Tesseract runs; step 41: upload to R2). The domain ocr-pipeline spec and the domain receipt-upload spec directly contradict each other. | Blocking | Reconcile across all three specs. The user-flows.md ordering (OCR → confirm → upload) is the most detailed and consistent with Domain 05's §7 flow (which agrees with user-flows). Suggest correcting Domain 06 D6 and §7 flow to match. |
| 2 | D4 Source | Cites `user_flows.md §3` — "Store name heuristic: first non-empty text line in top 30% of image." `user-flows.md` §3 is "Approve / Reject Expense Flow" — unrelated to store name extraction. The OCR extraction is described in §2 (Add Expense Flow, step 31: "Extracted store, date, total pre-fill the form"). Same error exists in the tech-spec ocr-pipeline.md D4. | Blocking | Replace `§3` with `§2`. |

**Open questions:** OCR-Q1 registered ✓.

---

### Domain 07 — `duplicate-detection.md`

**Verdict:** Conditional pass

| # | Section | Issue | Severity | Suggested fix |
|---|---------|-------|----------|---------------|
| 1 | §5 Cross-References | Does not list `domains/05-receipts/receipt-upload.md`. Receipt-upload §6 "Blocks" this spec and §2 Out of scope references it. Reciprocity gap. | Minor | Add `domains/05-receipts/receipt-upload.md` to §5. |
| 2 | D1, D2 Source | Cites `docs/3-reference/lexicon.md` for dHash and Fingerprint definitions. The lexicon entries exist (dHash, Fingerprint) but do not specify the Hamming distance threshold of 10 or the exact string format. Weak provenance. | Minor | Cite the specific tech-spec decision: `tech-specs/backend/duplicate-detection.md` D4 (Hamming threshold). |
| 3 | §7 code | The `q.or()` filter chains `q.eq(q.field("receiptPHash"), hash)` and `q.eq(q.field("receiptFingerprint"), fingerprint)` — this scans the entire collection with a JS callback filter, not via an index. For orgs with many receipts this is O(n). A composite index on `[orgId, receiptPHash]` would be needed for scalable dHash lookup. | Minor | Note that the dHash lookup should use an index; current code does a full collection scan. |

**Open questions:** DUP-Q1 registered ✓.

---

### Domain 08 — `email-notifications.md`

**Verdict:** Conditional pass

| # | Section | Issue | Severity | Suggested fix |
|---|---------|-------|----------|---------------|
| 1 | §6 Dependencies | "Depends on: `expense-management.md`" — expense-management.md §5 Cross-References does NOT list `email-notifications.md`. Reciprocity gap. | Minor | Add `domains/08-notifications/email-notifications.md` to expense-management.md §5. |
| 2 | §6 Dependencies | "Depends on: `onboarding-auth.md`" — onboarding-auth.md §5 Cross-References does NOT list `email-notifications.md`. Gap. | Minor | Add `domains/08-notifications/email-notifications.md` to onboarding-auth.md §5. |
| 3 | §8 Templates | Email HTML templates (Invite Email, Pending Expense Notification) duplicate content from `tech-specs/backend/email-notifications.md` §8. The tech-spec already defines identical templates. Consider referencing rather than redefining. | Minor | Replace §8 with a backtick cross-reference to `tech-specs/backend/email-notifications.md` §8. |

**Open questions:** NOT-Q1 registered ✓.

---

### Domain 09 — `ui-spec.md`

**Verdict:** Needs revision

| # | Section | Issue | Severity | Suggested fix |
|---|---------|-------|----------|---------------|
| 1 | D1, D4 Source | Cites `project_brief.md §61` and `project_brief.md §57` — both invalid. `project_brief.md` has no numbered sections. §61 is a line number (Non-Goals heading); §57 is acceptance criterion 7 (real-time). | Blocking | Replace with `## Non-Goals (v1)` and `## Acceptance Criteria`. |
| 2 | D5 Source | Cites `tech-specs/frontend/ui-spec.md §11.3` for "toast notification patterns". `ui-spec.md` §11 is "Component Patterns" with only two subsections: §11.1 "Button" and §11.2 "Card / Surface". There is no §11.3. The backtick path resolves, but the section number does not exist. | Blocking | Either create §11.3 in the tech-spec for Toast/Notifications, or reference the correct section. Currently the tech-spec ui-spec.md has no toast notification pattern at all — this is a spec gap. |
| 3 | §5 Cross-References | Does NOT list `domains/02-expenses/expense-management.md` or `domains/03-settlements/settlement-management.md`, even though §6 "Depends on" both. These specs DO NOT cross-reference back to ui-spec.md either — mutual gap. | Minor | Add `domains/09-ui/ui-spec.md` to expense-management.md §5 and settlement-management.md §5. |

**Open questions:** UI-D-Q1, UI-D-Q2 registered ✓.

---

### Domain 10 — `deployment.md`

**Verdict:** Needs revision

| # | Section | Issue | Severity | Suggested fix |
|---|---------|-------|----------|---------------|
| 1 | D2 Source | Cites `docs/AGENTS.md §3` for "doc-lifecycle". `AGENTS.md` §3 is "Build, Test, and Lint Commands"; doc lifecycle management is in §1 under "### Doc Lifecycle Management". Incorrect section citation. | Blocking | Replace `§3` with `§1`. |
| 2 | D4, D5, §7 | Cites `project_brief.md §61` and `project_brief.md §59` — both invalid (no numbered sections in project_brief.md). | Blocking | Replace with `## Non-Goals (v1)` (§61 / no staging) and `## Acceptance Criteria` (deploy < 10 minutes). |
| 3 | §8 | References env var `NEXT_PUBLIC_CONVEX_URL` — `nuxt.config.ts` uses `CONVEX_URL` (line 13), and `.env.example` uses `CONVEX_URL`. The tech-spec deployment.md D3 even acknowledges this rename: "Convex deployment URL (replaces `NEXT_PUBLIC_CONVEX_URL`)." The domain spec should not use the old name. | Blocking | Replace `NEXT_PUBLIC_CONVEX_URL` with `CONVEX_URL`. |
| 4 | §8 | References `RESEND_FROM_EMAIL` env var — NOT in `.env.example` (8 vars only: CLERK keys, CONVEX_URL, CONVEX_DEPLOY_KEY, RESEND_API_KEY, R2 vars) and NOT in `nuxt.config.ts` runtimeConfig. Missing from the source of truth. | Blocking | Either add `RESEND_FROM_EMAIL` to `.env.example` and `nuxt.config.ts`, or remove the reference. |
| 5 | §7 step 78a | References health-check URL `https://app.happyhousebills.com/api/health`. This domain does not match `wrangler.toml` (which uses `happy-house-bills.brettlockhart.com`) or the tech-spec deployment.md §28 (which says `happy-house-bill.brettlockhart.com` — singular). Three inconsistent domain names exist across docs. | Minor | Standardise on `happy-house-bills.brettlockhart.com` (matches wrangler.toml). |

**Open questions:** None. ✓

---

### Domain 11 — `security.md`

**Verdict:** Needs revision

| # | Section | Issue | Severity | Suggested fix |
|---|---------|-------|----------|---------------|
| 1 | §3 D1, §9 code | Imports from `@convex-dev/clerk-auth` — NOT in `package.json` (verified). The project uses `@clerk/nuxt`. Same issue as Domain 01. | Blocking | Replace with the actual auth integration mechanism. Note that the planned `convex/auth.ts` file does not exist yet. |
| 2 | §9, §11 code | References `convex/helpers/auth.ts` and `convex/http.ts` — neither file exists (only `convex/schema.ts` on disk). `AGENTS.md` §2 lists them as planned but they are not scaffolded. | Minor | Note these files as planned, not yet created, or replace with prose. |
| 3 | §2 Out of scope | Cites `\`.kilo/templates/security-review.md\`` in backticks — AGENS.md §10 explicitly states "Backtick paths that reference plans or external tooling (paths outside `docs/` like `.kilo/agent/spec-writer.md`) are not real doc links and should not appear in backtick-enclosed `.md` references." Also `security-engineer.md` in backticks resolves to `.kilo/agent/security-engineer.md` (which exists outside docs/ and is not resolved by docs-audit). | Minor | Remove backtick formatting from `.kilo/templates/security-review.md` and `security-engineer.md` — use plain text or code spans without the `.md` suffix. |
| 4 | §5 Cross-References | Cites `tech-specs/backend/file-storage.md` — "R2 upload, storage ID lifecycle, EXIF stripping (HS-006)". File-storage.md §2 does NOT mention EXIF stripping (the `file-storage-security-review.md` HS-006 finding confirms: "EXIF / metadata stripping is not mentioned anywhere in `file-storage.md`"). EXIF stripping is specified in Domain 05 §7 step d and Domain 05 D3, not in file-storage.md. The cross-reference misattributes ownership. | Blocking | Correct the attribution: EXIF stripping belongs to `domains/05-receipts/receipt-upload.md` D3, not `tech-specs/backend/file-storage.md`. |
| 5 | §5 Cross-References | Does NOT list `domains/05-receipts/receipt-upload.md`, `domains/06-ocr/ocr-pipeline.md`, or `domains/10-deployment/deployment.md` — all three reference Domain 11 in their own Cross-References. Three reciprocity gaps. | Minor | Add the three missing domain specs to §5. |
| 6 | §10 Authz Matrix | References "HS-003" for receipt URL retrieval and §12 references "HS-004". These IDs are defined in `file-storage-security-review.md` (an external review document) but are never defined or explained within Domain 11 itself. A reader of Domain 11 alone cannot resolve HS-003/HS-004/HS-006. | Minor | Either define the security-test IDs inline or add a backtick reference to `reviews/file-storage-security-review.md` where they originate. |
| 7 | §11 code | Uses `verifyWebhook` from `@clerk/backend/http` — `@clerk/backend` is not explicitly listed in `package.json` dependencies (it may be a transitive dependency of `@clerk/nuxt`, but this is unverified). If `@clerk/nuxt` does not re-export `@clerk/backend`, the import will fail. | Minor | Verify `@clerk/backend` is available as a dependency. If not, add it to `package.json` or note the transitive dependency. |

**Open questions:** SEC-001, SEC-002 registered ✓.

---

## Cross-Cutting Issues

### Issue 1: `project_brief.md` has no numbered sections (9 of 11 specs affected)

`project_brief.md` uses unnumbered headings: `## Product`, `## Market Position`, `## Business
Model`, `## Tech Stack`, `## Key Modules`, `## Multi-Tenancy Model`, `## Acceptance Criteria`,
`## Non-Goals (v1)`. Every domain spec that cites `project_brief.md §NN` is citing a
non-existent section number. The `§NN` values appear to be line numbers or paragraph numbers
from an earlier version of the document, not section numbers.

**Affected specs:** Domain 01 (§25-32, §26-32, §29-30, §170-182, §32), Domain 02 (§50-54, §54,
§69), Domain 03 (§61), Domain 04 (§57), Domain 05 (§48), Domain 06 (§31, §48), Domain 09
(§61), Domain 10 (§59, §61).

**Impact:** Medium — the citations cannot be resolved by a reader following the link. The
underlying content is usually correct (the spec is pointing at the right topic), but the
anchor is wrong.

**Remediation:** This is a project-wide issue. All `§NN` citations to `project_brief.md`
should be replaced with the actual heading text (e.g. `## Acceptance Criteria`, `## Non-Goals`).
Note: this issue also affects the tech-specs — was previously flagged in
`tech-specs-batch-review.md`.

### Issue 2: `user_flows.md` filename uses underscore instead of hyphen (5 specs affected)

The actual file is `user-flows.md` (hyphen). Domain 02, Domain 05 (via Domain 06),
Domain 06, Domain 07, Domain 08, and Domain 09 write `user_flows.md` (underscore) in
backtick references. `docs-audit.ts` resolves these via underscore-to-hyphen conversion, but
`AGENTS.md` §10 requires "the actual lowercase filename."

**Affected specs:** Domains 02, 06, 07, 08, 09 (and the tech-specs). Domain 01 uses the correct
hyphenated form.

**Impact:** Low — automated tools resolve it, but a strict reader or external tool would not
find the file.

### Issue 3: `@convex-dev/clerk-auth` is not installed (2 specs affected)

Domain 01 §Auth Context code and Domain 11 §9/§11 code both import `getAuthUser` from
`@convex-dev/clerk-auth`. This package is NOT in `package.json` (verified: only `@clerk/nuxt`,
`@convex-dev/r2`, `convex`, `convex-vue`, `resend`, and `tesseract.js` are installed). The
project's auth stack is `@clerk/nuxt` (nuxt.config.ts:4).

**Impact:** Medium — code examples will not compile. The package may be a planned addition
(see `AGENTS.md` §2 listing `convex/auth.ts` as planned), but it is not yet implemented.

### Issue 4: Planned Convex source files do not exist on disk (4 specs affected)

`AGENTS.md` §2 lists `convex/auth.ts`, `convex/http.ts`, `convex/functions/expenses.ts`,
`convex/functions/settlements.ts`, `convex/functions/orgs.ts` as the project layout. Only
`convex/schema.ts` exists on disk. These files are referenced in code blocks and
cross-references across Domain 01 (§Auth Context → `convex/auth.ts`), Domain 05 (§8 →
`convex/storage.ts`), and Domain 11 (§9 → `convex/helpers/auth.ts`, §11 → `convex/http.ts`).

**Impact:** Low for a spec document — these are planned paths, not current files. But specs
should not anchor code examples to non-existent file paths, as it misleads implementers about
the current state.

### Issue 5: Status inconsistency across four sources (all domain specs)

| Source | Domain 01 | Domain 02 | ... | Domain 11 |
|--------|-----------|-----------|-----|-----------|
| Spec frontmatter | Draft | Draft | — | Draft |
| `spec-gaps.md` §3 (Status Table) | Draft | Draft | — | Draft |
| `spec-gaps.md` §6 (Next Actions) | `[x]` done | `[x]` done | — | `[x]` done |
| Domain README.md | **Complete** | **Missing** | — | **Missing** |

Domain 01 README says "Complete" but spec-gaps.md and frontmatter say "Draft". Domains 02–11
READMEs say "Missing" but the spec files exist and spec-gaps §6 marks them `[x]` done. The
READMEs were not updated when the specs were created.

**Impact:** Medium — a contributor reading the README would not know the spec exists, or would
assume Domain 01 is final when it's still Draft.

**Note on doc-lint `checkNextActionsSync`:** The §6 checklist uses `- [x]` (task-list syntax),
not `~~strikethrough~~`. The `doc-lint.ts` `checkNextActionsSync` function only checks lines
starting with `~~` for struck-through status. Since `[x]` is not `~~`, the checker silently
passes — it does not flag that §6 says "done" while READMEs say "Missing."

### Issue 6: `spec-gaps.md` open-question count is stale

The appendix states "Open questions | 12" but the Open Questions Register (§6) contains 15
entries: 14 open + 1 resolved (~~UI-Q2~~). Every open question from every domain and tech-spec
is registered in the register with a unique ID ✓ — the count in the appendix is simply wrong.

**Impact:** Low — informational only, but could mislead a contributor about scope.

### Issue 7: `convex.json` does not contain environment variables

Project-scaffolding.md §9 (tech-spec) describes `convex.json` as "Convex project configuration,
environment variables." The actual `convex.json` (verified) contains only `name`, `link`,
`functions.maxExecutionTimeSeconds`, and `crons`. Environment variables are managed in the
Convex dashboard, not in `convex.json`. The tech-spec is accurate in its own content but the
scaffolding doc's description is slightly misleading. Domain 10 does not make this claim
directly, but its cross-references and §8 env-var table inherit the assumption.

**Impact:** Low — affects tech-specs, not domain specs directly. Noted for awareness.

### Issue 8: OCR before/after upload contradiction (2 domain specs affected)

`receipt-upload.md` §7 step 7 states: "OCR runs on the original image (before R2 upload)."
`ocr-pipeline.md` D6 states: "OCR runs after upload to R2, not before — User sees the preview
first; OCR can be retried without re-uploading." `user-flows.md` §2 steps 30–41 show OCR
before upload (step 30: Tesseract runs; step 41: upload to R2).

**Status:** Receipt-upload.md and user-flows.md agree (OCR before upload). ocr-pipeline.md
D6 disagrees.

**Impact:** High — these specs define conflicting data-flow assumptions that will lead to
different implementations. Must be reconciled before ratification.

### Issue 9: Convex auth helper inconsistency (3 specs affected)

Three different auth-helper patterns appear across domain specs:
- Domain 01 §Auth Context: `getOrgId(ctx)` → `const user = await getAuthUser(ctx); return user.org_id`
- Domain 11 §9: `requireAuthenticatedOrg(ctx)` → returns `{ userId: user.userId, orgId: user.org_id }`
- Domains 02, 03, 04 §8/§9 code: `requireAuthenticatedOrg(ctx)` → destructures `{ userId, orgId }`

The `getAuthUser` return shape also differs:
- api-contract.md §8: `identity.org_id` (no `userId` field accessed)
- Domain 11 §9: `user.userId` AND `user.org_id` (both checked)
- Domain 01 §Auth Context: only `user.org_id` accessed

**Impact:** Medium — implementers following different specs will write inconsistent auth
guards. One canonical helper should be defined in Domain 01 (the auth spec) and referenced
by all others.

---

## Automated Validator Status

| Validator | Command | Domain specs covered? | Status |
|-----------|---------|---------------------|--------|
| `doc-lint.ts` | `npm run docs:lint` | Yes (all docs) | ⚠ 1 warning (review queue stale) |
| `docs-audit.ts` | `npm run docs:audit` | Partially (checks 6–13 only scan tech-specs) | ⚠ 0 errors, 19 warnings, 11 info |

**What the validators miss for domain specs:**
- `docs-audit.ts` check 6 (spec section completeness) only scans `tech-specs/` — domain spec
  template compliance (numbered headings) is NOT automated.
- `docs-audit.ts` check 10 (frontmatter) only scans `tech-specs/` — domain spec frontmatter
  is NOT automated.
- `docs-audit.ts` check 12 (decision tables) only scans `tech-specs/` — domain spec decision
  table presence is NOT automated.
- `docs-audit.ts` check 9 (cross-reference reciprocity) only checks tech-spec ↔ tech-spec
  pairs. Domain ↔ domain reciprocity is NOT checked (per `AGENTS.md` §9 Remediation
  Verification: "docs-audit.ts check 9 inspects tech-spec pairs only").
- `doc-lint.ts` `checkNextActionsSync` only fires on `~~strikethrough~~`, not `- [x]`, so
  the §6 checklist vs. README status mismatch is invisible to automation.
- Neither validator checks `§NN` citation accuracy against actual heading numbers in the
  target file. This is explicitly a manual spec-rewriter/spec-reviewer responsibility per
  `AGENTS.md` §10 ("Use the heading text, not a stale number").

---

## Summary Assessment

The 11 domain specs are structurally complete — all have the six required sections, all meet
the D1–D3 decision minimum, and all open questions are registered in `spec-gaps.md`. However,
**every spec except Domain 11 has at least one blocking issue**, concentrated in three areas:

1. **Invalid `project_brief.md` section citations** — a project-wide convention failure where
   specs cite `§NN` for a document that has no numbered sections. Nine of eleven specs are
   affected. This is the single largest category of finding.

2. **Factual errors against ground-truth sources** — `@convex-dev/clerk-auth` (Domain 01, 11),
   non-existent file paths (`convex/auth.ts`, `convex/http.ts`, `convex/helpers/auth.ts`,
   `convex/storage.ts` — Domains 01, 05, 11), wrong env var names (`NEXT_PUBLIC_CONVEX_URL`
   vs. `CONVEX_URL` — Domain 10), and incorrect Convex API (`new Mutation(...)` and
   `storageId` from `db.insert()` — Domains 02, 03).

3. **Cross-spec factual contradictions** — the OCR-before/after-upload contradiction between
   Domains 05 and 06 is the most severe, as it affects the data flow for the core feature.

Four specs (01, 05, 11, and borderline 06) require a spec-level `security-engineer` handoff.
The prior `file-storage-security-review.md` already covered the tech-spec counterparts; the
domain specs should be checked for consistency against those findings (particularly HS-001,
HS-003, HS-008, HS-012).

---

## Recommendations

1. **Fix `project_brief.md` citations** — Replace all `§NN` references with actual heading
   text across all domain and tech specs. This is a project-wide cleanup; recommend running
   `/spec-review` on each spec after fixes.

2. **Reconcile OCR data flow** — Domains 05 and 06 must agree on whether OCR runs before or
   after R2 upload. `user-flows.md` §2 (steps 30–41) supports OCR-before-upload. Recommend
   aligning Domains 05 §7 and 06 D6 with user-flows.

3. **Correct factual errors** — Replace `@convex-dev/clerk-auth` imports with the actual
   auth integration (`@clerk/nuxt`), fix the Convex API syntax (`mutation({...})`), and correct
   the `storageId` return from `db.insert()`.

4. **Update Domain READMEs** — Domains 02–11 should say "Draft" (not "Missing") in their
   README status tables. Domain 01 should remain "Draft" (not "Complete") to match
   spec-gaps.md §3 and the frontmatter.

5. **Unify the auth helper** — Domain 01 should define `requireAuthenticatedOrg(ctx)` as the
   canonical helper (matching Domain 11 §9), and Domains 02, 03, 04 should reference it via
   cross-reference rather than redefining it.

6. **Fix env var references** — Domain 10 §8 should use `CONVEX_URL` (not
   `NEXT_PUBLIC_CONVEX_URL`). The missing `RESEND_FROM_EMAIL` from `.env.example` and
   `nuxt.config.ts` should be added (tracked as HS-014 in the prior security review).

7. **Restore reciprocity** — Add missing back-references in Domain 02 (→ email-notifications),
   Domain 03 (→ expenses), Domain 04 (already ✓), Domain 05 (→ duplicate-detection),
   Domain 06 (→ expenses), Domain 07 (→ receipt-upload), Domain 08 (→ expenses, onboarding),
   Domain 09 (→ expenses, settlements), Domain 10 (→ none missing in §5), Domain 11
   (→ receipt-upload, ocr-pipeline, domain deployment).

8. **Correct cross-reference attributions** — Domain 11 §5 misattributes EXIF stripping to
   `file-storage.md`; it belongs to Domain 05 D3. Fix the ownership chain.

9. **Initiate security handoffs** — Domains 01, 05, and 11 require a spec-level
   `security-engineer` review. Domain 06 should be re-verified against HS-008.

10. **Fix `spec-gaps.md` appendix count** — "Open questions | 12" should be 14 (the actual
    number of open, non-struck-through questions in the register).
