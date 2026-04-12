# Jimmy — Claude Code Instructions

## Project Overview

Jimmy is an AI sales co-worker platform built on Next.js 16, deployed on Vercel. The AI assistant (Marcus) operates on GoHighLevel CRM through MCP tool calls. See `SPEC.md` for full architecture.

**Stack:** Next.js 16 (App Router) · React 19 · TypeScript (strict) · Tailwind v4 · shadcn/ui · Vercel AI SDK · Supabase · GHL MCP

**Live endpoint:** `https://jimmy-sooty.vercel.app`

---

## Dev Tracker

The project tracker lives in `docs/tracker/`. This is the single source of truth for what's in flight.

### Files

| File | Purpose |
|---|---|
| `docs/tracker/BOARD.md` | The active board — all tasks grouped by status |
| `docs/tracker/DEV-WORKFLOW.md` | Pipeline stage definitions and category/priority reference |
| `docs/tracker/TEMPLATE.md` | Copy-paste template for new task entries |

### How to Use the Tracker

**At the start of every session:**
1. Read `docs/tracker/BOARD.md` to understand what's in flight
2. Check if any **In Progress** tasks match the current branch
3. If picking up new work, check the **Backlog** section for the highest priority item

**During work:**
- When starting a task: move it to **In Progress**, fill in the Branch field
- When lint + typecheck + build pass: move to **Checks Passing**
- When manually verified: move to **Testing**
- When merged to master and live: move to **Shipped**
- If blocked by something external: move to **Blocked**, update Notes

**When the user asks to add work:**
- Add a new entry to the appropriate status section in BOARD.md
- Use the format from `docs/tracker/TEMPLATE.md`
- Default new items to **Backlog** unless told otherwise

**When the user asks "what should I work on" or "what's next":**
- Read BOARD.md, surface the highest priority Backlog item
- If something is In Progress, surface that first

### Task Properties

- **Category:** `feature` · `fix` · `infra` · `ghl-integration` · `ui` · `ai`
- **Priority:** `now` · `next` · `later`
- **Branch:** git branch name (fill in when work starts)
- **Notes:** context, blockers, decisions — enough to pick up cold

---

## Quality Gates

Before any code reaches master, it must pass these in order:

```bash
npm run lint          # ESLint (core web vitals + TypeScript)
npx tsc --noEmit      # TypeScript strict type check
npm run build         # Next.js production build
```

If any gate fails, fix before pushing.

---

## Commands

| Command | What it does |
|---|---|
| `/testjimmy` | Live MCP testing session — health check, tool inventory, targeted tests |
| `/pushtoprodjimmy` | Commit, push to main, verify Vercel deployment |
| `/jimmysetup` | Initial project setup and verification |

---

## Rules

- GHL is the current integration category, not the only one the project will ever support
- Never commit secrets, `.env` files, or tokens
- Never force push
- Human-in-the-loop by default — Marcus drafts, dealer approves
- PIT token stays in environment variables, never in code
