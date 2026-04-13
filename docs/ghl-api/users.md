# Users API

**Base URL**: `https://services.leadconnectorhq.com`
**Version Header**: `2021-07-28`
**Scopes**: `users.readonly`, `users.write`

---

## Endpoints Overview

| Method | Path | Operation | Scope | Used? |
|--------|------|-----------|-------|:-----:|
| GET | `/users/` | Get Users by Location | users.readonly | YES |
| POST | `/users/` | Create User | users.write | - |
| GET | `/users/{userId}` | Get User | users.readonly | YES |
| PUT | `/users/{userId}` | Update User | users.write | - |
| DELETE | `/users/{userId}` | Delete User | users.write | - |
| GET | `/users/search` | Search Users | users.readonly | - |
| POST | `/users/search/filter-by-email` | Filter by Email | users.readonly | - |

---

## GET /users/

Get all users for a location.

**Parameters**:

| Name | In | Type | Required |
|------|----|------|----------|
| locationId | query | string | YES |

**Response 200**:
```json
{
  "users": [{
    "id": "string",
    "name": "string",
    "firstName": "string",
    "lastName": "string",
    "email": "string",
    "phone": "string",
    "extension": "string",
    "permissions": { ... },
    "scopes": "string",
    "roles": {
      "type": "account",
      "role": "admin",
      "locationIds": ["string"],
      "restrictSubAccount": false
    },
    "deleted": false,
    "lcPhone": { "locationId": "+1234556677" }
  }]
}
```

---

## GET /users/{userId}

Get a single user.

**Response 200**: Same as individual user in array above.

---

## POST /users/ (Create)

**Request Body** (required: companyId, firstName, lastName, email, password, type, role, locationIds):
```json
{
  "companyId": "string",
  "firstName": "string",
  "lastName": "string",
  "email": "string",
  "password": "string",
  "phone": "string",
  "type": "account",
  "role": "admin",
  "locationIds": ["string"],
  "permissions": { ... },
  "scopes": ["contacts.write", "opportunities.write", ...],
  "scopesAssignedToOnly": [],
  "profilePhoto": "https://img.png"
}
```

**Response 201**: UserSchema

---

## PUT /users/{userId} (Update)

**Request Body** (all optional):
```json
{
  "firstName": "string",
  "lastName": "string",
  "email": "string (deprecated - use emailChangeOTP flow)",
  "emailChangeOTP": "191344",
  "password": "string",
  "phone": "string",
  "type": "account",
  "role": "admin",
  "companyId": "string",
  "locationIds": ["string"],
  "permissions": { ... },
  "scopes": [],
  "scopesAssignedToOnly": [],
  "profilePhoto": "https://img.png"
}
```

**Response 200**: UserSchema

---

## DELETE /users/{userId}

**Response 200**:
```json
{
  "succeded": true,
  "message": "Queued deleting user with e-mail john@deo.com..."
}
```

---

## GET /users/search

Search users across an agency.

**Parameters**:

| Name | In | Type | Required | Default | Description |
|------|----|------|----------|---------|-------------|
| companyId | query | string | YES | - | Agency/company ID |
| query | query | string | no | - | Search string |
| skip | query | string | no | 0 | Offset |
| limit | query | string | no | 25 | Max results |
| locationId | query | string | no | - | Filter by location |
| type | query | string | no | - | e.g. `agency` |
| role | query | string | no | - | e.g. `admin` |
| ids | query | string | no | - | Comma-separated user IDs |
| sort | query | string | no | - | e.g. `dateAdded` |
| sortDirection | query | string | no | - | `asc` or `desc` |

**Response 200**: `{ "users": [UserSchema], "count": 123 }`

---

## POST /users/search/filter-by-email

**Request Body** (required: companyId, emails):
```json
{
  "companyId": "string",
  "emails": ["user1@example.com", "user2@example.com"],
  "deleted": false,
  "skip": "0",
  "limit": "25",
  "projection": "all"
}
```

**Response 200**: `{ "users": [UserSchema], "count": 2 }`

---

## Permissions Object

All boolean fields with defaults:

```json
{
  "campaignsEnabled": true,
  "campaignsReadOnly": false,
  "contactsEnabled": true,
  "workflowsEnabled": true,
  "workflowsReadOnly": false,
  "triggersEnabled": true,
  "funnelsEnabled": true,
  "websitesEnabled": false,
  "opportunitiesEnabled": true,
  "dashboardStatsEnabled": true,
  "bulkRequestsEnabled": true,
  "appointmentsEnabled": true,
  "reviewsEnabled": true,
  "onlineListingsEnabled": true,
  "phoneCallEnabled": true,
  "conversationsEnabled": true,
  "assignedDataOnly": false,
  "adwordsReportingEnabled": false,
  "membershipEnabled": false,
  "facebookAdsReportingEnabled": false,
  "attributionsReportingEnabled": false,
  "settingsEnabled": true,
  "tagsEnabled": true,
  "leadValueEnabled": true,
  "marketingEnabled": true,
  "agentReportingEnabled": true,
  "botService": false,
  "socialPlanner": true,
  "bloggingEnabled": true,
  "invoiceEnabled": true,
  "affiliateManagerEnabled": true,
  "contentAiEnabled": true,
  "refundsEnabled": true,
  "recordPaymentEnabled": true,
  "cancelSubscriptionEnabled": true,
  "paymentsEnabled": true,
  "communitiesEnabled": true,
  "exportPaymentsEnabled": true
}
```

---

## Available Scopes (Complete List)

This is the full list of scopes that can be assigned to users. Relevant ones for Jimmy are highlighted:

**Core (used by Jimmy)**:
- `contacts.write`, `contacts/bulkActions.write`
- `conversations.write`, `conversations.readonly`, `conversations/message.readonly`, `conversations/message.write`
- `opportunities.write`, `opportunities/leadValue.readonly`, `opportunities/bulkActions.write`
- `calendars.readonly`, `calendars/events.write`, `calendars/groups.write`, `calendars.write`
- `locations/tags.write`, `locations/tags.readonly`

**Other available scopes**:
campaigns.readonly, campaigns.write, workflows.readonly, workflows.write, triggers.write, funnels.write, forms.write, surveys.write, medias.write, medias.readonly, reporting/phone.readonly, reporting/adwords.readonly, reporting/facebookAds.readonly, reporting/attributions.readonly, reporting/reports.readonly, reporting/agent.readonly, reporting/reports.write, payments.write, payments/refunds.write, payments/records.write, payments/exports.write, payments/subscriptionsCancel.write, invoices.write, invoices.readonly, reputation/review.write, reputation/listing.write, contentAI.write, dashboard/stats.readonly, marketing.write, settings.write, socialplanner/post.write, socialplanner/account.readonly, socialplanner/account.write, blogs.write, membership.write, communities.write, users/team-management.write, users/team-management.readonly, voice-ai-agents.write, text-ai-agents.write, and many more.
