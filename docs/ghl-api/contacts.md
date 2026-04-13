# Contacts API

**Base URL**: `https://services.leadconnectorhq.com`
**Version Header**: `2021-07-28`
**Scopes**: `contacts.readonly`, `contacts.write`

---

## Endpoints Overview

| Method | Path | Operation | Scope | Used? |
|--------|------|-----------|-------|:------------:|
| GET | `/contacts/` | Get Contacts (deprecated) | readonly | YES |
| POST | `/contacts/` | Create Contact | write | - |
| GET | `/contacts/{contactId}` | Get Contact | readonly | YES |
| PUT | `/contacts/{contactId}` | Update Contact | write | YES |
| DELETE | `/contacts/{contactId}` | Delete Contact | write | YES |
| POST | `/contacts/upsert` | Upsert Contact | write | YES |
| POST | `/contacts/search` | Search Contacts (Advanced) | readonly | - |
| GET | `/contacts/search/duplicate` | Get Duplicate Contact | readonly | - |
| GET | `/contacts/business/{businessId}` | Get Contacts by Business | readonly | - |
| POST | `/contacts/{contactId}/tags` | Add Tags | write | YES |
| DELETE | `/contacts/{contactId}/tags` | Remove Tags | write | YES |
| GET | `/contacts/{contactId}/notes` | Get All Notes | readonly | YES |
| POST | `/contacts/{contactId}/notes` | Create Note | write | YES |
| GET | `/contacts/{contactId}/notes/{id}` | Get Note | readonly | - |
| PUT | `/contacts/{contactId}/notes/{id}` | Update Note | write | - |
| DELETE | `/contacts/{contactId}/notes/{id}` | Delete Note | write | - |
| GET | `/contacts/{contactId}/tasks` | Get All Tasks | readonly | YES |
| POST | `/contacts/{contactId}/tasks` | Create Task | write | YES |
| GET | `/contacts/{contactId}/tasks/{taskId}` | Get Task | readonly | - |
| PUT | `/contacts/{contactId}/tasks/{taskId}` | Update Task | write | - |
| DELETE | `/contacts/{contactId}/tasks/{taskId}` | Delete Task | write | - |
| PUT | `/contacts/{contactId}/tasks/{taskId}/completed` | Update Task Status | write | - |
| GET | `/contacts/{contactId}/appointments` | Get Appointments | readonly | - |
| POST | `/contacts/{contactId}/followers` | Add Followers | write | - |
| DELETE | `/contacts/{contactId}/followers` | Remove Followers | write | - |
| POST | `/contacts/{contactId}/campaigns/{campaignId}` | Add to Campaign | write | - |
| DELETE | `/contacts/{contactId}/campaigns/{campaignId}` | Remove from Campaign | write | - |
| DELETE | `/contacts/{contactId}/campaigns/removeAll` | Remove from All Campaigns | write | - |
| POST | `/contacts/{contactId}/workflow/{workflowId}` | Add to Workflow | write | - |
| DELETE | `/contacts/{contactId}/workflow/{workflowId}` | Remove from Workflow | write | - |
| POST | `/contacts/bulk/tags/update/{type}` | Bulk Update Tags | write | - |
| POST | `/contacts/bulk/business` | Bulk Add/Remove Business | write | - |

---

## GET /contacts/ (Deprecated)

> **DEPRECATED** - Use POST `/contacts/search` for advanced filtering.

Get contacts list with basic filtering.

**Parameters**:

| Name | In | Type | Required | Default | Description |
|------|----|------|----------|---------|-------------|
| locationId | query | string | YES | - | Location ID |
| query | query | string | no | - | Search string (name, phone, email) |
| limit | query | number | no | 20 | Max results (max 100) |
| startAfterId | query | string | no | - | Cursor for pagination |
| startAfter | query | number | no | - | Timestamp cursor for pagination |

**Response 200**:
```json
{
  "contacts": [ContactSchema],
  "meta": { "total": 100, "startAfterId": "...", "startAfter": 1628008053263 }
}
```

---

## POST /contacts/search (Advanced)

Search contacts with advanced filter combinations.

**Request Body** (`SearchBodyV2DTO`): Complex filter object (see GHL docs for full filter schema).

**Response 200**: Same structure as GET `/contacts/`.

---

## GET /contacts/{contactId}

Get a single contact by ID.

**Parameters**:

| Name | In | Type | Required |
|------|----|------|----------|
| contactId | path | string | YES |

**Response 200** - Full Contact schema:
```json
{
  "contact": {
    "id": "string",
    "firstName": "string",
    "lastName": "string",
    "contactName": "string",
    "email": "string",
    "phone": "string",
    "address": "string",
    "city": "string",
    "state": "string",
    "country": "string",
    "postalCode": "string",
    "source": "string",
    "type": "string",
    "locationId": "string",
    "dnd": false,
    "dndSettings": {
      "Call": { "status": "active|inactive|permanent", "message": "", "code": "" },
      "Email": { "status": "active|inactive|permanent", "message": "", "code": "" },
      "SMS": { "status": "active|inactive|permanent", "message": "", "code": "" },
      "WhatsApp": { "status": "active|inactive|permanent", "message": "", "code": "" },
      "GMB": { "status": "active|inactive|permanent", "message": "", "code": "" },
      "FB": { "status": "active|inactive|permanent", "message": "", "code": "" }
    },
    "tags": ["string"],
    "customFields": [{ "id": "string", "value": "string" }],
    "dateAdded": "ISO datetime",
    "dateUpdated": "ISO datetime",
    "assignedTo": "user ID",
    "followers": ["user IDs"],
    "additionalEmails": ["string"],
    "additionalPhones": ["string"],
    "companyName": "string",
    "businessName": "string",
    "businessId": "string",
    "dateOfBirth": "string",
    "validEmail": true,
    "opportunities": [{
      "id": "string",
      "pipeline_id": "string",
      "pipeline_stage_id": "string",
      "monetary_value": 0,
      "status": "string"
    }],
    "attributions": [],
    "searchAfter": []
  }
}
```

---

## POST /contacts/ (Create)

Create a new contact.

**Request Body** (`CreateContactDto`): Same fields as the contact schema (firstName, lastName, email, phone, address, city, state, country, postalCode, tags, source, customFields, locationId, etc.)

**Response 201**: `{ "contact": ContactSchema }`

---

## PUT /contacts/{contactId} (Update)

Update an existing contact. Only pass fields you want to change.

**Request Body** (`UpdateContactDto`): Any subset of contact fields.

**Response 200**: `{ "contact": ContactSchema }`

---

## DELETE /contacts/{contactId}

Delete a contact.

**Response 200**: `{ "succeded": true }`

---

## POST /contacts/upsert

Create or update a contact. Matches on email (priority) or phone based on "Allow Duplicate Contact" setting.

**Request Body** (`UpsertContactDto`): Same as create, must include `locationId`.

**Response 200**: `{ "contact": ContactSchema }`

---

## POST /contacts/{contactId}/tags (Add Tags)

**Request Body**:
```json
{ "tags": ["tag1", "tag2"] }
```

**Response 201**: `{ "tags": ["tag1", "tag2"] }`

---

## DELETE /contacts/{contactId}/tags (Remove Tags)

**Request Body**: Same as Add Tags.

**Response 200**: `{ "tags": ["remaining-tags"] }`

---

## GET /contacts/{contactId}/notes

**Response 200**:
```json
{
  "notes": [{
    "id": "string",
    "body": "string",
    "userId": "string",
    "dateAdded": "ISO datetime",
    "contactId": "string"
  }]
}
```

---

## POST /contacts/{contactId}/notes (Create Note)

**Request Body**:
```json
{ "body": "note text", "userId": "optional user ID" }
```

**Response 201**: `{ "note": NoteSchema }`

---

## PUT /contacts/{contactId}/notes/{id} (Update Note)

**Request Body**: Same as create note.

**Response 200**: `{ "note": NoteSchema }`

---

## DELETE /contacts/{contactId}/notes/{id}

**Response 200**: `{ "succeded": true }`

---

## GET /contacts/{contactId}/tasks

**Response 200**:
```json
{
  "tasks": [{
    "id": "string",
    "title": "string",
    "body": "string",
    "assignedTo": "string",
    "dueDate": "ISO datetime",
    "completed": false,
    "contactId": "string"
  }]
}
```

---

## POST /contacts/{contactId}/tasks (Create Task)

**Request Body** (required: title, dueDate, completed):
```json
{
  "title": "Task title",
  "body": "description",
  "dueDate": "2024-10-25T11:00:00Z",
  "completed": false,
  "assignedTo": "user ID"
}
```

**Response 201**: `{ "task": TaskSchema }`

---

## PUT /contacts/{contactId}/tasks/{taskId} (Update Task)

**Request Body**: Any subset of task fields (title, body, dueDate, completed, assignedTo).

**Response 200**: `{ "task": TaskSchema }`

---

## DELETE /contacts/{contactId}/tasks/{taskId}

**Response 200**: `{ "succeded": true }`

---

## PUT /contacts/{contactId}/tasks/{taskId}/completed

**Request Body**: `{ "completed": true }`

**Response 200**: Success

---

## GET /contacts/{contactId}/appointments

**Response 200**:
```json
{
  "events": [{
    "id": "string",
    "calendarId": "string",
    "status": "string",
    "title": "string",
    "assignedUserId": "string",
    "notes": "string",
    "startTime": "ISO datetime",
    "endTime": "ISO datetime",
    "address": "string",
    "locationId": "string",
    "contactId": "string",
    "groupId": "string",
    "appointmentStatus": "string",
    "users": ["string"],
    "dateAdded": "ISO datetime",
    "dateUpdated": "ISO datetime",
    "assignedResources": ["string"]
  }]
}
```

---

## POST /contacts/{contactId}/followers

**Request Body**: `{ "followers": ["userId1", "userId2"] }`

**Response 201**: `{ "followers": [...], "followersAdded": [...] }`

---

## DELETE /contacts/{contactId}/followers

**Request Body**: `{ "followers": ["userId1"] }`

**Response 200**: `{ "followers": [...], "followersRemoved": [...] }`

---

## POST /contacts/{contactId}/campaigns/{campaignId}

Add contact to a campaign. No request body needed.

**Response 201**: Success

---

## DELETE /contacts/{contactId}/campaigns/{campaignId}

Remove contact from a campaign.

**Response 200**: Success

---

## DELETE /contacts/{contactId}/campaigns/removeAll

Remove contact from ALL campaigns.

**Response 200**: Success

---

## POST /contacts/{contactId}/workflow/{workflowId}

Add contact to a workflow.

**Response 200**: Success

---

## DELETE /contacts/{contactId}/workflow/{workflowId}

Remove contact from a workflow.

**Response 200**: Success

---

## POST /contacts/bulk/tags/update/{type}

Bulk add or remove tags. `{type}` is `add` or `remove`.

**Request Body**:
```json
{
  "contacts": ["contactId1", "contactId2"],
  "tags": ["tag1", "tag2"],
  "locationId": "string",
  "removeAllTags": false
}
```

`removeAllTags` only valid with `remove` type.

**Response 201**:
```json
{
  "succeded": true,
  "errorCount": 0,
  "responses": [{
    "contactId": "string",
    "message": "string",
    "type": "success|error",
    "oldTags": [],
    "tagsAdded": [],
    "tagsRemoved": []
  }]
}
```
