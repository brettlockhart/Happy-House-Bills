---
status: Draft
package: backend
priority: high
created: 25-October-2026
updated: 25-October-2026
tags: [backend, storage, r2, receipts, convex-dev-r2, cloudflare]
---

# Tech Spec: File Storage

**Date:** 25-October-2026
**Status:** Draft
**Audience:** Backend engineers, frontend engineers

## 1. Purpose

Define how receipt images are uploaded, stored, and served in Happy House Bills. Receipts are stored as binary objects in Cloudflare R2 via the `@convex-dev/r2` Convex component. The storage layer provides upload, signed-URL retrieval, and lifecycle management — all scoped to the authenticated Clerk organisation.

## 2. Scope

### In scope

- `@convex-dev/r2` component integration in `convex/`
- Convex action `expenses:uploadReceipt` — accepts base64 image, stores in R2, returns storage ID
- R2 bucket configuration and environment variables
- Signed URL generation for receipt retrieval (short-lived, org-scoped)
- Storage ID lifecycle: stored on `expenses.receiptImageId`, deleted when expense is soft-deleted
- Image size validation (max 5 MB, max 4000 × 4000 px)
- Content-Type and extension enforcement (JPEG, PNG, HEIC)

### Out of scope

- OCR processing of receipt images (covered by `tech-specs/frontend/ocr-pipeline.md`)
- dHash computation and storage (covered by `tech-specs/backend/duplicate-detection.md`)
- Email notification templates (covered by `tech-specs/backend/email-notifications.md`)
- Convex schema definitions (covered by `tech-specs/backend/data-model.md`)

## 3. Key Decisions

| ID | Decision | Rationale | Source |
|----|----------|-----------|--------|
| D1 | Use `@convex-dev/r2` component for R2 integration | Provides typed API, automatic env binding, and serverless-friendly upload path | `project_brief.md` (## Tech Stack) |
| D2 | `uploadReceipt` is a Convex action, not a mutation | Actions can perform async I/O to external storage; mutations cannot | `tech-specs/backend/api-contract.md` D3 |
| D3 | Store only the R2 storage ID on the expense, not the file blob | Convex document store has a 1 MB limit; R2 is designed for binary objects | `project_brief.md` (## Tech Stack) |
| D4 | Return signed URLs for retrieval (not public URLs) | Prevents unauthenticated access to receipt images; signed URLs expire after 1 hour | `domains/11-security/security.md` (## 10. Authz Matrix — retrieve receipt URL) |
| D5 | Validate image dimensions server-side after upload | Prevents oversized files from consuming R2 budget; base64 size is easily spoofed | `project_brief.md` (## Acceptance Criteria) |
| D6 | Auth enforced via `requireAuthenticatedOrg(ctx)` at action entry | Prevents unauthenticated uploads; org scoping prevents cross-tenant data access | `domains/11-security/security.md` (## 9. Auth Enforcement), `tech-specs/backend/api-contract.md` (## 3. Key Decisions) |
| D7 | Ownership check on receipt retrieval | `getReceiptUrl` validates the storage ID belongs to an expense in the caller's org | `domains/11-security/security.md` (## 10. Authz Matrix) |

## 4. Open Questions

| ID | Question | Status | Notes |
|----|----------|--------|-------|
| (none) | — | — | — |

## 5. Cross-References

- `convex/schema.ts` — `receiptImageId: v.optional(v.id("_storage"))` on `expenses` table
- `tech-specs/backend/data-model.md` — schema definition
- `tech-specs/backend/api-contract.md` — `expenses:uploadReceipt` action, `expenses:getReceiptUrl` query
- `tech-specs/frontend/ocr-pipeline.md` — front-end upload flow
- `domains/05-receipts/receipt-upload.md` — domain workflow
- `domains/11-security/security.md` — retention policy, authz matrix, R2 key least-privilege
- `spec-gaps.md` — gap tracking

## 6. Implementation Dependencies

- **Depends on:** `data-model.md` (storage ID field on expenses table), `api-contract.md` (auth helper `requireAuthenticatedOrg`)
- **Blocks:** `duplicate-detection.md`, `domains/05-receipts/receipt-upload.md`, `domains/11-security/security.md` (## 5. Cross-References, ## 10. Authz Matrix)
- **Consumer integration:** Frontend `useOCR` composable calls `expenses:uploadReceipt`; backend `expenses:create` mutation reads `receiptImageId`
- **Retention (data lifecycle):** Receipt images retained 30 days after soft-delete, then hard-deleted from R2. This matches the retention schedule in `domains/11-security/security.md` (## 8. Retention Policy, D5).

## 7. R2 Configuration

```toml
# wrangler.toml — R2 binding (HS-016: least-privilege keys)
[[r2_buckets]]
binding = "HHB_RECEIPTS"
bucket_name = "hhb-receipts"

# Cloudflare API token for R2 must have scope:
# Account → Account R2 Bucket → Edit only on hhb-receipts
# Never grant Account R2 Bucket → Edit on All Accounts
```

| Variable | Description |
|----------|-------------|
| `R2_BUCKET_NAME` | Cloudflare R2 bucket name for receipts (`hhb-receipts`) |
| `R2_ACCOUNT_ID` | Cloudflare account ID (auto-set by Convex component) |
| `R2_ACCESS_KEY_ID` | R2 access key (S3-compatible) — scoped to `hhb-receipts` only |
| `R2_SECRET_ACCESS_KEY` | R2 secret key — scoped to `hhb-receipts` only |
| `RECEIPT_SIGNED_URL_TTL` | TTL for signed URLs in seconds (default: 3600) |

**HS-016 (least-privilege):** The Cloudflare API token used for R2 must be scoped to the `hhb-receipts` bucket only — never use a token with broad `Edit` scope on "All Accounts". Rotate keys every 90 days. See `domains/11-security/security.md` (## 13. Secrets Management) for R2 key scope and rotation policy.

## 8. Upload Handler (`uploadReceipt`)

```typescript
// convex/storage.ts — uploaded via @convex-dev/r2 component
import { R2 } from "@convex-dev/r2";
import { v } from "convex/value";
import { requireAuthenticatedOrg } from "./auth"; // planned import — convex/auth.ts not yet scaffolded
import { stripExif } from "convex/utils/imageUtils"; // planned: move to convex/utils/ or handle inline

const ALLOWED_CONTENT_TYPES = new Set(["image/jpeg", "image/png", "image/heic"]);
const MAX_DIMENSION = 4096;

export const uploadReceipt = R2.action({
  args: {
    image: v.string(), // base64-encoded JPEG/PNG
    fileName: v.string(),
    contentType: v.string(),
  },
  handler: async (ctx, args) => {
    // HS-001: Auth guard — reject unauthenticated or unscoped requests
    const { orgId } = await requireAuthenticatedOrg(ctx);

    // Validate size before decoding
    const buffer = Buffer.from(args.image, "base64");
    if (buffer.length > 5 * 1024 * 1024) {
      throw new Error("File too large: max 5 MB");
    }

    // HS-004: Content-type allowlist (server-side, not client-trustable)
    if (!ALLOWED_CONTENT_TYPES.has(args.contentType)) {
      throw new Error(`Unsupported content type: ${args.contentType}`);
    }

    // HS-005: Validate image dimensions
    const { width, height } = await validateImageDimensions(buffer);
    if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
      throw new Error("Image dimensions exceed maximum");
    }

    // HS-006: Strip EXIF metadata (GPS, camera serial, etc.) before storage
    const cleanBuffer = await stripExif(buffer);

    // Upload to R2
    const id = await ctx.storage.store(
      cleanBuffer,
      args.contentType,
      args.fileName
    );

    return { storageId: id };
  },
});

async function validateImageDimensions(buffer: Buffer): Promise<{ width: number; height: number }> {
  // Magic-byte check + dimension parse using sharp or similar
  // Placeholder: real impl uses image metadata parsing
  return { width: 1920, height: 1080 };
}
```

## 9. Signed URL Retrieval

Retrieval happens through a Convex query that generates a short-lived signed URL:

```typescript
export const getReceiptUrl = R2.query({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, args) => {
    // HS-001 / HS-003: Auth + ownership check — storageId must belong to
    // an expense in the caller's org
    const orgId = await requireAuthenticatedOrg(ctx);

    // Verify the receipt belongs to this org
    const expense = await ctx.db
      .query("expenses")
      .withIndex("by_receiptImageId", (q) => q.eq("receiptImageId", args.storageId))
      .filter((q) => q.eq(q.field("orgId"), orgId))
      .unique();

    if (!expense) {
      throw new Error("Receipt not found or access denied");
    }

    const ttl = Number(process.env.RECEIPT_SIGNED_URL_TTL) || 3600;
    const url = await ctx.storage.getUrl(args.storageId, {
      expiresIn: ttl,
    });
    if (!url) throw new Error("Failed to generate signed URL");
    return { url };
  },
});
```
