# Deploying This Template

## Option A: Deploy into a new project from this central folder

Keep this template in a known location and have Kilo agents deploy it into new projects.

```bash
# Agent instruction to deploy:
# "Apply the template at C:\Users\brett\Documents\Projects\agent-instructions-template
#  into the current project, replacing {{PROJECT_NAME}} with 'MyNewProject'"
```

The agent will:
1. Copy `AGENTS-TEMPLATE.md` → `<project>/docs/AGENTS.md`
2. Replace all `{{placeholders}}` with project-specific values
3. Copy `.kilo/agent/*.md` → `<project>/.kilo/agent/`
4. Copy `.kilo/command/*.md` → `<project>/.kilo/command/`
5. Copy `docs-system/templates/` → `<project>/docs/2-development/templates/`
6. Copy `docs-system/scripts/` → `<project>/docs/scripts/`
7. Create lifecycle folders (`01-draft/`, `02-in-progress/`, `03-ready-for-review/`) with `.gitkeep`
8. Copy `kilo.json` → `<project>/kilo.json`
9. Run `node docs/scripts/setup-hooks.js`

## Option B: Copy the folder into a new project

```bash
cp -r /path/to/agent-instructions-template/* /path/to/new-project/
cd /path/to/new-project
# Rename and customize
mv AGENTS-TEMPLATE.md docs/AGENTS.md
# Edit docs/AGENTS.md: replace {{PROJECT_NAME}}, {{PACKAGE_MANAGER}}, etc.
# Create lifecycle folders
mkdir -p docs/2-development/01-draft docs/2-development/02-in-progress docs/2-development/03-ready-for-review
touch docs/2-development/01-draft/.gitkeep docs/2-development/02-in-progress/.gitkeep docs/2-development/03-ready-for-review/.gitkeep
node docs/scripts/setup-hooks.js
```

## Key customisation points

In `docs/AGENTS.md`, replace:
- `{{PROJECT_NAME}}` — e.g. "MyApp", "DesignSystem", "UIBuilder"
- `{{PACKAGE_MANAGER}}` — npm, pnpm, or yarn
- `{{TEST_FRAMEWORK}}` — Vitest, Jest, etc.
- `{{TYPECHECKER}}` — tsc, vue-tsc, etc.
- `{{LINT_COMMAND}}` — eslint, biome, etc.
- `{{PROJECT_TYPE}}` — SaaS, CLI, library, etc.

Review and update:
- Security trigger checklist (§08) — remove inapplicable areas
- Code style conventions (§04) — match your linter config
- Test commands — match your workspace setup
- Dependency management rules — match your package manager
