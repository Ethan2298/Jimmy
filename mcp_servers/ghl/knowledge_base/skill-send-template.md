# Send Template

Skill: send-template
Description: Load a message template, fill variables, preview, and send
Mode: execute

## Instructions
1. Call kb_search with query "template" to find available message templates in the knowledge base.
2. If no templates found, tell the user none exist yet and offer to create one (use kb_write to save a new template doc with slug "template-[name]").
3. Present the available templates: name, description, and what variables they expect.
4. Ask the user which template to use and who to send it to.
5. Identify the contact: call search_contacts with the name/phone. If multiple matches, ask the user to pick.
6. Call prepare_context with the contact ID to load their details, conversations, and memories.
7. Call kb_read with the selected template slug to load the full template content.
8. Fill the template variables using contact data and conversation context:
   - {{first_name}} — from contact details
   - {{vehicle}} — from conversation context, deal name, or ask the user
   - {{appointment_time}} — from calendar or ask the user
   - {{custom}} — any custom fields the template references
9. Present the filled message to the user for review. Show it exactly as the customer will see it.
10. On approval, call search_conversations with the contactId to find the conversation thread.
11. Call send_message with the conversation ID, message type (SMS by default), and the approved body.
12. Call add_contact_note documenting: which template was sent, the filled content, and when.
13. Confirm: template sent, note added.

## Notes
- Templates are stored in the knowledge base with slugs prefixed "template-" (e.g. "template-follow-up", "template-appointment-confirm").
- Template format: markdown doc with {{variable}} placeholders and a header describing when to use it.
