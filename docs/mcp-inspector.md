# Jimmy MCP Inspector

This is the simplest way to inspect Jimmy's MCP server with the official MCP Inspector.

## What This Gives You

- See the tool list that Jimmy exposes over MCP
- Manually call tools from a browser UI or the Inspector CLI
- Reproduce what an MCP client like Claude sees

## Prerequisites

You need Jimmy running locally and the MCP auth token available in your shell.

```bash
npm run dev
export MCP_AUTH_TOKEN=your-token-here
```

Jimmy's MCP endpoint lives at:

```text
http://localhost:3000/api/mcp
```

## Inspector UI

Start the official Inspector and point it at Jimmy's HTTP MCP endpoint:

```bash
npx @modelcontextprotocol/inspector
```

Then open the Inspector in your browser and connect with:

- Transport: `http`
- Server URL: `http://localhost:3000/api/mcp`
- Header: `Authorization: Bearer $MCP_AUTH_TOKEN`

## Inspector CLI

List tools:

```bash
npx @modelcontextprotocol/inspector --cli \
  http://localhost:3000/api/mcp \
  --transport http \
  --header "Authorization: Bearer $MCP_AUTH_TOKEN" \
  --method tools/list
```

Call a tool:

```bash
npx @modelcontextprotocol/inspector --cli \
  http://localhost:3000/api/mcp \
  --transport http \
  --header "Authorization: Bearer $MCP_AUTH_TOKEN" \
  --method tools/call \
  --tool-name conversations \
  --tool-arg action=send \
  --tool-arg conversation_id=abc123 \
  --tool-arg message_type=SMS \
  --tool-arg body='Checking in on your trade appraisal'
```

## Important Caveat With Grouped Tools

PR 18 groups many old tools into broader tools like `contacts`, `conversations`, and `opportunities`.

Those grouped tools use action-based schemas such as:

- `conversations(action="send")`
- `opportunities(action="create")`

The current MCP SDK validates those correctly when you call the tool, but Inspector may still show an empty or simplified input form for some grouped tools.

Why:

- the server accepts richer Zod schemas like discriminated unions
- the SDK's `listTools` output only publishes object-shaped schemas cleanly
- grouped union schemas can therefore appear as `{}` in Inspector even when runtime validation is correct

In practice that means:

- `tools/call` still validates required fields correctly
- the browser form may not fully advertise those required fields
- if you want the richest Inspector form today, separate explicit tools are still the most reliable shape

## Recommended Testing Flow

1. Run `tools/list` and confirm the expected tool names appear.
2. Use `tools/call` for the main dealership workflows:
   - `contacts`
   - `conversations`
   - `opportunities`
   - `calendars`
   - `appointments`
3. Intentionally send a bad request and confirm the validation error points at the right field.

For example, this should fail because `conversation_id`, `message_type`, and `body` are required for `conversations(action="send")`:

```bash
npx @modelcontextprotocol/inspector --cli \
  http://localhost:3000/api/mcp \
  --transport http \
  --header "Authorization: Bearer $MCP_AUTH_TOKEN" \
  --method tools/call \
  --tool-name conversations \
  --tool-arg action=send
```
