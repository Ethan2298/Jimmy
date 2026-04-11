# Contact Review

Skill: contact
Description: Full profile of a contact — details, deals, history, and actions
Mode: plan

## Instructions
1. If the user provided a name, phone, or email, call search_contacts with their query. If multiple matches, present the list and ask which one.
2. If the user provided a contact ID directly, skip to step 3.
3. Call get_contact with the contact ID for full details.
4. Call get_contact_notes for their note history.
5. Call get_contact_tasks for open tasks.
6. Call search_conversations with the contact_id for message threads. If threads exist, call get_conversation_messages on the most recent one.
7. Call search_opportunities with contact_id to find any linked deals.
8. Present a full contact profile:
   - **Contact Info**: Name, phone, email, source, tags, address, DND status
   - **Deals**: Any linked opportunities with pipeline, stage, and value
   - **Notes**: Recent interaction notes (last 5)
   - **Tasks**: Open follow-ups with due dates
   - **Conversations**: Last few messages from most recent thread
   - **Custom Fields**: Any custom field values set on the contact
9. Ask the user what to do next:
   - Update contact info (call update_contact)
   - Add a tag (call add_contact_tags)
   - Create a task (call create_contact_task)
   - Send a message (call send_message)
   - Add a note (call add_contact_note)
   - Create a deal (call create_opportunity linked to this contact)
10. Execute and confirm.
