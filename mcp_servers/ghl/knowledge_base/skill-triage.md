# Triage

Skill: triage
Description: Pull inbox leads, walk through each for routing decisions
Mode: plan

## Instructions
1. Call `contacts` with `action: "search"`, no query, and `limit: 20` to pull recent contacts.
2. For each contact, evaluate:
   - Do they have real contact info (phone or email, not just an Instagram handle)?
   - When were they added? (dateAdded)
   - What tags do they have?
   - What was their source?
3. Classify each contact:
   - HOT: Real contact info + added in last 7 days + expressed buying intent
   - WARM: Real contact info + general interest but no urgency
   - COLD: No real contact info, or 30+ days with no activity
4. Present a summary table: Name | Classification | Source | Days Since Added | Missing Info.
5. For each contact, ask the user: Route to pipeline? Archive? Schedule follow-up? Skip?
6. Execute the user's decision:
   - Route to pipeline: Call `opportunities` with `action: "create"` with the contact linked to the appropriate pipeline and stage
   - Archive: Call `contact_tags` with `action: "add"` and tag `"archived"`
   - Follow-up: Call `contact_tasks` with `action: "create"` with a follow-up reminder
7. After processing all contacts, summarize total actions taken.
