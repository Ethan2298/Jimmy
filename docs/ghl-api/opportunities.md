# Opportunities API

**Base URL**: `https://services.leadconnectorhq.com`
**Version Header**: `2021-07-28`
**Scopes**: `opportunities.readonly`, `opportunities.write`

---

## Endpoints Overview

| Method | Path | Operation | Scope | Used? |
|--------|------|-----------|-------|:-----:|
| GET | `/opportunities/search` | Search Opportunities | readonly | YES |
| GET | `/opportunities/pipelines` | Get Pipelines | readonly | YES |
| GET | `/opportunities/{id}` | Get Opportunity | readonly | YES |
| POST | `/opportunities/` | Create Opportunity | write | YES |
| PUT | `/opportunities/{id}` | Update Opportunity | write | YES |
| DELETE | `/opportunities/{id}` | Delete Opportunity | write | YES |
| PUT | `/opportunities/{id}/status` | Update Status | write | - |
| POST | `/opportunities/upsert` | Upsert Opportunity | write | - |
| POST | `/opportunities/{id}/followers` | Add Followers | write | - |
| DELETE | `/opportunities/{id}/followers` | Remove Followers | write | - |

---

## GET /opportunities/search

Search opportunities with filters.

> **QUIRK**: This endpoint requires `location_id` (snake_case), not `locationId`.

**Parameters**:

| Name | In | Type | Required | Default | Description |
|------|----|------|----------|---------|-------------|
| location_id | query | string | YES | - | Location ID (snake_case!) |
| q | query | string | no | - | Search query (name, email, phone) |
| pipeline_id | query | string | no | - | Filter by pipeline |
| pipeline_stage_id | query | string | no | - | Filter by stage |
| contact_id | query | string | no | - | Filter by contact |
| status | query | string | no | - | `open`, `won`, `lost`, `abandoned`, `all` |
| assigned_to | query | string | no | - | Filter by assigned user |
| campaignId | query | string | no | - | Filter by campaign |
| id | query | string | no | - | Specific opportunity ID |
| order | query | string | no | - | Sort: `added_asc`, etc. |
| date | query | string | no | - | Start date (mm-dd-yyyy) |
| endDate | query | string | no | - | End date (mm-dd-yyyy) |
| page | query | number | no | 1 | Page number |
| limit | query | number | no | 20 | Max results (max 100) |
| startAfter | query | string | no | - | Cursor (timestamp) |
| startAfterId | query | string | no | - | Cursor (ID) |
| country | query | string | no | - | Country code |
| getTasks | query | boolean | no | false | Include tasks |
| getNotes | query | boolean | no | false | Include notes |
| getCalendarEvents | query | boolean | no | - | Include calendar events |

**Response 200**:
```json
{
  "opportunities": [{
    "id": "string",
    "name": "string",
    "monetaryValue": 0,
    "pipelineId": "string",
    "pipelineStageId": "string",
    "assignedTo": "string",
    "status": "open|won|lost|abandoned",
    "source": "string",
    "lastStatusChangeAt": "ISO datetime",
    "lastStageChangeAt": "ISO datetime",
    "lastActionDate": "ISO datetime",
    "createdAt": "ISO datetime",
    "updatedAt": "ISO datetime",
    "contactId": "string",
    "locationId": "string",
    "contact": {
      "id": "string",
      "name": "string",
      "companyName": "string",
      "email": "string",
      "phone": "string",
      "tags": ["string"]
    },
    "notes": [],
    "tasks": [],
    "calendarEvents": [],
    "customFields": [{ "id": "string", "fieldValue": "string|object|array" }],
    "followers": []
  }],
  "meta": {
    "total": 100,
    "nextPageUrl": "string",
    "startAfterId": "string",
    "startAfter": 1628008053263,
    "currentPage": 1,
    "nextPage": 2,
    "prevPage": null
  },
  "aggregations": {}
}
```

---

## GET /opportunities/pipelines

Get all pipelines and their stages.

**Parameters**:

| Name | In | Type | Required |
|------|----|------|----------|
| locationId | query | string | YES |

**Response 200**:
```json
{
  "pipelines": [{
    "id": "string",
    "name": "string",
    "stages": [{
      "id": "string",
      "name": "string",
      "position": 0
    }],
    "showInFunnel": true,
    "showInPieChart": true,
    "locationId": "string"
  }]
}
```

---

## GET /opportunities/{id}

Get a single opportunity.

**Response 200**:
```json
{
  "opportunity": { ... full opportunity schema ... }
}
```

---

## POST /opportunities/ (Create)

**Request Body** (required: pipelineId, locationId, name, status, contactId):
```json
{
  "pipelineId": "string",
  "locationId": "string",
  "name": "Deal name",
  "status": "open|won|lost|abandoned",
  "contactId": "string",
  "pipelineStageId": "string",
  "monetaryValue": 0,
  "assignedTo": "user ID",
  "customFields": [
    { "id": "field_id", "field_value": "string" },
    { "key": "field_key", "field_value": ["array", "values"] }
  ]
}
```

**Response 201**: `{ "opportunity": OpportunitySchema }`

---

## PUT /opportunities/{id} (Update)

**Request Body** (all optional):
```json
{
  "pipelineId": "string",
  "name": "string",
  "pipelineStageId": "string",
  "status": "open|won|lost|abandoned",
  "monetaryValue": 0,
  "assignedTo": "string",
  "customFields": []
}
```

**Custom field input formats**:
- String: `{ "id": "field_id", "field_value": "string" }`
- Array: `{ "id": "field_id", "field_value": ["val1", "val2"] }`
- Object: `{ "id": "field_id", "field_value": { ... } }`
- Can use `key` instead of `id`: `{ "key": "field_key", "field_value": "string" }`

**Response 200**: `{ "opportunity": OpportunitySchema }`

---

## DELETE /opportunities/{id}

**Response 200**: `{ "succeded": true }`

---

## PUT /opportunities/{id}/status

Update only the status of an opportunity.

**Request Body** (required: status):
```json
{ "status": "open|won|lost|abandoned" }
```

**Response 200**: `{ "succeded": true }`

---

## POST /opportunities/upsert

Create or update an opportunity.

**Request Body** (required: pipelineId, locationId, contactId):
```json
{
  "pipelineId": "string",
  "locationId": "string",
  "contactId": "string",
  "name": "string",
  "status": "open",
  "pipelineStageId": "string",
  "monetaryValue": 0,
  "assignedTo": "string"
}
```

**Response 200**:
```json
{
  "opportunity": { ... },
  "new": true
}
```

`new` is `true` if created, `false` if updated.

---

## POST /opportunities/{id}/followers

**Request Body**: `{ "followers": ["userId1", "userId2"] }`

**Response 201**:
```json
{
  "followers": ["all current followers"],
  "followersAdded": ["newly added followers"]
}
```

---

## DELETE /opportunities/{id}/followers

**Request Body**: `{ "followers": ["userId1"] }`

**Response 200**:
```json
{
  "followers": ["remaining followers"],
  "followersRemoved": ["removed followers"]
}
```
