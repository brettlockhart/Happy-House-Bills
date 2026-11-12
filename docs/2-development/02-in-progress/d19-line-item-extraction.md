---
status: In Progress
package: app
priority: high
created: 11-November-2026
updated: 12-November-2026
tags: [ocr, line-items, receipts, phase2]
lifecycle: 02-in-progress
---

# Slice D19: Line-Item Extraction from Receipts

**Date:** 11-November-2026
**Status:** Draft
**Phase:** Phase 2 Enhancement

## 1. Purpose

Extend the Google Document AI OCR pipeline (D17) to extract individual line items from receipts, enabling detailed expense categorisation and split-by-item functionality.

## 2. Scope

### In scope

- Document AI processor upgrade from `FORM_PARSER` to custom trained model or `INVOICE_PROCESSOR` for line-item extraction
- Extract line items: description, quantity, unit price, total price, category hints
- New Convex action `functions/ocr.ts` extended to return line items array
- Frontend integration: display extracted line items in AddExpenseModal with option to add as separate expenses or split single expense
- Category suggestion based on line-item description (map to groceries/utilities/other)
- Confidence scoring per line item with threshold warnings

### Out of scope

- Custom Document AI model training infrastructure (uses pre-built processors)
- Multi-receipt consolidation (multiple receipts in one image)
- Handwritten receipt support
- Receipt validation against merchant databases

## 3. Key Decisions

| ID | Decision | Rationale | Source |
|----|----------|-----------|--------|
| D1 | Use `INVOICE_PROCESSOR` pre-built model | Supports line items out of box; no training required | Google Cloud docs |
| D2 | Extend existing OCR output interface | Backward compatible; `lineItems` optional array added | D17 interface |
| D3 | Line items as optional in response | Not all receipts have clear line items; graceful degradation | UX principle |
| D4 | Category inference from description keywords | Simple heuristic; user can override | Phase 2 plan |
| D5 | Confidence threshold per line item | Filter low-quality extractions; same 60% as header fields | D17 D3 |

## 4. Open Questions

| ID | Question | Status | Notes |
|----|----------|--------|-------|
| P2-Q4 | `INVOICE_PROCESSOR` vs custom trained model for accuracy? | Open | Start with `INVOICE_PROCESSOR`; evaluate on real receipts |
| P2-Q5 | How to handle split expense UX — multiple expenses or single with items? | Open | Design review needed |
| P2-Q6 | Should line items persist for audit/receipt view? | Open | Storage cost vs utility trade-off |

## 5. Cross-References

- `docs/2-development/04-implemented/d17-google-document-ai-ocr.md` — Base OCR implementation
- `docs/3-reference/domains/06-ocr/ocr-pipeline.md` — OCR domain spec
- `docs/3-reference/domains/02-expenses/expense-management.md` — Expense form integration
- `spec-gaps.md` — gap tracking

## 6. Implementation Dependencies

- **Depends on:** D17 (Google Document AI OCR), Google Cloud `INVOICE_PROCESSOR` processor
- **Blocks:** None (additive to D17)
- **Consumer integration:** `AddExpenseModal` displays line items; `useGoogleOCR` returns extended result

## 7. Technical Approach

### Convex Action: `convex/functions/ocr.ts` (extended)

```typescript
// Input: base64 image + contentType (same as D17)
// Output: D17 output + lineItems: Array<{ description: string, quantity: number, unitPrice: number, totalPrice: number, categoryHint: string, confidence: number }>
```

- Switch processor to `INVOICE_PROCESSOR` (or custom if trained)
- Extract `line_items` entity from Document AI response
- Map to structured line items with confidence per item
- Apply same 60% confidence threshold; flag `lowConfidence` per item
- Rate limiting: same 50/day/org/user (shared with header extraction)

### Composable: `app/composables/useGoogleOCR.ts` (extended)

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
  // ... existing D17 fields
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
| `GOOGLE_DOCUMENT_AI_PROCESSOR_ID` | Invoice processor ID (replaces Form Parser) | Yes |

## 9. Testing

- Unit test: Document AI response parsing for line items
- Integration: upload multi-item receipt → verify line items extracted
- Category hint accuracy test: known descriptions → expected categories
- Confidence threshold: items <60% flagged, ≥60% auto-categorised
- UX test: split expense flow creates correct number of expense records

## 10. Rollout Plan

1. Create `INVOICE_PROCESSOR` in Google Cloud, update env var
2. Extend `ocr.ts` action and `useGoogleOCR` composable
3. Update `AddExpenseModal.vue` with line items UI
4. Deploy to dev, test with real multi-item receipts
5. Deploy to production
6. Monitor extraction accuracy, iterate on category hints

## Lifecycle

- `01-draft` → `02-in-progress`: TBD
- `02-in-progress` → `03-ready-for-review`: TBD
- `03-ready-for-review` → `04-implemented`: TBD