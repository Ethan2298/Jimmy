# Jimmy MCP Ops

Use the MCP observability CLI to debug the Jimmy MCP service.

## Required behavior
- Start with `python -m mcp_servers.jimmy.cli status`.
- Use `failures` for bugs, `latency` for slowdowns, and `usage` for behavior questions.
- Narrow with `--actor <id>`, `--tool <name>`, and `--days <n>` as needed.
- Treat the event store as the source of truth.
- Use runtime logs only for stack traces or deployment failures.

## Suggested sequence
1. `status`
2. `failures`
3. `latency`
4. `usage`

## What to report
- Root cause category
- Most likely affected tool
- Recent failures or slow paths
- Whether the issue looks like auth, scope, upstream GHL, or local code



