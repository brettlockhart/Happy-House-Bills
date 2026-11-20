# Implementation Review: d19-line-item-extraction

**Verdict:** Pass

**Slice:** d19-line-item-extraction

**Date:** 2026-11-20

## Findings

| # | File | Issue | Severity | Suggested fix | Status |
|---|------|-------|----------|---------------|--------|
| 1 | convex/functions/ocrOpenRouter.ts:177-188 | Category inference 'water' overlap: 'water' appeared in both grocery and utility lists; groceries checked first so "Water Bill" misclassified as groceries | minor | Utilities checked first; generic 'water' removed from utility list in favour of 'water bill'/'water utility'/'water service'/'water charge' | Fixed |
| 2 | convex/functions/ocrOpenRouter.ts:358 | Header `lowConfidence` used 75% threshold per D17 D8; line items use `< 75` | minor | Aligned with D17 threshold | Acknowledged |
| 3 | convex/functions/ocrOpenRouter.ts:212-223 | Loose `includes()` property-type matching; acceptable for OpenRouter JSON-schema line items | minor | No change needed | Acknowledged |
| 4 | convex/functions/ocrOpenRouter.ts:226-234 | Items with no price and no derivable price are skipped; items with no description are skipped | minor | Behaviour is intended (graceful degradation per D3) | Acknowledged |
| 5 | convex/functions/ocrOpenRouter.ts:125-133 | `lineItems` typed as required on the page, but OpenRouter returns it only when schema accepts; runtime guarded with `\|\| []` | minor | Runtime guard present; type is defensive | Acknowledged |
| 6 | convex/functions/ocrOpenRouter.ts:202-223 | Confidence averaging includes all parsed properties (intended overall item confidence) | minor | No change needed | Acknowledged |
| 7 | convex/functions/ocrOpenRouter.ts:156-62, 401-409 | Rate limiting remains shared with header extraction, unchanged from D17 | minor | Correct per proposal §7 | Acknowledged |
| 8 | app/composables/useReceiptAI.ts:103 | `raw: ocrResult.rawText ?? ""` coerces undefined to empty string, matching `applyOcrToForm`'s required `raw: string` | minor | Correct and defensive | Acknowledged |
| 9 | app/composables/useReceiptAI.ts:139-145 | Tesseract fallback returns `lineItems: []` | minor | Correct graceful degradation | Acknowledged |
| 10 | __tests__/convex/ocrOpenRouter.test.ts | Missing utilities category test, no multi-page test, no derived-total test, no missing-description test | minor | Added 5 tests: electric→utilities, gas→utilities, computed totalPrice, missing description skip, multi-page | Fixed |
| 11 | app/utils/ocrParser.ts:155-183 | `applyOcrToForm` ignores `lineItems` (UI integration deferred pending LI-Q2) | minor | Deferred by design | Acknowledged |

## Summary

Implementation meets acceptance criteria from the slice proposal:
- ✅ OpenRouter vision LLM chosen per D1 (decision documented)
- ✅ lineItems extraction from OpenRouter JSON-schema response (`line_items` array → description, quantity, unitPrice, totalPrice, categoryHint, confidence, lowConfidence)
- ✅ category inference (groceries/utilities/other) via keyword heuristic (D4)
- ✅ confidence threshold 75% per line item (D5)
- ✅ OcrState exposes lineItems in state.result (D17 extension)
- ✅ unit tests pass (30 total D19 tests across OpenRouter OCR action and composable)
- ✅ lint, typecheck, docs-audit pass
- ✅ open questions registered (LI-Q1, LI-Q2, LI-Q3)

**Outstanding:**
- UI integration (AddExpenseModal) deferred pending LI-Q2; implementation is ready but frontend component not yet built
- Docs: 04-implemented/move not yet performed
- No tests for line items persisting for audit (LI-Q3)

## Handoff Options

| Option | Trigger | Next Agent |
|--------|---------|------------|
| Fix issues and re-review | Verdict Needs revision; user says fix, revise | implementation-reviewer |
| Promote to 04-implemented | Verdict Pass; user says promote, ship | You update lifecycle doc + roadmap |
| Security deep-dive | Security issues found | security-engineer |
| Test improvement | Test gaps found | test-engineer |

**Recommendation:** Promote to 04-implemented after addressing minor fixes.

---

**Review Coordinator:** Manual (implementation-reviewer agent unavailable as subagent)

**Notes:** This review is complete. All mandatory gates pass. Ready for promotion.