---
description: List Jimmy skills or run one by name — your GHL command center
---

# Jimmy

Run a skill or list what's available. Usage: `/jimmy` to list, `/jimmy triage` to run one.

## What to do

1. Check if the user provided an argument (e.g. `/jimmy triage`, `/jimmy morning-brief`).

### If an argument was given — run the skill:
2. Call `jimmy_run_skill` with the argument as the skill_slug. If the slug doesn't start with "skill-", the tool will try both forms.
3. Read the response. The `instructions` field contains the full step-by-step workflow.
4. Respect the `mode` field:
   - **plan**: Present findings and ask the user before taking any write actions (create, update, delete, send).
   - **execute**: Act on each step directly. Report results as you go.
   - **review**: Read-only analysis. Do not call any tools that modify data.
5. Execute the instructions step by step using the available MCP tools (search_contacts, get_pipelines, send_message, etc.).
6. When done, summarize what was accomplished.

### If no argument — list skills:
2. Call `jimmy_skills` to get all available skills.
3. Present them as a clean list: skill name, description, and mode.
4. Tell the user they can run any skill with `/jimmy [name]`.
