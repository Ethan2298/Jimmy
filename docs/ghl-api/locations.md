# Locations API (Sub-Account)

**Base URL**: `https://services.leadconnectorhq.com`
**Version Header**: `2021-07-28`
**Scopes**: `locations.readonly`, `locations.write`, `locations/tags.readonly`, `locations/tags.write`, `locations/tasks.readonly`

---

## Endpoints Overview

| Method | Path | Operation | Scope | Used? |
|--------|------|-----------|-------|:-----:|
| GET | `/locations/search` | Search Locations | locations.readonly | - |
| GET | `/locations/{locationId}` | Get Location | locations.readonly | YES |
| PUT | `/locations/{locationId}` | Update Location | locations.write | - |
| DELETE | `/locations/{locationId}` | Delete Location | agency only | - |
| GET | `/locations/{locationId}/tags` | Get Tags | locations/tags.readonly | YES |
| POST | `/locations/{locationId}/tags` | Create Tag | locations/tags.write | - |
| GET | `/locations/{locationId}/tags/{tagId}` | Get Tag | locations/tags.readonly | - |
| PUT | `/locations/{locationId}/tags/{tagId}` | Update Tag | locations/tags.write | - |
| DELETE | `/locations/{locationId}/tags/{tagId}` | Delete Tag | locations/tags.write | - |
| GET | `/locations/{locationId}/customFields` | Get Custom Fields | bearer | YES |
| POST | `/locations/{locationId}/tasks/search` | Search Tasks | locations/tasks.readonly | - |
| POST | `/locations/{locationId}/recurring-tasks` | Create Recurring Task | bearer | - |
| GET | `/locations/{locationId}/recurring-tasks/{id}` | Get Recurring Task | bearer | - |
| PUT | `/locations/{locationId}/recurring-tasks/{id}` | Update Recurring Task | bearer | - |
| DELETE | `/locations/{locationId}/recurring-tasks/{id}` | Delete Recurring Task | bearer | - |

---

## GET /locations/{locationId}

Get location details.

**Response 200**:
```json
{
  "location": {
    "id": "string",
    "name": "string",
    "phone": "string",
    "address": "string",
    "city": "string",
    "state": "string",
    "country": "string",
    "postalCode": "string",
    "website": "string",
    "timezone": "string",
    "settings": {},
    "social": {}
  }
}
```

---

## GET /locations/{locationId}/tags

Get all tags for a location.

> **Note**: This endpoint is used by our `location_info` tool with action `tags`.

**Response 200**:
```json
{
  "tags": [{
    "id": "string",
    "name": "string",
    "locationId": "string"
  }]
}
```

---

## POST /locations/{locationId}/tags

Create a new tag.

**Request Body** (required: name):
```json
{ "name": "tag name" }
```

**Response 201**: `{ "tag": TagSchema }`

---

## PUT /locations/{locationId}/tags/{tagId}

**Request Body**: `{ "name": "new name" }`

---

## DELETE /locations/{locationId}/tags/{tagId}

**Response 200**: Success

---

## GET /locations/{locationId}/customFields

Get all custom fields for a location.

> **Note**: Sub-resource endpoint -- do NOT pass locationId as query param (422 error).

**Parameters**:

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| locationId | path | string | YES | Location ID |
| model | query | string | no | `contact`, `opportunity`, or `all` |

**Response 200**:
```json
{
  "customFields": [{
    "id": "string",
    "name": "string",
    "fieldKey": "string",
    "placeholder": "string",
    "dataType": "string",
    "position": 0,
    "picklistOptions": ["string"],
    "picklistImageOptions": [],
    "isAllowedCustomOption": false,
    "isMultiFileAllowed": false,
    "maxFileLimit": 0,
    "locationId": "string",
    "model": "contact|opportunity"
  }]
}
```

---

## POST /locations/{locationId}/tasks/search

Search tasks across a location (not contact-specific).

**Request Body**:
```json
{
  "contactId": "string",
  "completed": false,
  "assignedTo": "user ID",
  "query": "search string",
  "limit": 20,
  "skip": 0,
  "businessId": "string"
}
```

---

## Recurring Tasks

### POST /locations/{locationId}/recurring-tasks

**Request Body** (required: title, rruleOptions):
```json
{
  "title": "string",
  "description": "string",
  "contactIds": ["string"],
  "owners": ["string"],
  "ignoreTaskCreation": false,
  "rruleOptions": {
    "intervalType": "yearly|monthly|weekly|daily|hourly",
    "interval": 1,
    "startDate": "ISO datetime",
    "endDate": "ISO datetime",
    "dayOfMonth": 1,
    "dayOfWeek": ["MO", "TU"],
    "monthOfYear": 1,
    "count": 10,
    "createTaskIfOverDue": true,
    "dueAfterSeconds": 86400
  }
}
```

### GET /locations/{locationId}/recurring-tasks/{id}

### PUT /locations/{locationId}/recurring-tasks/{id}

### DELETE /locations/{locationId}/recurring-tasks/{id}
