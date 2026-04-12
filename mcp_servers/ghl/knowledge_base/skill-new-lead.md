# New Lead

Skill: new-lead
Description: Intake a new inbound lead — create contact, tag, create deal, log note
Mode: execute

## Instructions
1. Ask the user for the lead details: name, phone, email, source, and what they're interested in.
2. Call search_contacts with the name and/or phone to check if the contact already exists.
3. If the contact exists:
   - Call prepare_context with their contact ID to load full history.
   - Present the existing contact details and ask: update this contact, or create a new one?
4. If the contact does not exist (or user wants a new one):
   - Call create_or_update_contact with the provided details.
   - Call add_contact_tags with tags: "new-lead" and the source (e.g. "source:instagram", "source:walk-in", "source:referral").
5. Call get_pipelines to get pipeline and stage IDs.
6. Create an opportunity: call create_opportunity with the contact ID, the "Car Sales" pipeline (or ask user which pipeline), the first stage ("New Inquiry"), and a title based on what the lead is interested in.
7. Call add_contact_note summarizing the intake: who, what they want, source, any initial impressions.
8. If the lead came with a message or conversation context, call memory_write to store it for future reference.
9. Ask the user: send an intro message now? If yes, run the send skill flow (search conversation, draft, confirm, send).
10. Summarize: contact created/updated, deal created, tags added, note logged, message sent (if applicable).
