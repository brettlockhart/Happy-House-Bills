# Run Agent Command

Execute any agent defined in `.kilo/agent/` by name.

## Usage
```
/run-agent <agent-name> [--worktree] [--prompt "custom prompt"]
```

## Options
- `--worktree` — Run in Agent Manager git worktree (isolated). Default: local session.
- `--prompt "..."` — Custom prompt for the agent. Default: reads from agent definition.

## Examples
```
/run-agent security-engineer
/run-agent test-engineer --worktree
/run-agent frontend-engineer --prompt "Implement the new Button component per slice-5 spec"
/run-agent backend-engineer --worktree --prompt "Add rate limiting to Convex mutations"
```

## Agent Resolution

1. Looks for `.kilo/agent/<agent-name>.md`
2. Reads the agent's `description` and prompt guidance
3. Launches via `agent_manager` with appropriate mode
4. If `--prompt` provided, uses that; otherwise uses a default prompt based on the agent's scope

## Available Agents

Run `/run-agent --list` to see all agents in `.kilo/agent/`