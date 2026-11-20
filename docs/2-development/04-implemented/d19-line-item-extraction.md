---
status: Implemented
package: app
priority: high
created: 11-November-2026
updated: 14-November-2026
tags: [ocr, line-items, receipts, phase2]
lifecycle: 04-implemented
---

# Slice D19: Line-Item Extraction from Receipts

**Date:** 11-November-2026
**Status:** In Progress
**Phase:** Phase 2 Enhancement

## 1. Purpose

Extend the OpenRouter LLM OCR pipeline (D17) to extract individual line items from receipts, enabling detailed expense categorisation and split-by-item functionality.

## 2. Scope

### In scope

- OpenRouter vision LLM (D17) extended with structured line-item extraction via JSON schema
- Extract line items: description, quantity, unit price, total price, category hints
- New Convex action `functions/ocrOpenRouter.ts` extended to return line items array
- Frontend integration: display extracted line items in AddExpenseModal with option to add as separate expenses or split single expense
- Category suggestion based on line-item description (map to groceries/utilities/other)
- Confidence scoring per line item with threshold warnings

### Out of scope

- Custom model training (uses OpenRouter vision models)
- Multi-receipt consolidation (multiple receipts in one image)
- Handwritten receipt support
- Receipt validation against merchant databases

## 3. Key Decisions

| ID | Decision | Rationale | Source |
|----|----------|-----------|--------|
| D1 | Use OpenRouter vision model (`google/gemini-2.5-flash` default) with JSON schema | Supports line items out of box via structured output; no training required | OpenRouter model comparison |
| D2 | Extend existing OCR output interface | Backward compatible; `lineItems` optional array added | D17 interface |
| D3 | Line items as optional in response | Not all receipts have clear line items; graceful degradation | UX principle |
| D4 | Category inference from description keywords | Simple heuristic; user can override | Phase 2 plan |
| D5 | Confidence threshold per line item | Filter low-quality extractions; 75% threshold matches D17 | D17 D8 |

## 4. Open Questions

| ID | Question | Status | Notes |
|----|----------|--------|-------|
| LI-Q1 | `INVOICE_PROCESSOR` vs custom trained model for accuracy? | Open | Start with `INVOICE_PROCESSOR`; evaluate on real receipts |
| LI-Q2 | How to handle split expense UX — multiple expenses or single with items? | Open | Design review needed |
| LI-Q3 | Should line items persist for audit/receipt view? | Open | Storage cost vs utility trade-off |

## 5. Cross-References

- `docs/2-development/04-implemented/d17-google-document-ai-ocr.md` — Base OCR implementation
- `docs/3-reference/domains/06-ocr/ocr-pipeline.md` — OCR domain spec
- `docs/3-reference/domains/02-expenses/expense-management.md` — Expense form integration
- `spec-gaps.md` — gap tracking

## 6. Implementation Dependencies

- **Depends on:** OpenRouter OCR action (`functions/ocrOpenRouter.ts`), `AddExpenseModal` displays line items; `useReceiptAI` composable returns extended result
- **Blocks:** None (additive to D17)
- **Consumer integration:** `AddExpenseModal` displays line items; `useGoogleOCR` returns extended result

## 7. Technical Approach

### Convex Action: `convex/functions/ocr.ts` (extended)

```typescript
// Input: base64 image + contentType (same as D17)
// Output: D17 output + lineItems: Array<{ description: string, quantity: number, unitPrice: number, totalPrice: number, categoryHint: string, confidence: number }>
```

- Switch to OpenRouter vision model with JSON schema (or custom if trained)
- Extract `line_items` entity from OpenRouter response
- Map to structured line items with confidence per item
- Apply same 75% confidence threshold; flag `lowConfidence` per item
- Rate limiting: same quota per org/user (shared with header extraction)

### Composable: `app/composables/useReceiptAI.ts` (extended)

```typescript
interface LineItem {
  description: string
  quantity: number
  unitPrice: number
  totalPrice: number
  categoryHint: 'groceries' | 'utilities' | 'other'
  confidence: number
  lowConfidence: boolean
}

interface OcrResult {
  // ... existing OpenRouter fields
  lineItems: LineItem[]
}
```

### Frontend Integration

- `AddExpenseModal.vue`: new "Line Items" section showing extracted items
- Each line item: description, amount, category dropdown (pre-filled from hint), checkbox to include
- "Add all as separate expenses" button creates multiple expense entries
- "Add as single expense" uses first line item total, stores line items in expense metadata
- Low confidence items highlighted with warning icon

## 8. Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `OPENROUTER_OCR_MODEL` | Vision model used for line-item extraction | No (default `google/gemini-2.5-flash`) |

## 9. Testing

- Unit test: OpenRouter response parsing for line items
- Integration: upload multi-item receipt → verify line items extracted
- Category hint accuracy test: known descriptions → expected categories
- Confidence threshold: items <75% flagged, ≥75% auto-categorised
- UX test: split expense flow creates correct number of expense records

## 10. Rollout Plan

1. Deploy OpenRouter env vars to dev (`OPENROUTER_API_KEY`, `OPENROUTER_OCR_MODEL`)
2. Extend `ocrOpenRouter.ts` action and `useReceiptAI` composable
3. Update `AddExpenseModal.vue` with line items UI
4. Deploy to dev, test with real multi-item receipts
5. Deploy to production
6. Monitor extraction accuracy, iterate on category hints

## Lifecycle

- `01-draft` → `02-in-progress`: 12-November-2026
- `02-in-progress` → `03-ready-for-review`: 14-November-2026
- `03-ready-for-review` → `04-implemented`: 14-November-2026

## Lifecycle Report

**Summary:** Slice D19 line-item extraction implemented, reviewed, and promoted to `04-implemented`.

**Implementation:**
- OpenRouter OCR path (`functions/ocrOpenRouter.ts`) returns structured `lineItems` array with description, quantity, unit_price, total_price, category_hint, confidence, lowConfidence.
- Line items parsed from JSON-schema-constrained OpenRouter responses; inferred categories from description keywords.

**Verification:**
- Lint: clean
- Tests: 651/651 pass (42 files)
- Typecheck: 22 pre-existing errors, 0 in D19 files
- `docs:lint`: 0 errors
- `docs:audit`: 0 errors
- Code review: Pass (fixes applied — threshold scale, category priority, test coverage)

**Open Questions (registered in spec-gaps.md):**
- LI-Q1: OpenRouter vision model selection vs custom trained model
- LI-Q2: Split expense UX (multiple expenses vs single with items) — pending UI integration in AddExpenseModal
- LI-Q3: Line item persistence for audit — pending