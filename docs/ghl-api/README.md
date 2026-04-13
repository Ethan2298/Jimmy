# GoHighLevel API v2 Reference

Local reference docs for the GHL API endpoints used by Jimmy.

**Source**: [GoHighLevel/highlevel-api-docs](https://github.com/GoHighLevel/highlevel-api-docs) (official OpenAPI specs)

## Base URL

```
https://services.leadconnectorhq.com
```

## Authentication

All requests require:
- **Authorization**: `Bearer <token>` (Private Integration Token or OAuth Access Token)
- **Version**: `2021-07-28` header (contacts, opportunities, locations, users) or `2021-04-15` (conversations, calendars)
- **Content-Type**: `application/json`

## API Docs Index

| Doc | Scopes | Description |
|-----|--------|-------------|
| [contacts.md](./contacts.md) | `contacts.readonly`, `contacts.write` | Contact CRUD, search, upsert, tags, notes, tasks, followers, campaigns, workflows |
| [conversations.md](./conversations.md) | `conversations.readonly`, `conversations.write`, `conversations/message.readonly`, `conversations/message.write` | Conversation search, messages, send SMS/Email/WhatsApp, recordings, transcriptions |
| [opportunities.md](./opportunities.md) | `opportunities.readonly`, `opportunities.write` | Deal/opportunity CRUD, search, pipelines, status updates, upsert |
| [calendars.md](./calendars.md) | `calendars.readonly`, `calendars.write`, `calendars/events.readonly`, `calendars/events.write` | Calendars, appointments, free slots, groups, block slots, resources |
| [locations.md](./locations.md) | `locations.readonly`, `locations/tags.readonly`, `locations/tags.write` | Location details, custom fields, tags, tasks |
| [users.md](./users.md) | `users.readonly`, `users.write` | User CRUD, search, permissions, scopes |

## GHL API Quirks

These are documented in code (`src/lib/ghl/client.ts`) but worth noting:

1. **Snake-case location param**: `/opportunities/search` requires `location_id` (snake_case). All other endpoints use `locationId` (camelCase).
2. **Sub-resource endpoints reject locationId**: Endpoints ending in `/notes`, `/tasks`, `/messages`, `/free-slots`, `/customFields` return 422 if you pass `locationId` in query params.
3. **API version inconsistency**: Contacts/Opportunities/Locations/Users use `Version: 2021-07-28`. Conversations/Calendars use `Version: 2021-04-15`.
4. **Pagination varies by endpoint**: Some use `startAfter`/`startAfterId` cursor pagination, others use `page`/`limit`, others use `skip`/`limit`.
5. **Response typo**: Delete responses use `succeded` (misspelled) not `succeeded`.

## Rate Limits

GHL enforces rate limits per API key. No official published limits in the spec, but expect standard REST API throttling. Handle 429 responses with exponential backoff.

## What We Use vs What's Available

Jimmy currently implements a subset of these endpoints. Each doc file marks which endpoints we currently use vs what's available to add.
