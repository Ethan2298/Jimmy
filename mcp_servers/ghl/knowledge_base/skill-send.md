# Send

Skill: send
Description: Draft and send a message to a contact with full conversation context
Mode: execute

## Instructions
1. Identify the target contact. If the user gave a name or phone number, call search_contacts with the query. If they gave a contact ID, call get_contact directly.
2. If multiple matches, present them and ask the user to pick one.
3. Call search_conversations with the contactId to find their conversation thread.
4. Call get_conversation_messages on the conversation to load the full message history.
5. Call memory_search with the contact's name or ID to recall any stored context (preferences, prior interactions, buyer type).
6. Call kb_read with "tone-and-voice" to load voice rules.
7. Summarize the conversation state to the user:
   - Last few messages (direction, content, timestamp)
   - How long since last activity
   - Any open deals (call search_opportunities with contactId)
   - Any stored memories about this contact
8. Ask the user what they want to say, or offer to draft a message based on context.
9. Draft the message following tone-and-voice rules:
   - Under 160 characters per SMS
   - Casual, warm, no corporate language
   - One question per message
   - Reference specific details from conversation history
10. Present the draft to the user for approval. Show it exactly as the customer will see it.
11. On approval, call send_message with the conversationId, messageType "SMS" (or "Email" if user specifies), and the approved body.
12. After sending, call add_contact_note summarizing what was sent and why.
13. If the conversation revealed something worth remembering, call memory_write to store it.
14. Confirm to the user: message sent, note added, any memories stored.
