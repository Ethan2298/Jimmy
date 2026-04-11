---
description: Create a custom Jimmy skill with guided prompts
---

# Jimmy Skill Builder

Help the user create a custom skill that gets saved to the knowledge base and is immediately runnable via `/jimmy`.

## What to do

1. Call `kb_read` with slug "skill-template" to load the skill template. This is the format all skills follow.
2. Walk the user through each field:
   - **Name**: What should this skill be called? (e.g. "Inventory Check", "Hot Lead Alert")
   - **Slug**: Auto-generate from the name, lowercase with hyphens. Confirm with user.
   - **Description**: One sentence — what does this skill do?
   - **Mode**: How should it run?
     - plan = present findings, ask before taking actions
     - execute = act directly, report results
     - review = read-only analysis
   - **Steps**: Walk through what the skill should do. Help the user map their workflow to available MCP tools:
     - Contacts: search_contacts, get_contact, update_contact, create_or_update_contact, add_contact_tags, remove_contact_tags
     - Deals: search_opportunities, get_opportunity, create_opportunity, update_opportunity, delete_opportunity
     - Conversations: search_conversations, get_conversation_messages, send_message
     - Calendar: list_calendars, get_calendar_events, get_calendar_free_slots, book_appointment
     - Tasks: get_contact_tasks, create_contact_task
     - Notes: get_contact_notes, add_contact_note
     - Pipeline: get_pipelines
     - Location: get_location, get_location_tags, get_location_custom_fields, get_users
     - Knowledge Base: kb_list, kb_read, kb_write, kb_search
3. Assemble the skill doc using the template format from step 1.
4. Call `kb_write` with name "skill-[slug]" and the assembled markdown content.
5. Confirm the skill was saved. Tell the user they can run it with `/jimmy [slug]`.
