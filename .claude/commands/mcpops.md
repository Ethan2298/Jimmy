---
description: Operate the Jimmy MCP observability CLI to debug failures, latency, and usage patterns
---

# Jimmy MCP Ops

Use the MCP observability CLI to diagnose the Jimmy MCP service.

## Playbook
1. Read [MCP Ops Guide](../../docs/mcp-ops-guide.md) before doing anything else.
2. Run `python -m mcp_servers.jimmy.cli status` first.
3. If the user reported a failure, run `python -m mcp_servers.jimmy.cli failures --days 7`.
4. If the user reported slowness, run `python -m mcp_servers.jimmy.cli latency --days 7`.
5. If the user wants behavior patterns, run `python -m mcp_servers.jimmy.cli usage --days 7`.
6. If one actor or tool is implicated, repeat the command with `--actor <id>` or `--tool <name>`.
7. Report:
   - what failed
   - whether it is auth, scope, upstream GHL, or local code
   - what got slower
   - which tool or actor is driving the usage

## Response style
- Be concrete.
- Quote the command output only if it clarifies the issue.
- Prefer the event store over runtime logs.
- If `SUPABASE_URL` or `SUPABASE_SERVICE_ROLE_KEY` is missing, say the CLI is not fully wired yet and stop there.


