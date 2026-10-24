---
description: Start a post-launch feature addition or update following the development-tier proposal lifecycle (placeholder — reassess before first use)
---

# Post-Launch Feature or Update

> **PLACEHOLDER — NOT READY FOR USE**
>
> This command is a stub. The workflow below is a **draft outline** to be reassessed and
> finalised **after launch**, when the first post-launch feature or update is proposed. Do
> not run this workflow as-is until it has been reviewed and updated against the actual
> post-launch state of the codebase, the docs, and the `AGENTS.md` lifecycle rules.
>
> Created: 01-September-2026
> Status: Placeholder — reassess before first use

## Intended purpose

After launch, new features and updates follow a different shape of work than pre-launch
gap-filling. Instead of writing the next missing referenced spec from `spec-gaps.md`, a
post-launch feature goes through the **development-tier proposal lifecycle**:

`01-draft` → `02-in-progress` → `03-ready-for-review` → `04-implemented`

with a slice plan in `supporting-docs/slices/`, a review packet in
`supporting-docs/reviews/`, and updates to the relevant `tech-specs/` and `domains/` docs
that the feature touches.

This is distinct from `/spec-gap-next`, which fills pre-launch spec gaps in priority order
and does not move a proposal through the lifecycle folders.

## Draft workflow (reassess before use)

1. **Identify the feature** — what is being added or changed, and which tech-specs and
   domain docs it touches
2. **Create a proposal doc** in `docs/2-development/01-draft/` with YAML frontmatter
   (`status: 01-draft`, `package`, `priority`, `created`, `updated`, `tags`,
   `lifecycle: 01-draft`)
3. **Move to `02-in-progress/`** before writing any implementation code (start-of-slice
   trigger); update frontmatter (`status` + `lifecycle` → `02-in-progress`, `updated` →
   today)
4. **Write a slice plan** in `supporting-docs/slices/` if the slice exceeds ~150 lines;
   otherwise embed the implementation plan in the proposal doc
5. **Implement** the feature, updating the relevant `tech-specs/` and `domains/` docs as
   the behaviour they describe changes
6. **Run verification** — `npm run lint`, `npm test`, `npx tsc --noEmit`,
   `npx tsx docs/scripts/doc-lint.ts`
7. **Ask the user whether they want a code review** before promoting to
   `03-ready-for-review/`
8. **Move to `03-ready-for-review/`** — code complete, tests pass, awaiting review; update
   frontmatter; append a lifecycle report
9. **After review approval, move to `04-implemented/`** — update frontmatter, append a
   final lifecycle report, update the priority table in `docs/2-development/README.md` if
   applicable
10. **Present the lifecycle report in chat**

## Reassessment checklist (run before first post-launch use)

- [ ] Confirm the development-tier folder structure matches `AGENTS.md` §7
- [ ] Confirm the `docs/scripts/doc-lint.ts` path and invocation are correct
- [ ] Confirm the lint, test, and typecheck commands match the repo's actual scripts
- [ ] Confirm whether the Open Questions Register in `spec-gaps.md` needs updating for
      new open questions introduced by the feature
- [ ] Confirm whether the `supporting-docs/reviews/` queue needs an entry
- [ ] Replace this placeholder with the finalised workflow and remove the
      "PLACEHOLDER — NOT READY FOR USE" banner

## Rules

- All documentation file names must be lowercase
- Use British English (colour, centre, behaviour, optimise, etc.)
- Follow existing doc conventions and patterns
- All code must use ES module `import` syntax
- Never use `Math.random()` for identifiers; use `crypto.randomUUID()`
- Do not commit, push, or open PRs unless explicitly requested
- Leave implementation code in the working tree for review — do not auto-commit
