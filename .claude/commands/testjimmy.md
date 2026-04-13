---
description: Test the live production MCP server via Claude.ai's MCP connector — verify what's deployed
---

# Prod MCP Test

Test the **production** MCP surface by calling tools through the live Claude.ai MCP connector (the `mcp__claude_ai_Jimmy__*` tools). This verifies what's actually deployed on Vercel and accessible to users.

Use `/mcp-test` instead when you want to test a local branch before deploying.

## Step 1: Live Read Check

Call a lightweight read-only tool to confirm the prod MCP server is reachable and authenticated:
- Call `get_location` — should return Mikalyzed Auto Boutique's location data
- Call `get_pipelines` — should return pipeline structure
- If both fail with auth errors, the GHL token or MCP auth token may be misconfigured in Vercel env vars

## Step 2: Tool Inventory

Use ToolSearch to load all `Jimmy` MCP tools and report:
- Total number of tools currently registered on prod
- List them grouped by category (contacts, conversations, pipelines, calendars, appointments, location, users)
- Flag any tools that look broken, duplicated, or missing descriptions
- Note the tool naming pattern (flat individual tools vs. consolidated action-based tools)

## Step 3: Targeted Testing

Based on what Ethan asks, or if no specific request, run through these core read-only workflows:

**Contacts:**
- `search_contacts` with a real query
- `get_contact` on a result
- Verify the response shape is clean and useful

**Pipeline:**
- `get_pipelines` to see pipeline structure
- `search_opportunities` to pull live deals
- Verify monetary values, stages, and contact links resolve

**Conversations:**
- `search_conversations` to find recent threads
- `get_conversation_messages` on one
- Verify message history is readable

**Calendar:**
- `list_calendars` and `get_calendar_events` for upcoming
- Verify dates and appointment details

## Step 4: Report

Give a clear summary:
- What worked — show actual data, not just "it worked"
- What broke or returned unexpected data
- What's missing or could be better
- Any tools returning 401/403 (scope not enabled — note it, move on)
- Comparison to local test results if `/mcp-test` was run recently

## Rules
- Only use **read-only** tools unless Ethan explicitly says to test writes
- Never modify real contact/deal/conversation data without explicit permission
- If a tool returns a scope error, log it once and move on
- Keep responses tight — show the actual data
- If Ethan says "test [specific thing]" — focus there, skip the rest
