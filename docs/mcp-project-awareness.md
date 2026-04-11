# MCP Project Awareness

This repository is organized around a broader MCP project, with GHL as the current integration category.

Use this framing:
- The project is the umbrella.
- GHL is the active category of tools today.
- Future company API integrations can be added as peer categories.
- Tool names, logs, and CLI output should make the active integration explicit.
- Event rows should include an integration category field so reports can split GHL from other integrations.

Operational rules:
- Keep the live namespace as `mcp__ghl__*` for the current integration.
- When testing or triaging, say whether a finding belongs to GHL or to the broader MCP project.
- Do not assume every tool or workflow is GHL-specific if a new integration is added later.
- When adding more integrations, separate them by category in docs, logs, and operator commands.
- Use the category label in dashboards, CLI summaries, and incident notes so it is obvious which integration is being used.

Current operator workflow:
- `health`
- `status`
- `failures`
- `trace <request_id>`
- `latency`
- `usage`

These commands should be interpreted as project-level observability over the active integration surface, not as a promise that the whole project is GHL forever.
