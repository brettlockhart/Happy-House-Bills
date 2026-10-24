# Test Strategy: {{slice-or-feature-name}}

**Status:** Draft
**Scope:** {{slice-or-feature-name}}
**Date:** {{today}}
**Owner:** {{owner}}
**Source Spec or Plan:** {{source-document}}

---

## Test Objectives

- {{objective}}

## Test Matrix

| Level | Behaviour | Fixture or setup | Assertion | Command |
|-------|-----------|------------------|-----------|---------|
| Unit | {{behaviour}} | {{fixture}} | {{assertion}} | {{command}} |
| Component | {{behaviour}} | {{fixture}} | {{assertion}} | {{command}} |
| Integration | {{behaviour}} | {{fixture}} | {{assertion}} | {{command}} |
| End-to-end | {{behaviour}} | {{fixture}} | {{assertion}} | {{command}} |
| Security | {{behaviour}} | {{fixture}} | {{assertion}} | {{command}} |

## Coverage Targets

| Area | Target | Rationale |
|------|--------|-----------|
| {{area}} | {{target}} | {{rationale}} |

## Fixtures and Test Data

- {{fixture-description}}

## Failure Handling

- Tests must fail on incorrect public behaviour, not implementation details.
- Use deterministic fixtures; do not use `Math.random()`.
- Do not expose secrets, tokens, or PII in fixtures or mocks.

## Execution Evidence

| Command | Result | Output path |
|---------|--------|-------------|
| {{command}} | {{result}} | {{output-path}} |

## Gaps and Follow-up

{{gaps-or-none}}

## Approval

| Decision | Approver | Date | Notes |
|----------|----------|------|-------|
| {{decision}} | {{approver}} | {{date}} | {{notes}} |
