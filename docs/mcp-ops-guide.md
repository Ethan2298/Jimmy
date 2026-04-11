# MCP Ops Guide

Use the Python CLI in `mcp_servers/jimmy/cli.py` when you need to inspect the Jimmy MCP service from an operator or agent workflow.

## When to use it
- Debug tool failures
- Inspect latency regressions
- Understand what tools and actors are using the MCP
- Confirm the event store is connected and returning data

## Commands
- `python -m mcp_servers.jimmy.cli status`
- `python -m mcp_servers.jimmy.cli failures`
- `python -m mcp_servers.jimmy.cli latency`
- `python -m mcp_servers.jimmy.cli usage`

## How to use it well
- Start with `status` to confirm the event store is reachable and to get a quick read on recent health.
- Use `failures` when something broke. Read the `error_code`, `upstream_status`, and `scope_required` fields first.
- Use `latency` when the system is "working" but slow. Focus on p95 and the slowest tools, not the average.
- Use `usage` when you need to understand how people or agents are actually using the MCP. Look for top tools, top actors, and skew toward writes or failure-heavy flows.
- Use `--actor <id>` to isolate one human or agent.
- Use `--tool <name>` to focus on one tool.
- Use `--days <n>` to widen or narrow the observation window.

## Triage order
1. `status`
2. `failures`
3. `latency`
4. `usage`
5. `trace` style work should be done by drilling into the returned `request_id` values manually until a dedicated trace command exists.

## Operator rules
- Treat the event store as the source of truth.
- Use runtime logs only for stack traces and deployment-level failures.
- Do not guess at scope issues. Read the recorded `scope_required` value first.
- Do not inspect raw payloads unless you need to confirm a specific field, because payload summaries are intentionally redacted.
