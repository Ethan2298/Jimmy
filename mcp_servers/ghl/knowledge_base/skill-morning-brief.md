# Morning Brief

Skill: morning-brief
Description: Daily snapshot of pipeline health, inbox activity, and today's calendar
Mode: review

## Instructions
1. Call get_pipelines to get all pipelines and their stages.
2. Call search_opportunities with status "open" and limit=50 to get active deals.
3. Group opportunities by pipeline and stage. Calculate:
   - Count per stage
   - Total monetary value per stage
   - Deals in the same stage for 7+ days (flag as stale)
4. Call search_conversations with limit=10 to get recent inbox activity.
5. Call list_calendars, then get_calendar_events for today's date range (start of day to end of day, use America/New_York timezone).
6. Present the morning brief:
   - **Pipeline Summary**: Stage breakdown with counts and values. Highlight movement since last check if possible.
   - **Stale Deals**: Any deals stuck in a stage 7+ days. Show name, stage, and days stuck.
   - **Inbox**: Recent conversations. Note any that look unread or need response.
   - **Today's Calendar**: Appointments and events for the day with times and contacts.
7. End with 3 suggested priorities based on what you found. Be specific — name the deals and contacts.
