---
status: Draft
package: app
priority: high
created: 25-October-2026
updated: 25-October-2026
tags: [security, auth, pii, retention, compliance, gdpr, data-lifecycle]
---

# Domain Spec: Security & Compliance

**Date:** 25-October-2026
**Status:** Draft
**Audience:** Backend engineers, security engineer

## 1. Purpose

Define the security and compliance posture for Happy House Bills: authentication boundaries, PII handling, data retention policies, and the deletion/export flows. This spec is the authoritative source for GDPR lawful basis, retention periods (## 8. Retention Policy), and data lifecycle management across all durable stores (Convex document store, Cloudflare R2, Clerk SaaS).

## 2. Scope

### In scope

- Auth boundaries per Convex function (org-scoped queries via `getUserIdentity()` + JWT `org_id` claim)
- PII categorisation: expense data, receipt images, user email addresses, Clerk user IDs
- Retention periods per data category (## 8. Retention Policy table)
- GDPR lawful basis per data category
- Data export flow (user requests all their data)
- Data deletion flow (account deletion → cascade to all stores)
- Cookie/local storage policy (no persistent client-side storage in v1)
- R2 key least-privilege scoping (single bucket, read/write only)
- Webhook signature verification (Clerk → Convex via Svix HMAC)
- Content-Type allowlist for uploaded receipts

### Out of scope

- Cryptographic implementation details (Convex/Clerk handle auth crypto; see security-review template at `.kilo/templates/security-review.md`)
- CSP header configuration for preview/export (no iframe, preview, or export pipeline in v1)
- Penetration testing (deferred to slice-level review)
- Rate limiting strategy (Convex framework concern; deferred to slice-level review)
- Dependency vulnerability triage (CI/CD concern; see `tech-specs/architecture/ci-cd.md`)

## 3. Key Decisions

| ID | Decision | Rationale | Source |
|----|----------|-----------|--------|
| D1 | Auth via Clerk + Convex `getUserIdentity()` at every function entry | Convex functions are stateless; auth context comes from the Clerk session JWT; every query/mutation must verify identity | `docs/AGENTS.md` (## 4. Code Style — Path Safety) |
| D2 | `orgId` derived from Clerk session JWT, never from client input | Prevents cross-tenant data access; auth context is server-trusted | `tech-specs/backend/data-model.md` D2, `tech-specs/backend/api-contract.md` D2 |
| D3 | Receipt upload restricted to JPEG, PNG, HEIC; max 5 MB; max 4000 × 4000 px | Reduces attack surface from malicious uploads; matches mobile camera output | `tech-specs/backend/file-storage.md` D5, `project_brief.md` (## Acceptance Criteria) |
| D4 | EXIF metadata stripped from receipt images before storage | Receipts may carry GPS location; stripping prevents inadvertent PII leakage | GDPR data minimisation principle, Article 25 |
| D5 | 30-day hard retention for receipts and expenses after soft-delete | GDPR-compliant default; balances user recovery needs with data minimisation | security-engineer review (retention schedule) |
| D6 | Data export returns JSON of all user-scoped data (expenses, settlements, receipts metadata) | User right to data portability (GDPR Article 20) | GDPR Article 20, `docs/AGENTS.md` (## 4. Code Style — Never Log Secrets) |
| D7 | Data deletion cascades: account deletion → delete Clerk user → delete all Convex rows for org → delete R2 objects | Prevents orphaned data; ensures complete removal on user request | GDPR Article 17 (right to erasure) |
| D8 | Webhook signature verification via `CLERK_WEBHOOK_SECRET` (HMAC) | Prevents webhook forgery; only Clerk can send valid payloads | OWASP API1:2023 Broken Object Level Authorization, CWE-345 |

## 4. Open Questions

| ID | Question | Status | Notes |
|----|----------|--------|-------|
| SEC-001 | Should R2 receipt objects be encrypted at rest with a per-organisation key, or rely on R2 default encryption? | Resolved | R2 default encryption is sufficient for v1; per-org keys add management overhead |
| SEC-002 | Should we implement a GDPR Data Processing Agreement (DPA) with Clerk and Resend, or rely on their standard terms? | Resolved | Rely on standard terms — established providers; implement DPA only if EU user base grows |

## 5. Cross-References

- `tech-specs/backend/data-model.md` — schema fields for user IDs, receipt hash fields
- `tech-specs/backend/api-contract.md` — `expenses:uploadReceipt` action, auth enforcement pattern
- `tech-specs/backend/file-storage.md` — R2 upload handler, EXIF stripping, content-type allowlist, signed URL generation
- `domains/05-receipts/receipt-upload.md` — EXIF stripping (Domain 05 D3), dimension limits
- `domains/06-ocr/ocr-pipeline.md` — client-side OCR, XSS prevention for OCR text rendering (HS-010)
- `domains/06-ocr/ocr-pipeline.md` — client-side OCR processing of user-supplied images
- `tech-specs/frontend/ocr-pipeline.md` — client-side OCR processing, EXIF context
- `tech-specs/architecture/deployment.md` — `CLERK_WEBHOOK_SECRET` env var, Clerk webhook setup
- `domains/01-auth/onboarding-auth.md` — auth flow, org creation
- `spec-gaps.md` — gap tracking, Open Questions Register

## 6. Implementation Dependencies

- **Depends on:** `onboarding-auth.md` (auth context), `data-model.md` (schema), `api-contract.md` (function surface)
- **Blocks:** `file-storage.md` (retention), `deployment.md` (webhook verification)
- **Consumer integration:** Convex functions call `getUserIdentity()` for every request; R2 component strips EXIF; Convex scheduler handles deletion cascade

## 7. PII Data Catalogue

| Data element | Store | Collected via | Purpose | GDPR lawful basis |
|-------------|-------|--------------|---------|-------------------|
| Email address | Clerk SaaS | Sign-up form | User identification, invite delivery | Contract necessity (Article 6.1.b) |
| Clerk user ID | Convex (paidBy, paidBy, enteredBy) + Clerk | Auth flow | Expense ownership tracking | Contract necessity |
| Organisation name | Clerk SaaS | Onboarding | Household grouping | Contract necessity |
| Expense amount, date, category | Convex document store | Manual entry / OCR | Bill splitting | Contract necessity |
| Receipt image | Cloudflare R2 | Camera upload | Duplicate detection, record keeping | Contract necessity |
| Receipt dHash/fingerprint | Convex document store | Derived from image | Duplicate detection | Legitimate interest in fraud prevention |
| Raw OCR text (transient) | Browser memory only | OCR processing | Form pre-fill | N/A — not persisted |

## 8. Retention Policy

| Data category | Store | Retention period | Deletion trigger | Reference |
|---------------|-------|-----------------|------------------|-------------|
| Receipt images | Cloudflare R2 | 30 days after `deletedAt` | Soft-delete from expense; hard-delete after 30 days | D5 |
| Expense records | Convex document store | 30 days after `deletedAt` | Soft-delete; hard-delete after 30 days | D5 |
| Settlement records | Convex document store | 30 days after `deletedAt` | Soft-delete; hard-delete after 30 days | D5 |
| User accounts | Clerk SaaS | 30 days after deletion request | Account deletion flow | D5 |
| Clerk audit logs | Clerk SaaS | Clerk's policy (7 days) | Clerk-managed | N/A — Clerk default |
| Browser OCR memory | Client memory | Tab-scoped | Page unload | N/A — non-durable |
| Email templates/sends | Resend | 90 days (Resend default) | Resend-managed | N/A — provider default |

## 9. Auth Enforcement

Every Convex function begins with auth verification:

```typescript
// convex/auth.ts
export async function requireAuthenticatedOrg(
  ctx: { auth: { getUserIdentity: () => Promise<UserIdentity | null> } }
): Promise<{ userId: string; orgId: string }> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Unauthenticated");
  const userId = identity.subject;
  const orgId = identity.org_id; // from Clerk JWT template custom claim
  if (!userId || !orgId) throw new Error("Unauthenticated or no organisation");
  return { userId, orgId };
}
```

Every query scopes by org via index-based filtering:

```typescript
const { orgId } = await requireAuthenticatedOrg(ctx);
return ctx.db
  .query("expenses")
  .withIndex("by_org", (q) => q.eq("orgId", orgId))
  .filter((q) => q.neq(q.field("status"), "pending"))
  .collect();
```

Cross-tenant enforcement is applied on every data access path: `expense.orgId === orgId`.

## 10. Authz Matrix

| Operation | Who can perform | Enforcement point |
|-----------|----------------|------------------|
| Upload receipt | Authenticated user in org | `expenses:uploadReceipt` action validates `requireAuthenticatedOrg` |
| Retrieve receipt URL | User who owns expense OR partner in same org | `getReceiptUrl` query checks `storageId` belongs to an expense with `orgId === user.orgId` (HS-003) |
| Create expense | Either member of household | `expenses:create` mutation validates org membership via `requireAuthenticatedOrg` |
| Approve/reject expense | Partner of expense creator | `expenses:approve/reject` checks `enteredBy !== approvedBy` |
| Record settlement | Either member of household | `settlements:create` validates org membership |
| Delete expense | Creator only (pending) / either (approved) | `expenses:delete` — pending: creator only; approved: either member can request deletion |
| Delete account | Authenticated user | Triggers cascade: delete Clerk user → delete Convex rows → delete R2 objects |

## 11. Webhook Verification

Implemented in `convex/http.ts`. Clerk signs webhooks via Svix using HMAC-SHA256.
The Convex HTTP action verifies the signature before processing any event:

```typescript
// convex/http.ts
import { createHmac } from "crypto";

const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;

export const verifyWebhook: HttpAction = httpAction(async (ctx, req) => {
  const payload = await req.text();
  const signature = req.headers["svix-signature"];
  const timestamp = req.headers["svix-timestamp"];

  const toSign = `${timestamp}.${payload}`;
  const hmac = createHmac("sha256", WEBHOOK_SECRET);
  hmac.update(toSign);
  const expected = `v1,${hmac.digest("hex")}`;

  const sigBytes = new TextEncoder().encode(signature);
  const expectedBytes = new TextEncoder().encode(expected);
  if (!crypto.timingSafeEqual(sigBytes, expectedBytes)) {
    return new Response("Invalid signature", { status: 401 });
  }

  const event = JSON.parse(payload);
  switch (event.type) {
    case "organization.deleted":
      await ctx.scheduler.runAfter(0, "cleanup:organization", {
        orgId: event.data.id,
      });
      break;
  }
  return new Response("OK", { status: 200 });
});
```

The `CLERK_WEBHOOK_SECRET` is configured in the Clerk dashboard under Webhooks and stored
in Convex environment variables. See `tech-specs/architecture/deployment.md` (§4 Secrets)
for the env var wiring and rotation schedule.

## 12. Upload Content-Type Allowlist

| Allowed type | Extension | Magic bytes |
|-------------|-----------|------------|
| JPEG | .jpg, .jpeg | `FF D8 FF` |
| PNG | .png | `89 50 4E 47` |
| HEIC | .heic | `00 00 00 ?? 66 74 79 70 68 65 69 63` |

Server-side validation must check both the declared Content-Type and the file's magic bytes. Any mismatch is rejected — this closes the content-spoofing vector flagged as HS-004.

## 13. Secrets Management

| Secret | Source | Rotation | Scope |
|--------|--------|----------|-------|
| `CLERK_WEBHOOK_SECRET` | Clerk dashboard → Webhooks | Every 90 days | Verifies Clerk → Convex webhook payloads (HS-012) |
| `RESEND_API_KEY` | Resend dashboard | Every 90 days | Transactional email dispatch |
| `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` | Cloudflare dashboard | Every 90 days | Scoped to `hhb-receipts` bucket only (least-privilege — HS-016) |
| `CONVEX_DEPLOY_KEY` | Convex dashboard | Every 90 days | Used by CI to deploy backend |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk dashboard | N/A | Public key — safe for client exposure |

**SRI enforcement (HS-008):** When loading external scripts or language data files from a CDN (e.g. Tesseract.js language data via jsdelivr), every `<script>` tag must include an `integrity` attribute with a SHA-384 hash. The hash must be copied from the CDN's published integrity value, not self-generated. Pin exact dependency versions in `package.json` — never use `^` or `~` ranges for security-sensitive packages.

**Cloudflare API token (HS-016):** Must be scoped to `Account R2 Bucket → Edit` on the `hhb-receipts` bucket only. Never grant `Edit` on "All Accounts". Rotate quarterly.
