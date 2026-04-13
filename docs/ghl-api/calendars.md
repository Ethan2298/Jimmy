# Calendars API

**Base URL**: `https://services.leadconnectorhq.com`
**Version Header**: `2021-04-15`
**Scopes**: `calendars.readonly`, `calendars.write`, `calendars/groups.readonly`, `calendars/groups.write`, `calendars/events.readonly`, `calendars/events.write`, `calendars/resources.readonly`, `calendars/resources.write`

---

## Endpoints Overview

| Method | Path | Operation | Scope | Used? |
|--------|------|-----------|-------|:-----:|
| GET | `/calendars/` | Get Calendars | calendars.readonly | YES |
| POST | `/calendars/` | Create Calendar | calendars.write | - |
| GET | `/calendars/{calendarId}` | Get Calendar | calendars.readonly | - |
| PUT | `/calendars/{calendarId}` | Update Calendar | calendars.write | - |
| DELETE | `/calendars/{calendarId}` | Delete Calendar | calendars.write | - |
| GET | `/calendars/{calendarId}/free-slots` | Get Free Slots | calendars.readonly | YES |
| GET | `/calendars/events` | Get Calendar Events | calendars/events.readonly | YES |
| POST | `/calendars/events/appointments` | Create Appointment | calendars/events.write | YES |
| GET | `/calendars/events/appointments/{eventId}` | Get Appointment | calendars/events.readonly | - |
| PUT | `/calendars/events/appointments/{eventId}` | Update Appointment | calendars/events.write | YES |
| DELETE | `/calendars/events/{eventId}` | Delete Event | calendars/events.write | YES |
| POST | `/calendars/events/block-slots` | Create Block Slot | calendars/events.write | - |
| PUT | `/calendars/events/block-slots/{eventId}` | Update Block Slot | calendars/events.write | - |
| GET | `/calendars/blocked-slots` | Get Blocked Slots | calendars/events.readonly | - |
| GET | `/calendars/groups` | Get Groups | calendars/groups.readonly | - |
| POST | `/calendars/groups` | Create Group | calendars/groups.write | - |
| PUT | `/calendars/groups/{groupId}` | Update Group | calendars/groups.write | - |
| DELETE | `/calendars/groups/{groupId}` | Delete Group | calendars/groups.write | - |
| PUT | `/calendars/groups/{groupId}/status` | Disable Group | calendars/groups.write | - |
| POST | `/calendars/groups/validate-slug` | Validate Slug | calendars/groups.write | - |
| GET | `/calendars/appointments/{appointmentId}/notes` | Get Notes | calendars/events.readonly | - |
| POST | `/calendars/appointments/{appointmentId}/notes` | Create Note | calendars/events.write | - |
| PUT | `/calendars/appointments/{appointmentId}/notes/{noteId}` | Update Note | calendars/events.write | - |
| DELETE | `/calendars/appointments/{appointmentId}/notes/{noteId}` | Delete Note | calendars/events.write | - |
| GET | `/calendars/{calendarId}/notifications` | Get Notifications | calendars/events.readonly | - |
| POST | `/calendars/{calendarId}/notifications` | Create Notification | calendars/events.write | - |
| PUT | `/calendars/{calendarId}/notifications/{notificationId}` | Update Notification | calendars/events.write | - |
| DELETE | `/calendars/{calendarId}/notifications/{notificationId}` | Delete Notification | calendars/events.write | - |
| GET | `/calendars/resources/{resourceType}` | List Resources | calendars/resources.readonly | - |
| POST | `/calendars/resources/{resourceType}` | Create Resource | calendars/resources.write | - |
| GET | `/calendars/resources/{resourceType}/{id}` | Get Resource | calendars/resources.readonly | - |
| PUT | `/calendars/resources/{resourceType}/{id}` | Update Resource | calendars/resources.write | - |
| DELETE | `/calendars/resources/{resourceType}/{id}` | Delete Resource | calendars/resources.write | - |

---

## GET /calendars/

Get all calendars in a location.

**Parameters**:

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| locationId | query | string | YES | Location ID |
| groupId | query | string | no | Filter by group |
| showDrafted | query | boolean | no | Include drafts (default: true) |

**Response 200**: `{ "calendars": [CalendarSchema] }`

---

## GET /calendars/{calendarId}/free-slots

Get available time slots for a calendar.

> **Note**: Date range cannot exceed 31 days.

**Parameters**:

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| calendarId | path | string | YES | Calendar ID |
| startDate | query | number | YES | Start (milliseconds timestamp) |
| endDate | query | number | YES | End (milliseconds timestamp) |
| timezone | query | string | no | IANA timezone (e.g. `America/Chihuahua`) |
| userId | query | string | no | Filter by user |
| userIds | query | string[] | no | Filter by multiple users |

> **Note**: Our tools pass startDate/endDate as `YYYY-MM-DD` strings, but the spec says milliseconds. GHL appears to accept both formats.

**Response 200**:
```json
{
  "2024-10-28": {
    "slots": ["2024-10-28T10:00:00-05:00", "2024-10-28T10:30:00-05:00"]
  },
  "2024-10-29": {
    "slots": ["2024-10-29T09:00:00-05:00"]
  }
}
```

---

## GET /calendars/events

Get calendar events within a time range.

**Parameters**:

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| locationId | query | string | YES | Location ID |
| startTime | query | string | YES | Start (milliseconds timestamp) |
| endTime | query | string | YES | End (milliseconds timestamp) |
| calendarId | query | string | no | Filter by calendar |
| userId | query | string | no | Filter by user |
| groupId | query | string | no | Filter by group |

**Response 200**: `{ "events": [EventSchema] }`

---

## POST /calendars/events/appointments (Create)

Book a new appointment.

**Request Body** (required: calendarId, locationId, contactId, startTime):
```json
{
  "calendarId": "string",
  "locationId": "string",
  "contactId": "string",
  "startTime": "2021-06-23T03:30:00+05:30",
  "endTime": "2021-06-23T04:30:00+05:30",
  "title": "Test Event",
  "meetingLocationType": "custom|zoom|gmeet|phone|address|ms_teams|google",
  "meetingLocationId": "default",
  "overrideLocationConfig": false,
  "appointmentStatus": "new|confirmed|cancelled|showed|noshow|invalid",
  "assignedUserId": "string",
  "description": "string",
  "address": "string",
  "ignoreDateRange": false,
  "toNotify": false,
  "ignoreFreeSlotValidation": false,
  "rrule": "RFC 5545 recurrence rule"
}
```

**Response 200**:
```json
{
  "id": "string",
  "calendarId": "string",
  "locationId": "string",
  "contactId": "string",
  "startTime": "ISO datetime",
  "endTime": "ISO datetime",
  "title": "string",
  "appointmentStatus": "new|confirmed|cancelled|showed|noshow|invalid|active|completed",
  "isRecurring": false,
  "rrule": "string",
  "assignedUserId": "string",
  "address": "string",
  "meetingLocationType": "string"
}
```

---

## GET /calendars/events/appointments/{eventId}

Get a single appointment. For recurring events, use format `eventId_timestamp_duration`.

**Response 200**: `{ "event": AppointmentSchema }`

---

## PUT /calendars/events/appointments/{eventId} (Update)

**Request Body**: Same fields as create, all optional.

**Response 200**: `{ "event": AppointmentSchema }`

---

## DELETE /calendars/events/{eventId}

Delete a calendar event.

**Response 201**: Success

---

## POST /calendars/events/block-slots

Block off time on a calendar.

**Response 201**: `{ "blockSlot": BlockSlotSchema }`

---

## Calendar Groups

### GET /calendars/groups

Get all groups. **Response**: `{ "groups": [GroupSchema] }`

### POST /calendars/groups

**Request Body** (required: locationId, name, description, slug):
```json
{
  "locationId": "string",
  "name": "string",
  "description": "string",
  "slug": "string",
  "isActive": true
}
```

### PUT /calendars/groups/{groupId}

**Request Body** (required: name, description, slug).

### DELETE /calendars/groups/{groupId}

**Response**: `{ "success": true }`

### POST /calendars/groups/validate-slug

Check if a slug is available. **Request**: `{ "locationId": "string", "slug": "string" }`. **Response**: `{ "available": true }`.

---

## Appointment Notes

### GET /calendars/appointments/{appointmentId}/notes

**Parameters**: limit (max 20), offset (min 0).

### POST /calendars/appointments/{appointmentId}/notes

Create a note on an appointment.

### PUT /calendars/appointments/{appointmentId}/notes/{noteId}

Update appointment note.

### DELETE /calendars/appointments/{appointmentId}/notes/{noteId}

Delete appointment note.

---

## Calendar Resources

Resources are either `equipments` or `rooms`. The `{resourceType}` path param accepts these values.

### GET /calendars/resources/{resourceType}

List resources. Params: locationId, limit, skip.

### POST /calendars/resources/{resourceType}

Create a resource.

### GET /calendars/resources/{resourceType}/{id}

Get a single resource.

### PUT /calendars/resources/{resourceType}/{id}

Update a resource.

### DELETE /calendars/resources/{resourceType}/{id}

Delete a resource.
