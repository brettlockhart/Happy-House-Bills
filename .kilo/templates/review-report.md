# Implementation Review: {{slice-name}}

**Verdict:** {{Pass | Needs revision | Blocked}}
**Slice:** {{slice-name}}
**Date:** {{today}}
**Reviewer:** {{agent-name}}

---

## Slice Summary

| Field | Value |
|-------|-------|
| **Slice** | {{slice-name}} |
| **Phase** | {{phase}} |
| **Dependencies** | {{depends_on}} |
| **Blocks** | {{blocks}} |
| **Lifecycle** | {{lifecycle}} |
| **Files Modified** | {{file-count}} |

---

## Verification Checks

| Check | Status | Details |
|-------|--------|---------|
| Lint (new files) | {{✅ Pass \| ❌ Fail}} | {{lint-details}} |
| Typecheck | {{✅ Pass \| ❌ Fail}} | {{typecheck-details}} |
| Tests | {{✅ Pass \| ❌ Fail}} | {{test-count}} passing |
| Build | {{✅ Pass \| ❌ Fail}} | {{build-details}} |

---

## Specialised Agent Reports

### Frontend Engineer
{{frontend-report | N/A}}

### Backend Engineer
{{backend-report | N/A}}

### Security Engineer
{{security-report | N/A}}

### Test Engineer
{{test-report | N/A}}

### Spec Reviewer
{{spec-report | N/A}}

---

## Findings

| # | File | Issue | Severity | Suggested Fix |
|---|------|-------|----------|---------------|
| 1 | {{file-path}} | {{issue-description}} | {{blocking \| minor}} | {{suggested-fix}} |
| 2 | ... | ... | ... | ... |

---

## Security Checklist

- [ ] No XSS in preview components (`v-html` sanitised)
- [ ] Iframe sandbox minimal (`allow-scripts` only)
- [ ] postMessage origin validation implemented
- [ ] No secrets in client code
- [ ] CSP headers configured (if applicable)

---

## Accessibility Checklist

- [ ] Semantic HTML used
- [ ] ARIA attributes present where needed
- [ ] Keyboard navigation functional
- [ ] Colour contrast meets WCAG AA

---

## Performance Checklist

- [ ] Debouncing/memoisation applied
- [ ] Virtual scrolling for large lists
- [ ] Bundle size impact assessed

---

## Code Quality Checklist

- [ ] No `any` types (strict mode)
- [ ] No bare `@ts-ignore`
- [ ] No `Math.random()` for IDs
- [ ] No MD5/SHA1
- [ ] Cognitive complexity < 15 per function
- [ ] British English in UI copy

---

## Documentation Checklist

- [ ] Lifecycle doc updated
- [ ] Frontmatter complete
- [ ] Cross-references reciprocal
- [ ] `npx tsx docs/scripts/doc-lint.ts` passes

---

## Summary

{{one-paragraph-assessment}}

---

## Handoff Options

| Option | Trigger | Next Action |
|--------|---------|-------------|
| Fix and re-review | Verdict = Needs revision | Re-invoke `/slice-review {{slice-name}}` |
| Promote to implemented | Verdict = Pass | Run `/slice-promote {{slice-name}}` |
| Security deep-dive | Security issues found | Invoke `security-engineer` |
| Test improvement | Test gaps found | Invoke `test-engineer` |