# Deal Review

Skill: deal
Description: Full context on a specific deal — history, contact, tasks, next steps
Mode: plan

## Instructions
1. If the user provided a deal name or keyword, call `opportunities` with `action: "search"` to find it. If multiple matches, present the list and ask which one.
2. If the user provided a deal ID directly, skip to step 3.
3. Call `opportunities` with `action: "get"` and the deal ID for full details (stage, value, status, dates).
4. Call `contacts` with `action: "get"` on the linked contact to get their info (name, phone, email, tags).
5. Call `contact_notes` with `action: "list"` on the contact for interaction history.
6. Call `contact_tasks` with `action: "list"` on the contact for open follow-up tasks.
7. Call `conversations` with `action: "search"` and the contact_id, then `conversations` with `action: "get_messages"` on the most recent conversation for message history.
8. Present a comprehensive deal summary:
   - **Deal**: Name, pipeline, stage, monetary value, status, age (days since created)
   - **Contact**: Name, phone, email, tags, source
   - **History**: Recent notes (last 5) and last few messages
   - **Open Tasks**: What's pending with due dates
   - **Timeline**: Key dates — created, last stage change, last activity
9. Ask the user what to do next:
   - Move to next stage (call `opportunities` with `action: "update"` and a new `stage_id`)
   - Add a note (call `contact_notes` with `action: "add"`)
   - Create a follow-up task (call `contact_tasks` with `action: "create"`)
   - Send a message (call `conversations` with `action: "send"`)
   - Update deal value (call `opportunities` with `action: "update"` and `monetary_value`)
   - Close as won/lost (call `opportunities` with `action: "update"` and `status`)
10. Execute the chosen action and confirm.
