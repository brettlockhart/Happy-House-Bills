# Slice Parallel Command

Run multiple slice implementations in parallel using Agent Manager worktrees.

## Usage
```
/slice-parallel <slice-name-1> <slice-name-2> ... [--versions]
```

## Workflow
1. Validates all slices exist in `01-draft` or `02-in-progress`
2. Creates Agent Manager worktree for each slice (isolated git worktrees)
3. Runs `/slice-implement` in each worktree concurrently
4. Aggregates results and presents summary
5. Optionally runs `/slice-review` on all completed slices

## Options
- `--versions` — Run as versioned worktrees for comparison (same slice, different approaches)
- `--max-parallel <n>` — Limit concurrent agents (default: 3)
- `--model <model>` — Override model for all agents

## Examples
```
/slice-parallel slice-3-export slice-4-content
/slice-parallel slice-5-ai --max-parallel 2
/slice-parallel slice-3-export --versions --model "Claude Opus 4.1"
```

## Agent Manager Integration

Each slice runs in its own worktree with:
- Isolated file system (no conflicts)
- Independent git history
- Dedicated agent session visible in Agent Manager UI
- Automatic cleanup on completion

## Prerequisites
- Agent Manager enabled in Kilo
- Sufficient disk space for worktrees (~50MB each)
- No uncommitted changes in main worktree