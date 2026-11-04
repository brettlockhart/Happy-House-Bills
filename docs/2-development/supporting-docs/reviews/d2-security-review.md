# Security Review Report: D2 — Settlement API

**Status:** Draft
**Scope:** D2 — Settlement API
**Date:** 2026-10-29
**Reviewer:** security-engineer
**Verdict:** Needs revision

---

## Scope and Sensitivity

| Field | Value |
|-------|-------|
| Affected files | convex/functions/settlements.ts, app/composables/useSettlements.ts, convex/_generated/api.ts |
| Authentication or authorisation | yes |
| Billing or entitlements | no |
| File upload or export | no |
| Iframe, CSP, or preview | no |
| User data or PII | yes |

## Threat Model

| Asset | Trust boundary | Data flow | Threat | Mitigation | Residual risk |
|-------|----------------|-----------|--------|------------|---------------|
| Settlement records | Auth boundary | Convex → DB | Unauthorized access | OrgId scoping + requireAuthenticatedOrg | Medium |
| Settlement amounts | Auth boundary | API → Client | PII exposure | Server-side only exposure | Low |
| User IDs | Auth boundary | Convex → Client | Identity correlation | Org scoping only, not fully validated | Medium |

## Security Checklist

| Control | Status | Evidence |
|---------|--------|----------|
| Authentication enforced at server boundary | Pass | requireAuthenticatedOrg used on both create and list mutations |
| Authorisation checked per operation | Needs revision | `toUser` org membership validation deferred to D3 (requires Clerk user lookup) |
| Inputs validated and size-limited | Pass | Amount > 0, fromUser === userId, fromUser !== toUser validation |
| Output encoded for HTML, CSS, and JavaScript contexts | Pass | Client uses computed properties, no direct HTML generation |
| CSP configured for preview and exports | N/A | Not applicable — D2 is backend-only |
| Iframe sandbox and postMessage origin validated | N/A | Not applicable — D2 is backend-only |
| Secrets absent from client code, logs, and errors | Pass | No secrets in Convex functions or composable |
| Rate limits and replay protections configured | N/A | Not implemented in current version |
| Webhook signatures verified | N/A | Not applicable — D2 is backend-only |
| Dependency findings triaged | Pass | No critical vulnerabilities identified |

## Findings

| # | File or area | Finding | Severity | Required action |
|---|--------------|---------|----------|-----------------|
| 1 | convex/functions/settlements.ts:75 | Missing `toUser` same-org validation | High | Implement D3 requirement: verify `toUser` belongs to same org |
| 2 | app/composables/useSettlements.ts | Client exposes PII without validation | Medium | Add client-side validation for same-org before API calls |
| 3 | All files | Settlement amounts exposed as PII | Medium | Document PII classification, ensure audit logging |
| 4 | None | No rate limiting on API endpoints | Low | Implement rate limiting for production deployment |

## Residual Risk

The primary residual risk is cross-tenant settlement recording. The implementation provides org-level scoping but fails to validate that `toUser` belongs to the authenticated user's org. An attacker could record a settlement from their org to a user in another org, potentially bypassing business rules and creating incorrect balance calculations.

Additional concerns include PII exposure (settlement amounts and user IDs) without comprehensive client-side validation. While the backend enforces basic security controls, the lack of client-side validation means malicious requests could be sent, only to be rejected server-side.

## Approval

| Decision | Approver | Date | Notes |
|----------|----------|------|-------|
| Needs revision | security-engineer | 2026-10-29 | D3 requirement must be implemented before production release |

## Next Gate

Implement D3: Cross-tenant isolation enforcement by adding `toUser` org membership validation to `settlements:create` mutation. This requires Clerk user lookup functionality to verify membership before insertion. Until implemented, D2 cannot proceed to production.