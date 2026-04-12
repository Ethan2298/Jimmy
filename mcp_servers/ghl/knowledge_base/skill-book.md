# Book

Skill: book
Description: End-to-end appointment booking — check availability, propose times, book, confirm
Mode: execute

## Instructions
1. Identify the contact. If the user gave a name or phone, call search_contacts. If they gave a contact ID, call get_contact directly.
2. If multiple matches, present them and ask the user to pick one.
3. Call list_calendars to get available calendars and their IDs.
4. Ask the user which calendar to book on (or use the default if there's only one).
5. Ask for the desired date range. Call get_calendar_free_slots with the calendar ID and date range to find open times.
6. Present available slots in a clean list: Day | Time | Duration.
7. Ask the user which slot to book, or let them specify a custom time.
8. Confirm the booking details: contact name, date, time, calendar, and any notes.
9. On confirmation, call book_appointment with the calendar ID, contact ID, selected slot start/end time, and any title or notes.
10. After booking, call add_contact_note documenting the appointment: what it's for, when, any prep notes.
11. Ask the user if they want to send a confirmation message to the customer.
12. If yes, call search_conversations with the contactId, draft a short confirmation in the dealership voice (call kb_read with "tone-and-voice"), present for approval, then call send_message.
13. Confirm to the user: appointment booked, note added, confirmation sent (if applicable).
