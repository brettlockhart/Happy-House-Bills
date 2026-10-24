---
description: Run a comprehensive docs quality audit — backtick path resolution, dates, British English, orphans, filenames
---

# Docs Audit

Run a comprehensive documentation quality audit. This script checks for **quality** issues
that `doc-lint.ts` doesn't catch (doc-lint handles **structural** checks: cross-refs,
stale forward refs, status table, duplicate IDs, gap counts, open-questions sync,
frontmatter lifecycle, review queue). Run the audit occasionally (not on every commit)
to find quality issues and improve the docs system.

Use `.kilo/templates/docs-audit-report.md` → saved to `docs/2-development/supporting-docs/audits/docs-audit-<date>.md` to record the audit scope, findings, fixes, and revalidation evidence.

## Usage

```pwsh
npm run docs:audit           # full audit
npm run docs:audit -- --quiet # errors only
```

## What doc-lint.ts checks (structural — runs on every commit)

- Frontmatter lifecycle matches folder location
- Markdown-link cross-references resolve
- No duplicate `## Status` headers
- Implemented proposals referenced in roadmaps
- Review queue has active entries when uncommitted work exists
- Open questions in specs are synced with the register
- **Stale forward refs** — no "not yet written" about a file that exists
- **Status table accuracy** — `tech-specs/README.md` status matches file existence
- **Duplicate open-question IDs** — no two register entries with the same ID
- **Gap count accuracy** — appendix count matches actual unresolved §1 entries

## What the audit checks (quality — run occasionally)

**Quality checks:**

1. **Backtick path resolution** — every `` `path.md` `` reference resolves to a file (case-insensitive, underscore-to-dash)
2. **Date format and freshness** — not in future, matches `dd-MonthName-yyyy`
3. **British English** — American spellings in prose (excludes code blocks and identifiers)
4. **Orphaned docs** — tech-specs not referenced from anywhere (info)
5. **Filename conventions** — all lowercase per AGENTS.md (excludes README.md, AGENTS.md)
6. **Spec section completeness** — every tech-spec has the required template sections
7. **Empty sections** — no heading with no content beneath it
8. **Stale §1 entries** — spec-gaps.md §1 entries for completed docs are marked
9. **Cross-reference reciprocity** — tech-spec cross-refs are reciprocal (info)

**AI-optimisation checks:**

10. **Frontmatter completeness** — every tech-spec has AI-consumable frontmatter (status, package, priority, created, updated, tags) so agents can filter and prioritise docs
11. **Vague cross-references** — references use explicit backtick paths, not vague prose ("see the X spec" → `` `path.md` ``) so agents can resolve references without guessing
12. **Decision tables** — every tech-spec has at least one Decision + Rationale table (the densest format for agent decision extraction)
13. **Code blocks** — every tech-spec has at least one code example (agents generate code from examples, not prose)

## Interpretation

- **Errors** — must be fixed before the docs are considered clean
- **Warnings** — should be reviewed; may be false positives or pre-existing issues
- **Info** — informational only; domain spec forward refs that are planned but not yet written

## Using the report to improve the docs system

The audit report is designed to surface systemic patterns:

- If check 1 (backtick paths) has many `info` findings for domain specs, it means the domain
  spec writing pipeline is behind — the domain README files reference specs that don't exist yet
- If check 3 (British English) finds findings, they're real American spellings in prose that
  should be fixed — or code identifiers that the check can't distinguish (review the context)
- If check 2 (dates) flags future dates, the spec was written with a UTC timestamp rather than
  the local date — update the header

After fixing the findings, re-run the audit to confirm the issues are resolved.
