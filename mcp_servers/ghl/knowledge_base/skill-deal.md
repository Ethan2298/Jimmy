# Deal Review

Skill: deal
Description: Full context on a specific deal — history, contact, tasks, next steps
Mode: plan

## Instructions
1. If the user provided a deal name or keyword, call search_opportunities to find it. If multiple matches, present the list and ask which one.
2. If the user provided a deal ID directly, skip to step 3.
3. Call get_opportunity with the deal ID for full details (stage, value, status, dates).
4. Call get_contact on the linked contact to get their info (name, phone, email, tags).
5. Call get_contact_notes on the contact for interaction history.
6. Call get_contact_tasks on the contact for open follow-up tasks.
7. Call search_conversations with the contact_id, then get_conversation_messages on the most recent conversation for message history.
8. Present a comprehensive deal summary:
   - **Deal**: Name, pipeline, stage, monetary value, status, age (days since created)
   - **Contact**: Name, phone, email, tags, source
   - **History**: Recent notes (last 5) and last few messages
   - **Open Tasks**: What's pending with due dates
   - **Timeline**: Key dates — created, last stage change, last activity
9. Ask the user what to do next:
   - Move to next stage (call update_opportunity with new stage_id)
   - Add a note (call add_contact_note)
   - Create a follow-up task (call create_contact_task)
   - Send a message (call send_message)
   - Update deal value (call update_opportunity with monetary_value)
   - Close as won/lost (call update_opportunity with status)
10. Execute the chosen action and confirm.
