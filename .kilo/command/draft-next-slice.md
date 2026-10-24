# Draft Next Slice Proposal

Convert the next unchecked roadmap item into a draft slice proposal in `01-draft`,
ready for `/slice-implement` to pick up.

## Usage
```
/draft-next-slice [--item <roadmap-keyword>]
```

## Options
- `--item <keyword>` — Draft a specific roadmap item matching the keyword, instead of
  asking which to draft first.

## Agent
`roadmap-to-draft` (`.kilo/agent/roadmap-to-draft.md`)

## Template
`.kilo/templates/draft-proposal.md` → `docs/2-development/01-draft/<slice-name>.md`

## Process

1. Read `docs/2-development/roadmap.md` and list all unchecked (`- [ ]`) items with their
   phase, dependencies, and milestone context.
2. Filter to items whose `depends_on` slices are all in `docs/2-development/04-implemented/`.
3. If `--item` is not given and multiple are eligible, present them to the user and ask
   which to draft first.
4. Read the completed sibling slices in `docs/2-development/04-implemented/` to match
   structure and frontmatter conventions.
5. Read any domain spec in `docs/3-reference/domains/` or tech-spec in
   `docs/3-reference/tech-specs/` that covers the relevant subsystem.
6. **Draft Plan Summary Gate** — present the plan summary to the user and wait for
   explicit approval before writing anything. The summary must include:
   - Roadmap item being drafted (phase, checklist entry text)
   - Proposed slice name and number
   - Sections to be written (matching the draft-proposal template)
   - Key decisions (D1–D3 minimum) with Decision + Rationale
   - Open questions to register (with proposed IDs)
   - Dependencies and what they block
7. After approval, write the draft to `docs/2-development/01-draft/<slice-name>.md`.
8. Register open questions in `docs/3-reference/spec-gaps.md` §6.
9. Strike the roadmap checklist item and add a pointer to the draft path.
10. Update the "Draft → In-Progress" column in the slice cycle time tracking table.
11. Run `npm run docs:lint` and `npx tsx docs/scripts/docs-audit.ts` — both must
    report 0 errors and 0 warnings.
12. Present the lifecycle report in chat.

## End-of-run verification (do not skip)

Before declaring the draft done, run every check below with the exact commands given
and paste the actual command output into the lifecycle report. A checked box without
pasted output is not a completed check.

If any check fails, fix the issue and re-run the check before proceeding.

### 1. Draft file exists

```pwsh
Test-Path "docs/2-development/01-draft/<slice-name>.md"
```

### 2. Frontmatter matches sibling slices

```pwsh
Select-String -Path "docs/2-development/01-draft/<slice-name>.md" -Pattern '^---'
```

The draft must have `---` delimited YAML frontmatter with `status`, `lifecycle`,
`phase`, `slice`, `created`, `updated`, `depends_on`, and `blocks` fields.

### 3. Roadmap item struck

```pwsh
Select-String -Path "docs/2-development/roadmap.md" -Pattern "<roadmap-item-keyword>"
```

The checklist item must read `- [x]` with a pointer to the draft path in parentheses.

### 4. Open questions registered

Every open-question ID in the draft must appear in `docs/3-reference/spec-gaps.md`:

```pwsh
Select-String -Path "docs/3-reference/spec-gaps.md" -Pattern "<ID>"
```

### 5. Doc-lint

```pwsh
npx tsx docs/scripts/doc-lint.ts
```

### 6. Docs audit

```pwsh
npx tsx docs/scripts/docs-audit.ts
```

## Rules

- British English in all prose (colour, centre, behaviour, optimise, analyse, realise,
  standardise, organisation, grey).
- All documentation file names must be lowercase with hyphens.
- Ground every file path, dependency, and claim in an actual doc or directory in this repo.
- Do not invent stack components (no Supabase, no Prisma, no raw SQL — Convex only).
- Never expose secrets, keys, or tokens.
- The Draft Plan Summary Gate is non-negotiable: do not write the draft file before the
  user approves the plan summary.
- Do not skip `03-ready-for-review` — every draft must pass through it before
  `04-implemented`.