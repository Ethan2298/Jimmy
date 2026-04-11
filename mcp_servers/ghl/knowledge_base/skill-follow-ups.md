# Follow-Ups

Skill: follow-ups
Description: Review pending tasks and overdue follow-ups, draft and send messages
Mode: plan

## Instructions
1. Call search_contacts with tag "follow-up" to find contacts needing follow-up.
2. If no tagged contacts found, call search_opportunities with status "open" and check which contacts have the oldest last activity.
3. For each contact found, call get_contact_tasks to see their open tasks.
4. Sort tasks by due date. Overdue items first.
5. Present each contact with their tasks:
   - Contact name and phone/email
   - Task description and due date
   - Whether it is overdue
   - Last conversation snippet if available (call search_conversations with contact_id)
6. For each, ask the user: Send follow-up message? Reschedule? Mark complete? Skip?
7. Execute the decision:
   - Send message: Ask user for message text or offer to draft one, then call send_message on the contact's conversation
   - Reschedule: Call create_contact_task with an updated due date
   - Mark complete: Call add_contact_note documenting the outcome
8. Summarize all actions taken at the end.
