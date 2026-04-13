# Contact Review

Skill: contact
Description: Full profile of a contact — details, deals, history, and actions
Mode: plan

## Instructions
1. If the user provided a name, phone, or email, call `contacts` with `action: "search"` and their query. If multiple matches, present the list and ask which one.
2. If the user provided a contact ID directly, skip to step 3.
3. Call `contacts` with `action: "get"` and the contact ID for full details.
4. Call `contact_notes` with `action: "list"` for their note history.
5. Call `contact_tasks` with `action: "list"` for open tasks.
6. Call `conversations` with `action: "search"` and the contact_id for message threads. If threads exist, call `conversations` again with `action: "get_messages"` on the most recent one.
7. Call `opportunities` with `action: "search"` and `contact_id` to find any linked deals.
8. Present a full contact profile:
   - **Contact Info**: Name, phone, email, source, tags, address, DND status
   - **Deals**: Any linked opportunities with pipeline, stage, and value
   - **Notes**: Recent interaction notes (last 5)
   - **Tasks**: Open follow-ups with due dates
   - **Conversations**: Last few messages from most recent thread
   - **Custom Fields**: Any custom field values set on the contact
9. Ask the user what to do next:
   - Update contact info (call `contacts` with `action: "update"`)
   - Add a tag (call `contact_tags` with `action: "add"`)
   - Create a task (call `contact_tasks` with `action: "create"`)
   - Send a message (call `conversations` with `action: "send"`)
   - Add a note (call `contact_notes` with `action: "add"`)
   - Create a deal (call `opportunities` with `action: "create"` linked to this contact)
10. Execute and confirm.
