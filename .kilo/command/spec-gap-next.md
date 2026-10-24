---
description: Start addressing the next highest-priority spec gap from spec-gaps.md
agent: spec-writer
---

# Continue Spec Work

The foundational specs in `docs/3-reference/tech-specs/` are written incrementally by
priority. The live status of each spec (complete vs. missing) is tracked in
`docs/3-reference/tech-specs/README.md` and the gap inventory in
`docs/3-reference/spec-gaps.md` — read those at the start of each run rather than relying
on a hard-coded list here, since the completion state changes after every spec is written.

When all foundational tech specs are complete, the next priority is a domain spec from
`docs/3-reference/domains/` — pick by the gap priority in `spec-gaps.md`.

## Process

1. Read `docs/3-reference/spec-gaps.md` and `docs/3-reference/tech-specs/README.md` to
   identify which specs remain, ordered by priority (foundational before domain, then by
   writing order in the README)
2. Identify the next unaddressed spec by priority and its target path under
   `docs/3-reference/tech-specs/` or `docs/3-reference/domains/`
3. Read cross-referenced docs for context (e.g., for `backend-arch.md`: read
   `data-model.md`, `api-contract.md`, `shared-features.md`, `frontend-arch.md`)
4. Propose a spec outline to the user and ask for approval **before writing anything**
5. After outline approval, **draft the full spec and present it as a preview in chat**
   (do not write it to a file yet). Ask the user to approve the content before committing it
   to disk — this lets the user review the actual prose, decisions, and cross-references
   before they land in a document
6. After content approval, write the spec to the target file using the template in
   `tech-specs/README.md` §6 (Purpose, Scope, Key decisions, Open questions,
   Cross-references, Implementation dependencies)
7. Add any new open questions to the Open Questions Register in
   `docs/3-reference/spec-gaps.md`. Before adding, check for duplicate IDs and resolve
   any existing questions the new spec answers (strike through resolved rows in the
   register, update the source spec's open-questions section with the decision)
8. Update the status in `docs/3-reference/tech-specs/README.md` (for tech-specs) or the
   relevant domain `README.md` spec table (for domain specs)
9. Update the gap count summary in `docs/3-reference/spec-gaps.md` → "Appendix: Gap Count
   Summary" if a referenced doc is now complete (decrement "Missing referenced documents")
10. Run `npx tsx docs/scripts/doc-lint.ts` to verify sync
11. Present the lifecycle report in chat

## End-of-run verification (do not skip)

Before declaring the spec done, run **every** check below with the exact commands given
and paste the actual command output into the lifecycle report. These are not
instructions to "think about" or "review" — they are commands to **run** and **report**.
A checked box without pasted output is not a completed check.

If any check fails, fix the issue and re-run the check before proceeding. Do not mark a
failed check as passed.

### 1. Open Questions Register

Extract every open-question ID from the new spec and confirm each one appears in the
register:

```pwsh
# Extract all open-question IDs from the new spec
Select-String -Path "<spec-path>" -Pattern '\b[A-Z]+-Q\d+\b' -AllMatches |
  ForEach-Object { $_.Matches.Value } | Sort-Object -Unique

# For each ID found, confirm it exists in the register
Select-String -Path "docs/3-reference/spec-gaps.md" -Pattern "<ID>"
```

Rules:
- Every ID found in the spec must appear in the register. If any is missing, add it.
- If the spec has zero open questions, confirm the register needs no update and state
  "no open questions in this spec — register unchanged" in the report.
- **Duplicate-ID check**: before adding a row, confirm no existing row in the register
  already uses the same ID. If the ID collides with one from another spec, renumber the
  new spec's ID to a unique prefix (e.g. `BA-Q1` collides → use `BA2-Q1` or pick a new
  prefix) and update the spec's open-questions section to match.
- **Resolve existing questions**: scan the register for open questions that the new spec
  answers or makes moot. If the new spec resolves an existing question:
  1. Strike through the row in the register (do not delete — keep the resolution trail)
  2. Update the source spec's open-questions section with the decision and resolution date
  3. State which questions were resolved in the lifecycle report
  If no existing questions are resolved, state "no existing questions resolved" in the
  report.

### 2. Status table

Confirm the spec's row is up to date in the correct README:
- Tech-specs: `docs/3-reference/tech-specs/README.md`
- Domain specs: `docs/3-reference/domains/<domain>/README.md`

```pwsh
# For tech-specs:
Select-String -Path "docs/3-reference/tech-specs/README.md" -Pattern "<spec-filename>"
# For domain specs:
Select-String -Path "docs/3-reference/domains/*/README.md" -Pattern "<spec-filename>"
```

Rules:
- The row must read `Complete` (or the agreed status), not `Missing` or stale.
- If the spec **modifies** an existing doc rather than creating a new one, confirm the
  existing row's status is still accurate (it may need `Updated` or a date change rather
  than `Complete`).
- If the spec creates a new row, confirm it uses the correct path and layer directory.

### 3. Gap count summary

If the spec completes a previously-missing referenced document, the "Missing referenced
documents" count in `spec-gaps.md` → "Appendix: Gap Count Summary" must be decremented:

```pwsh
Select-String -Path "docs/3-reference/spec-gaps.md" -Pattern "Missing referenced documents"
```

Rules:
- If the spec is a new doc that was previously listed as `Missing` in `tech-specs/README.md`,
  decrement the count by 1.
- If the spec modifies an existing doc or is a domain spec (not a referenced tech-spec),
  the count does not change — state "gap count unchanged" in the report.
- The count must never go below 0. If it is already 0 and the spec is new, investigate —
  the appendix may be stale.

### 4. Cross-references resolve

Every relative path referenced from the new spec must point at a file that exists —
**except** forward references to specs that are intentionally not yet written (e.g.
`SECURITY_ARCH.md` listed as `Missing` in `tech-specs/README.md`).

```pwsh
# List all relative .md paths referenced from the spec
Select-String -Path "<spec-path>" -Pattern '`[^`]+\.md`' -AllMatches |
  ForEach-Object { $_.Matches.Value -replace '``','' }
```

For each referenced path, resolve it against the spec's directory and check the file
exists with `Test-Path`. In the report, list:
- **Resolves** — file exists at the referenced path
- **Forward reference (intentional)** — file does not exist but is listed as `Missing` in
  `tech-specs/README.md` (note this in the report; it is not a failure)
- **Broken** — file does not exist and is not a known forward reference (this is a bug;
  fix the path or create the file)

### 5. Date check

The spec's `**Date:**` header must match today's date (the user's local date, not UTC):

```pwsh
Select-String -Path "<spec-path>" -Pattern '^\*\*Date:\*\*'
```

Compare the date in the header to `Get-Date -Format "dd-MMMM-yyyy"`. If they differ,
update the header before proceeding. The sibling specs use the format
`dd-MonthName-yyyy` (e.g. `01-September-2026`).

### 6. Doc-lint

```pwsh
npx tsx docs/scripts/doc-lint.ts
```

If the repo has no `docs/scripts/doc-lint.ts`, confirm with `Test-Path` and state
"no doc-lint script found — skipped" in the report. Do not skip without confirming the
file genuinely does not exist.

If doc-lint fails, fix the issue (broken cross-reference, stale frontmatter, missing
status entry) and re-run. Do not declare the spec done with a failing doc-lint.

### 7. British English

Scan the spec for American spellings in prose (not in code identifiers):

```pwsh
$words = 'color','colors','behavior','optimize','analyze','realize','standardize','organization','organize','center','gray'
foreach ($w in $words) {
  $hits = Select-String -Path "<spec-path>" -Pattern "\b$w\b" -CaseSensitive:$false
  if ($hits) { "FOUND: $w at lines $($hits.LineNumber -join ',')" }
}
```

Rules:
- Matches inside code identifiers (e.g. `dark-color`, `bg-gray`, `align-items`) are
  **not** failures — the prh rules exempt hyphenated forms.
- Matches in prose (sentences, table descriptions, comments) **are** failures — fix
  them before proceeding.
- If zero matches are found, state "British English: clean" in the report.

### 8. Textlint

Run textlint on the new spec and any touched docs (the `AGENTS.md` says "when you touch
docs, run `npx textlint` on the affected paths"):

```pwsh
# Check if textlint is configured in the repo
Test-Path "textlint-prh.yml"

# If configured, run on the spec and any touched docs
npx textlint "<spec-path>"
```

Rules:
- If textlint is configured (the `textlint-prh.yml` file exists), run it on the new spec
  and any other docs touched during this run. Paste the output in the report.
- If textlint is **not** configured, confirm with `Test-Path` and state
  "textlint not configured — skipped" in the report. Do not skip without confirming.
- If textlint reports findings, fix them before proceeding. The British English check
  (check 7) catches spelling; textlint catches sentence structure, terminology, and
  consistency issues the spelling scan misses.

### 9. Lifecycle report

After all checks pass, present the lifecycle report in chat. The report must include a
**Verification results** section with the actual output of each check above — not just
"passed" but the evidence (grep output, doc-lint exit, date comparison). A report
without evidence is not a completed report.

## Rules

- All documentation file names must be lowercase
- Use British English (colour, centre, behaviour, optimise, etc.)
- Follow existing doc conventions and patterns (mirror the structure of the nearest
  sibling tech-spec; match its Status/Date/Audience header and section numbering)
- All code must use ES module `import` syntax
- Never use `Math.random()` for identifiers; use `crypto.randomUUID()`
- The outline-then-preview flow is intentional: the outline confirms *what* to write and
  the scope; the preview confirms *how* it is written. Do not skip the preview step and
  write straight to a file after outline approval
