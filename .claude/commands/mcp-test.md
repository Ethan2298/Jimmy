---
description: Test the local MCP server against the current branch — spin up dev, hit localhost, verify tools work
---

# Local MCP Test

Spin up the local Next.js dev server and test the MCP endpoint at `localhost:3000/api/mcp` against the current branch code. This is how you verify MCP changes before deploying to prod.

## Step 1: Start the dev server

Check if port 3000 is already in use. If not, start `npm run dev` in the background.

```bash
# Check if dev server is already running
lsof -ti:3000 || npm run dev &
```

Wait for the server to be ready (poll `http://localhost:3000` until it responds, max 30 seconds).

## Step 2: Verify MCP endpoint is reachable

Send an MCP `initialize` request to confirm the endpoint is up and authenticated:

```bash
curl -s -X POST http://localhost:3000/api/mcp \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $MCP_AUTH_TOKEN" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "initialize",
    "params": {
      "protocolVersion": "2025-03-26",
      "capabilities": {},
      "clientInfo": { "name": "mcp-test", "version": "1.0.0" }
    }
  }'
```

If this returns a 401, check that `MCP_AUTH_TOKEN` is set in `.env.local`. If it errors, check the dev server logs.

## Step 3: List registered tools

Send a `tools/list` request to get the full tool inventory:

```bash
curl -s -X POST http://localhost:3000/api/mcp \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $MCP_AUTH_TOKEN" \
  -d '{
    "jsonrpc": "2.0",
    "id": 2,
    "method": "tools/list",
    "params": {}
  }'
```

Report:
- Total number of tools registered
- List them grouped by category (contacts, conversations, pipelines, calendars, appointments, location, users, etc.)
- Flag any tools with missing descriptions, broken schemas, or unexpected names
- Compare against what's expected for the current branch (e.g., if testing the consolidation PR, expect 11 tools not 32)

## Step 4: Call tools via MCP protocol

Use `tools/call` to exercise the tools directly. The format is:

```bash
curl -s -X POST http://localhost:3000/api/mcp \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $MCP_AUTH_TOKEN" \
  -d '{
    "jsonrpc": "2.0",
    "id": 3,
    "method": "tools/call",
    "params": {
      "name": "TOOL_NAME_HERE",
      "arguments": {}
    }
  }'
```

Run through these core read-only workflows:

**Location & Config:**
- Get location details (or `location_info` action `details` if consolidated)
- Get location tags
- Get users

**Contacts:**
- Search contacts (empty query, limit 5)
- Get a specific contact from the results

**Pipeline & Opportunities:**
- Get pipelines
- Search opportunities (open, limit 5)
- Get a specific opportunity from the results

**Conversations:**
- Search conversations (limit 5)
- Get messages from one conversation

**Calendar:**
- List calendars
- Get calendar events (if calendar scope is enabled)

For each call, verify:
- The response is valid JSON-RPC
- The `content` array has a `text` field with parseable JSON
- The data shape matches what the tool description promises
- Error responses include useful messages (not raw stack traces)

## Step 5: Report

Give a clear summary:
- Server status (did it start, is the endpoint authenticated)
- Tool count and whether it matches expectations for this branch
- What worked — show actual data snippets, not just "it worked"
- What broke — include the full error response
- What's a code bug vs. a GHL scope/config issue
- Any regressions compared to the prod tool surface

## Rules
- Only use **read-only** tools unless Ethan explicitly says to test writes
- Never modify real contact/deal/conversation data without explicit permission
- If a tool returns a scope error (401/403), log it once and move on
- Keep responses tight — show the actual data
- If Ethan says "test [specific thing]" — focus there, skip the rest
- Do NOT leave the dev server running when done — kill it if you started it
