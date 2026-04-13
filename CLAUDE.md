# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

Jimmy (RPM) is a Next.js web app where car dealers chat with Marcus, an AI sales co-worker. Marcus reads and writes GoHighLevel (GHL) CRM through server-side tool calls — contacts, conversations, pipelines, calendars. Supabase handles auth and chat history. Deployed on Vercel.

## Priority

**Primary: MCP server and GHL integration.** The remote MCP endpoint (`/api/mcp`), GHL tools, and everything that makes Marcus a great dealership co-worker. This is the core product — make it awesome.

**Secondary: Magi.** The Electron desktop app in `magi/` is a side project. Don't prioritize it over MCP work.

## Commands

```bash
npm run dev          # Start Next.js dev server (port 3000)
npm run build        # Production build
npm run lint         # ESLint (flat config, next/core-web-vitals + typescript)
npm run start        # Serve production build
```

Python tests (legacy MCP server in `mcp_servers/ghl/`):
```bash
pip install -r requirements.txt
python -m pytest tests/ -v              # Run all tests
python -m pytest tests/test_ghl_mcp_server.py -v   # Single test file
python -m pytest tests/test_ghl_mcp_server.py::test_name -v  # Single test
```

## Architecture

```
Dealer (browser) <-> Next.js App Router <-> Claude API (Marcus) <-> GHL API
                          |
                      Supabase
                   (auth, chat history)
```

### Two chat interfaces

1. **`/chat`** — Marcus, the dealer-facing AI co-worker. Uses `claude-sonnet-4.5` with GHL tools. Auth via Supabase. Messages persisted to `chat_sessions`/`messages` tables.
2. **`/magi`** — Internal "Codex-style" engineering workspace. Supports Anthropic and OpenAI providers with user-supplied API keys. No Supabase persistence.

### Key source paths

- **`src/app/api/chat/route.ts`** — Marcus chat endpoint. Streams via Vercel AI SDK `streamText()`. Saves messages to Supabase on finish.
- **`src/lib/ai/marcus.ts`** — Marcus system prompt (persona, sales methodology, voice rules).
- **`src/lib/ai/tools.ts`** — AI SDK tool definitions wrapping GHL API (searchContacts, getConversationMessages, sendMessage, etc.).
- **`src/lib/ghl/client.ts`** — GHL REST client. Handles locationId injection (some endpoints use snake_case `location_id`), auth headers, API version.
- **`src/lib/ghl/tools.ts`** — MCP server tool registrations (used by `/api/mcp` route).
- **`src/app/api/mcp/route.ts`** — Remote MCP endpoint (Streamable HTTP). Bearer token auth. Stateless — fresh transport per request.
- **`src/lib/supabase/`** — Server and client Supabase helpers. Middleware refreshes auth session on every request.
- **`src/app/(auth)/`** — Login page and OAuth callback.
- **`src/app/oauth/`, `src/app/api/oauth/`** — RFC 7591 dynamic client registration for external MCP connectors (e.g., Claude.ai).

### GHL API quirks (in `src/lib/ghl/client.ts`)

- `/opportunities/search` requires `location_id` (snake_case); all other endpoints use `locationId`.
- Sub-resource endpoints (`/notes`, `/tasks`, `/messages`, `/free-slots`) reject `locationId` in query params (422).
- API version header: `Version: 2021-07-28`.

### Supabase tables

- `chat_sessions` — chat threads per user
- `messages` — individual messages (role, content, tool_invocations)
- `mcp_events` — MCP telemetry events
- `knowledge_base` — stored knowledge entries

Migrations in `supabase/migrations/`.

### Python MCP server (`mcp_servers/ghl/`)

Legacy Python implementation with CLI (`cli.py`), server (`server.py`), and telemetry. Tests in `tests/`. Uses `mcp`, `httpx`, `starlette`.

### Magi (`magi/`)

Separate Electron desktop app (electron-vite, React 19, Tailwind v4). Has its own `package.json`, `CLAUDE.md`, and build system. Excluded from the root TypeScript config.

## Conventions

- `@/*` path alias maps to `./src/*`
- shadcn/ui components (base-nova style) in `src/components/ui/`
- `cn()` utility from `@/lib/utils` for conditional classnames
- Tailwind CSS v4, CSS variables for theming
- Zod v4 for schema validation
- npm as package manager
- GHL is the single source of truth for dealership data — no shadow databases

## Workflow

Solo dev, AI-native. GitHub Issues is the task tracker. Notion is the wiki.

### Issue flow

Backlog → Building → Review → Ship → Done

- **Backlog**: Prioritized GitHub Issues (P0–P3 labels). Pick from the top.
- **Building**: Branch created, code in progress. One issue at a time.
- **Review**: PR open, verify it works. Fast — not a multi-day cycle.
- **Ship**: Merged to main, deployed to Vercel, verified in prod.
- **Done**: Issue closed.

### Labels

- Priority: `P0-critical`, `P1-high`, `P2-normal`, `P3-low`
- Area: `area:ghl-mcp`, `area:frontend`, `area:backend`, `area:infra`, `area:ai-engine`, `area:product`
- Type: `bug`, `enhancement`, `task`

### Session start

When Ethan says "what should I work on" or `/next`:
1. Check open GitHub Issues, sorted by priority
2. Recommend the highest-priority unassigned issue
3. When picked, create a branch and start building

### Ship cycle

1. Build on a feature branch
2. Open PR with summary + test plan
3. Merge to main
4. Verify on Vercel prod
5. Close the GitHub issue

### Where things live

- **GitHub Issues** — all tasks, bugs, features (source of truth for work)
- **Notion** — architecture docs, product vision, design sessions, research (thinking space, not task tracking)

## Environment Variables

See `.env.example`. Required:
- `ANTHROPIC_API_KEY` — for Marcus (Claude API)
- `GHL_API_KEY`, `GHL_LOCATION_ID` — GHL Private Integration Token and location
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` — Supabase client
- `SUPABASE_SERVICE_ROLE_KEY` — Supabase server-side
- `MCP_AUTH_TOKEN` — bearer token for `/api/mcp` endpoint
- `JIMMY_PIN` — PIN for OAuth authorization flow
