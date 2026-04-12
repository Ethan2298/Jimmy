# Inbox

Skill: inbox
Description: Surface unread and unanswered conversations ranked by urgency
Mode: plan

## Instructions
1. Call search_conversations with limit=30 to pull recent conversations.
2. Filter to conversations where lastMessageDirection is "inbound" — these are messages from customers waiting for a reply.
3. For each unanswered conversation, call get_contact with the contactId to get contact details and tags.
4. Rank conversations by urgency:
   - URGENT: Unread + last message within 2 hours + contact has an open opportunity (call search_opportunities with contactId)
   - NEEDS REPLY: Unread + last message within 24 hours
   - STALE: Inbound message older than 24 hours with no reply
5. Present a summary table: Name | Phone | Last Message Preview | Time Since | Urgency | Open Deal?
6. For each conversation, ask the user: Reply now? Snooze? Route to pipeline? Skip?
7. Execute the decision:
   - Reply now: Call get_conversation_messages to load full thread, draft a response following tone-and-voice rules (call kb_read with "tone-and-voice" first if not already loaded), present draft for approval, then call send_message
   - Snooze: Call create_contact_task with a follow-up reminder at the time the user specifies
   - Route to pipeline: Call create_opportunity linking the contact to the appropriate pipeline and stage
8. After processing, summarize: total conversations reviewed, replies sent, tasks created, deals created.
