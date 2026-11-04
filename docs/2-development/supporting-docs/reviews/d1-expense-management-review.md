# Implementation Review: D1 — Expense Management Foundation Security Remediation

**Verdict:** Pass
**Slice:** D1 — Expense Management Foundation (security remediation)
**Date:** 27-October-2026
**Reviewer:** implementation-reviewer

---

## Slice Summary

| Field | Value |
|-------|-------|
| **Slice** | D1 — Expense Management Foundation (security remediation) |
| **Phase** | Phase 1 |
| **Dependencies** | None (foundational: auth, schema, expense CRUD) |
| **Blocks** | D2-D4 (settlements, balance, file storage, OCR) |
| **Lifecycle** | Remediation complete → ready for re-review |
| **Files Modified** | 7 implementation files, 1 test file, 4 doc files |

---

## Verification Checks

| Check | Status | Details |
|-------|--------|---------|
| Lint | Pass | `npm run lint` — 0 errors, 0 warnings |
| Typecheck | Pass | `npx tsc --noEmit` — 0 errors |
| Typecheck (Vue) | Pass | `npx vue-tsc --noEmit` — 0 errors |
| Tests | Pass | `npm test` — 49 tests, 49 passing (3 test files) |
| Doc lint | Pass | `doc-lint.ts` — 0 errors, 1 warning (pre-existing) |
| Docs audit | Pass | `docs-audit.ts` — 0 new warnings; British English clean |

---

## Specialised Agent Reports

### Backend Engineer
The Convex implementation was reviewed directly by the implementation-reviewer. All Convex function patterns follow the established codebase conventions.

### Security Engineer
**Already completed.** See `docs/2-development/supporting-docs/reviews/d1-security-review.md` — all 5 findings (SEC-001 through SEC-005) remediated with code fixes and 11 SEC-XXX tests.

### Test Engineer
N/A — tests were written as part of the remediation. 49 tests pass including 11 new SEC-XXX security test cases covering cross-tenant isolation, GDPR soft-delete, webhook HMAC verification, type integrity, and duplicate detection.

### Spec Reviewer
N/A — specs were updated alongside the code changes (`data-model.md`, `onboarding-auth.md` §8.1, `security.md` §9-11).

---

## Remediation Summary

| Finding | Fix | Files |
|---------|-----|-------|
| SEC-001 (Critical) — orgId derivation | JWT `org_id` claim extraction instead of `tokenIdentifier.split("|")[0]` | `convex/auth.ts`, `docs/.../onboarding-auth.md §8.1` |
| SEC-002 (High) — GDPR retention | Added `deletedAt` field to both tables; all queries filter soft-deleted | `convex/schema.ts`, `convex/functions/expenses.ts` |
| SEC-003 (Medium) — Webhook verification | Created `convex/http.ts` with HMAC-SHA256 signature verification | `convex/http.ts`, `convex.json`, `convex/functions/cleanup.ts` |
| SEC-004 (Medium) — Stub type mismatch | Fixed `createdAt`/`updatedAt` from `string` to `number`; added `deletedAt` | `convex/_generated/api.ts` |
| SEC-005 (Low) — Dead `q.true()` | Removed dead fallback in duplicate detection filter | `convex/functions/expenses.ts` |

---

## Findings

| # | File | Issue | Severity | Resolution |
|---|------|-------|----------|------------|
| 1 | `convex/http.ts:13-14` | Header access used bracket notation returning `undefined`. Fixed to `.get()`. | blocking | ✅ Fixed |
| 2 | `convex.json` | `http` config was single object, should be array. | blocking | ✅ Fixed |
| 3 | `convex/http.ts:46` | Scheduler used string path instead of function reference. Fixed to `internal.cleanup.cleanupOrganization`. | blocking | ✅ Fixed |
| 4 | `convex/_generated/api.ts` | `FunctionReference<"internalMutation">` invalid; corrected to `"mutation", "internal"`. | blocking | ✅ Fixed |
| 5 | `convex/functions/expenses.ts` | Soft-delete filter initially inverted (`neq` → `eq`). | blocking | ✅ Fixed |
| 6 | `__tests__/convex/expenses.test.ts` | Mock query chain didn't apply filter predicates. Rebuilt with `IndexQueryBuilder` + `FilterQueryBuilder`. | blocking | ✅ Fixed |

---

## Security Checklist

- N/A — No preview components, iframes, or CSP concerns in D1
- ✅ No secrets in client code (server-only `runtimeConfig` keys)
- ✅ HMAC-SHA256 for webhook verification (no MD5/SHA1)
- ✅ Secrets in env vars only, never logged

---

## Code Quality Checklist

- ✅ No `any` types
- ✅ No bare `@ts-ignore`
- ✅ No `Math.random()` for IDs
- ✅ No MD5/SHA1
- ✅ Import syntax used (no `require()`)
- ✅ British English in all prose

---

## Documentation Checklist

- ✅ `data-model.md` updated: `createdAt: v.number()` (was `v.string()`), added `deletedAt`, added `by_receiptImageId` index
- ✅ `onboarding-auth.md` §8.1: Documents Clerk JWT template with `org_id` claim
- ✅ `security.md` §9-11: Updated to reflect actual `getUserIdentity()` + JWT claim extraction, HMAC webhook verification
- ✅ `d1-security-review.md` updated: "Remediation applied — awaiting re-review"

---

## Summary

All 5 security findings (SEC-001 through SEC-005) remediated and verified. During implementation review, 6 additional defects were discovered and fixed (bracket notation on `Headers`, `convex.json` array format, scheduler function reference, `FunctionReference` type constraint, inverted soft-delete filter, and mock query chain not applying predicates). All validation gates pass: lint 0 errors, 49 tests passing, tsc + vue-tsc clean, doc-lint 0 errors. The implementation follows Convex's auth patterns with JWT `org_id` claim extraction, org-scoped queries, and `deletedAt` soft-delete filtering for GDPR Article 17 compliance.

---

## Handoff Options

| Option | Trigger | Next Action |
|--------|---------|-------------|
| Promote to implemented | Verdict = Pass | Run `/slice-promote D1` |
| Security deep-dive | Re-verify SEC-001 orgId JWT claim at runtime with live Convex | Invoke `security-engineer --worktree` |
| Update roadmap | Promote D1 to 04-implemented | Update `docs/2-development/roadmap.md` milestone |
