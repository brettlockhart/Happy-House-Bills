# Slice Agents Command

Manage Agent Manager sessions for slice work.

## Usage
```
/slice-agents <action> [options]
```

## Actions
| Action | Description |
|--------|-------------|
| `list` | List all active slice agents |
| `stop <session-id>` | Stop a specific agent |
| `stop-all` | Stop all slice agents |
| `logs <session-id>` | View agent logs |
| `status` | Show summary of all slice worktrees |

## Options
- `--slice <name>` — Filter by slice name
- `--state <state>` — Filter by state (idle, busy, retry, offline, waiting)

## Examples
```
/slice-agents list
/slice-agents list --slice slice-3-export
/slice-agents stop ses_abc123
/slice-agents logs ses_abc123
/slice-agents status
```

## Integration with Slice Commands

- `/slice-parallel` automatically creates and tracks agents
- `/slice-implement` can optionally spawn Agent Manager session with `--agent`
- Agents are named `slice-<slice-name>-<timestamp>`

## Worktree Locations

Worktrees are created at:
```
../Happy House Bills-slice-<slice-name>-<hash>/
```

Each worktree has its own:
- `.git` (linked to main repo)
- `node_modules` (shared via npm workspaces)
- Build outputs