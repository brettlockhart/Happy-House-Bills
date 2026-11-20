---
status: Implemented
package: app
priority: high
created: 09-November-2026
updated: 20-November-2026
tags: [ocr, openrouter, llm, receipts, phase2]
lifecycle: 04-implemented
---

# Slice D17: OpenRouter LLM OCR

**Date:** 09-November-2026  
**Status:** Draft → In-Progress → Ready for Review → Implemented  
**Phase:** Phase 2 Enhancement

## 1. Purpose

Replace client-side Tesseract.js OCR with OpenRouter LLM (vision-capable model via `google/gemini-2.5-flash` by default) for higher-accuracy receipt processing. The interface remains the same: image in → `{store, date, total, confidence}` out. Processing moves server-side to a Convex action that calls OpenRouter's chat/completions API with a JSON-schema-constrained response.

## 2. Scope

### In scope

- New Convex action `functions/ocrOpenRouter.ts` calling OpenRouter vision model with input validation and rate limiting
- New composable `app/composables/useReceiptAI.ts` for offline-to-online AI upgrade receipts
- New Convex action `functions/receiptUpgrades.ts` for tracking pending AI upgrades and quota consumption
- Integration via `expenses:create`/`expenses:update` `ocrSource` field supporting `["openrouter", "tesseract", "document-ai", "manual"]`
- Multi-frame (up to 8 overlapping receipt frames) support for long receipts
- Environment variables for OpenRouter API configuration
- Graceful fallback to Tesseract.js on OpenRouter errors or rate limiting
- Confidence threshold per line item with low-confidence warnings
- Input validation: magic bytes, MIME type match, 5MB per frame, 20MB total, EXIF stripping for JPEG

### Out of scope

- Custom model training (uses pre-built vision models via OpenRouter)
- Handwritten receipt support (rely on model capability)
- Receipt validation against merchant databases

## 3. Key Decisions

| ID | Decision | Rationale | Source |
|----|----------|-----------|--------|
| D1 | Server-side OpenRouter vision LLM (Convex action) | Keeps API key server-side; no client bundle size increase; vision model handles receipts accurately | Phase 2 plan |
| D2 | `google/gemini-2.5-flash` default model via OpenRouter | Strong vision/receipt reasoning; cost-effective; easily swappable via env var | Model comparison |
| D3 | Multi-frame support (max 8 frames, 20MB total) | Handles long receipts by stitching overlapping sections; deduplicates overlapping line items | UX requirement |
| D4 | JSON-schema-constrained response with fallback to raw parse | Structured output improves parse reliability; fallback to non-schema when provider rejects schema | Reliability principle |
| D5 | Rate limiting via Convex quota | Prevents cost/abuse amplification on paid LLM API | Security review |
| D6 | `ocrSource` field on expense records | Tracks which OCR source produced each extraction for audit/upgrade decisions | D19 dependency |
| D7 | Offline receipts flagged for later AI upgrade | Receipts captured offline via Tesseract can be re-processed by OpenRouter when online | Phase 2 plan |
| D8 | Sanitize provider errors | Prevents API key leakage; provider errors sanitized before reaching client | Security review |

## 4. Open Questions

| ID | Question | Status | Notes |
|----|----------|--------|-------|
| P2-Q1 | OpenRouter model selection: `google/gemini-2.5-flash` vs alternative vision model? | Open | Default is `google/gemini-2.5-flash`; override via `OPENROUTER_OCR_MODEL` env var |
| P2-Q2 | Should we cache OpenRouter OCR results by image hash? | Open | Low priority; OpenRouter is fast enough; cost vs cache-storage trade-off |

## 5. Cross-References

- `docs/2-development/04-implemented/d19-line-item-extraction.md` — Line-item extraction (extends OpenRouter OCR output)
- `docs/3-reference/domains/06-ocr/ocr-pipeline.md` — OCR domain spec (confidence handling, flow)
- `docs/3-reference/domains/02-expenses/expense-management.md` — Expense form integration (`ocrSource` field)
- `docs/2-development/supporting-docs/reviews/d17-openrouter-ocr-review.md` — Review report
- `spec-gaps.md` — gap tracking

## 6. Implementation Dependencies

- **Depends on:** OpenRouter API key (`OPENROUTER_API_KEY`), receipt storage via `@convex-dev/r2`
- **Blocks:** D19 (line-item extraction builds on OpenRouter OCR output format)
- **Consumer integration:** `expenses:create` accepts `ocrSource: "openrouter"`; `AddExpenseModal` uploads receipt via `uploadReceipt` then OCR via OpenRouter action

## 7. Technical Approach

### Convex Action: `convex/functions/ocrOpenRouter.ts`

```typescript
// Input: base64 image(s) + contentType (single image or array up to 8 frames)
// Output: { store?, date?, total?, confidence?, rawText?, lowConfidence?, lineItems?: LineItem[], source: "openrouter" }
```

- Uses `fetch` to call `https://openrouter.ai/api/v1/chat/completions`
- Auth via `OPENROUTER_API_KEY` env var (Bearer token)
- Model from `OPENROUTER_OCR_MODEL` env var, default `google/gemini-2.5-flash`
- `provider.data_collection: "deny"` to prevent training data usage; optional `zdr` (zero-data-retention) via `OPENROUTER_ZDR`
- JSON schema response format with strict validation; falls back to raw JSON parse on 400
- Safety rules prepended to prompt: receipt text is untrusted, ignore embedded commands
- Rate limiting: quota consumption via `receiptUpgrades.consumeOcrQuota` Convex mutation
- Error handling: retries on 429/5xx with 750ms backoff; sanitized error messages to client

### Supporting: `convex/functions/receiptUpgrades.ts`

- Tracks pending offline receipts awaiting OpenRouter upgrade (`needsAiUpgrade` query)
- Quota tracking: `consumeOcrQuota` mutation per org/user
- `applyOcrUpgrade` mutation: applies extracted fields to pending expense

## 8. Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `OPENROUTER_API_KEY` | OpenRouter API key | Yes |
| `OPENROUTER_BASE_URL` | OpenRouter API base URL | No (default `https://openrouter.ai/api/v1`) |
| `OPENROUTER_OCR_MODEL` | Vision model for OCR | No (default `google/gemini-2.5-flash`) |
| `OPENROUTER_ZDR` | Zero-data-retention flag | No (default `false`) |

## 9. Testing

- Unit test: OpenRouter API call with mock responses
- Integration test: upload receipt → verify extracted fields via OpenRouter
- Fallback test: simulate OpenRouter failure → error handling
- Multi-frame test: 2-8 overlapping frames → deduplicated line items
- Confidence threshold test: <75% flagged low confidence
- Input validation tests: invalid type, oversized, magic byte mismatch, dimension limit
- Rate limiting test: daily quota enforcement

## 10. Rollout Plan

1. Deploy Convex action + env vars to dev
2. Test with real receipts in dev
3. Deploy to production
4. Monitor accuracy metrics (compare OpenRouter vs Tesseract)
5. Remove Tesseract.js dependency from bundle once stable

## 11. Implementation Summary

### Files Created

- `convex/functions/ocrOpenRouter.ts` — Convex action calling OpenRouter vision API, input validation, rate limiting
- `convex/functions/receiptUpgrades.ts` — Receipt upgrade tracking and quota management
- `app/composables/useReceiptAI.ts` — Vue composable for offline-to-online AI upgrade receipts

### Files Modified

- `convex/functions/expenses.ts` — Added `ocrSource` field support (`openrouter`, `tesseract`, `document-ai`, `manual`)
- `app/components/AddExpenseModal.vue` — Integrated receipt upload + OpenRouter OCR flow
- `docs/2-development/04-implemented/d17-openrouter-ocr.md` — Slice documentation
- `.env.example` — Added OpenRouter environment variables

### Verification

- `npx convex dev --once` — Convex functions deploy successfully
- `npx vue-tsc --noEmit` — TypeScript typecheck passes
- Core tests pass
- `npm run docs:lint` — 0 errors

## Lifecycle Report

**Summary:** Slice D17 OpenRouter OCR implemented, reviewed, and promoted to `04-implemented`. Documents the decision to use OpenRouter LLM (vision model via `google/gemini-2.5-flash`) instead of Google Document AI.

**Implementation:**
- `convex/functions/ocrOpenRouter.ts`: OpenRouter vision LLM action with JSON schema, multi-frame support, rate limiting, error sanitisation
- `convex/functions/receiptUpgrades.ts`: Pending upgrade tracking, quota consumption, offline-to-online sync
- `app/composables/useReceiptAI.ts`: Offline receipt AI upgrade composable

**Open Questions (registered in spec-gaps.md):**
- P2-Q1: OpenRouter model selection
- P2-Q2: OpenRouter result caching
