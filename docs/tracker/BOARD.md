# Jimmy Dev Tracker

> **How to read this file:** Tasks are grouped by status. Each task is a section with properties. Move tasks between sections as they progress. See [DEV-WORKFLOW.md](./DEV-WORKFLOW.md) for stage definitions.

---

## Now

<!-- Tasks with priority "now" that need attention first, regardless of status -->

_None right now._

---

## Backlog

<!-- Defined and ready to pick up. Not started. -->

### Enable GHL write scopes on PIT

- **Category:** ghl-integration
- **Priority:** now
- **Branch:** —
- **Notes:** Need contacts.write, conversations/message.write, opportunities.write, calendars.readonly, calendars.write, calendars/events.readonly, calendars/events.write enabled on the Private Integration Token. Currently read-only. Blocks all write workflows (send messages, move deals, book appointments).

### Add pre-push quality gate

- **Category:** infra
- **Priority:** next
- **Branch:** —
- **Notes:** Add a `check` script to package.json that runs `eslint && tsc --noEmit && next build` in sequence. Wire it into a git pre-push hook so broken code can't reach Vercel.

### Set up JS/TS test framework

- **Category:** infra
- **Priority:** next
- **Branch:** —
- **Notes:** No Vitest/Jest configured. Python tests exist for MCP CLI but nothing covers the Next.js app, API routes, or GHL tool-calling layer. Start with the MCP route handler — it's the riskiest surface.

### Wire up Marcus personality prompt

- **Category:** ai
- **Priority:** next
- **Branch:** —
- **Notes:** Andrej's sales methodology needs to be ported into a Claude Code skill or system prompt. Buyer adaptation, conversation flow, objection handling, follow-up rules. See SPEC.md for details.

---

## In Progress

<!-- Actively being developed on a branch. -->

_Nothing in progress._

---

## Checks Passing

<!-- Lint + typecheck + build all green. Ready for manual testing. -->

_Nothing here._

---

## Testing

<!-- Being manually verified on dev server or Vercel preview. -->

_Nothing here._

---

## Shipped

<!-- Merged to master, live on Vercel. -->

_Nothing shipped yet._

---

## Blocked

<!-- Waiting on something external. Notes must explain the blocker. -->

_Nothing blocked._

---

## Archive

<!-- Completed and no longer relevant to active development. Move shipped items here periodically to keep the board clean. -->

_Empty._
