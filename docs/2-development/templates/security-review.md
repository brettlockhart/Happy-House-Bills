# Security Review Report: {{slice-or-feature-name}}

**Status:** Draft
**Scope:** {{slice-or-feature-name}}
**Date:** {{today}}
**Reviewer:** {{reviewer}}
**Verdict:** {{Pass | Needs revision | Blocked}}

---

## Scope and Sensitivity

| Field | Value |
|-------|-------|
| Affected files | {{affected-files}} |
| Authentication or authorisation | {{yes-or-no}} |
| Billing or entitlements | {{yes-or-no}} |
| File upload or export | {{yes-or-no}} |
| Iframe, CSP, or preview | {{yes-or-no}} |
| User data or PII | {{yes-or-no}} |

## Threat Model

| Asset | Trust boundary | Data flow | Threat | Mitigation | Residual risk |
|-------|----------------|-----------|--------|------------|---------------|
| {{asset}} | {{boundary}} | {{flow}} | {{threat}} | {{mitigation}} | {{risk}} |

## Security Checklist

| Control | Status | Evidence |
|---------|--------|----------|
| Authentication enforced at server boundary | {{status}} | {{evidence}} |
| Authorisation checked per operation | {{status}} | {{evidence}} |
| Inputs validated and size-limited | {{status}} | {{evidence}} |
| Output encoded for HTML, CSS, and JavaScript contexts | {{status}} | {{evidence}} |
| CSP configured for preview and exports | {{status}} | {{evidence}} |
| Iframe sandbox and postMessage origin validated | {{status}} | {{evidence}} |
| Secrets absent from client code, logs, and errors | {{status}} | {{evidence}} |
| Rate limits and replay protections configured | {{status}} | {{evidence}} |
| Webhook signatures verified | {{status}} | {{evidence}} |
| Dependency findings triaged | {{status}} | {{evidence}} |

## Findings

| # | File or area | Finding | Severity | Required action |
|---|--------------|---------|----------|-----------------|
| 1 | {{file-or-area}} | {{finding}} | {{critical | high | medium | low}} | {{action}} |

## Residual Risk

{{residual-risk-or-none}}

## Approval

| Decision | Approver | Date | Notes |
|----------|----------|------|-------|
| {{decision}} | {{approver}} | {{date}} | {{notes}} |

## Next Gate

{{next-gate}}
