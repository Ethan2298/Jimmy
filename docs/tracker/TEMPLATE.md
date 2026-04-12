# Task Entry Template

Copy this block when adding a new task to BOARD.md. Paste it under the appropriate status section.

```markdown
### [Short task title]

- **Category:** feature | fix | infra | ghl-integration | ui | ai
- **Priority:** now | next | later
- **Branch:** — (fill in when work starts)
- **Notes:** What needs to happen, why, and any context an AI or future-you needs to pick this up cold.
```

## Rules

1. **Title** — imperative voice, short. "Add calendar booking flow" not "Calendar stuff".
2. **Category** — pick one. If it spans two, pick the primary one.
3. **Priority** — `now` means drop everything. `next` means after current work ships. `later` means it's defined but not urgent.
4. **Branch** — leave as `—` until you create the branch. Fill it in so AI can cross-reference git state.
5. **Notes** — this is the most important field. Write enough that someone (or an AI) can pick this up without asking questions. Include: what's blocked, what decisions were made, what the acceptance criteria is.

## Moving Tasks

- When you start work: move the block from **Backlog** to **In Progress**, fill in the Branch.
- When checks pass: move to **Checks Passing**.
- When manually verified: move to **Testing**.
- When merged and live: move to **Shipped** with the date.
- When blocked: move to **Blocked**, update Notes with what's blocking.
- Periodically: move old Shipped items to **Archive** to keep the board scannable.
