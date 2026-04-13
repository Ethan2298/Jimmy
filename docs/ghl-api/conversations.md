# Conversations API

**Base URL**: `https://services.leadconnectorhq.com`
**Version Header**: `2021-04-15`
**Scopes**: `conversations.readonly`, `conversations.write`, `conversations/message.readonly`, `conversations/message.write`

---

## Endpoints Overview

| Method | Path | Operation | Scope | Used? |
|--------|------|-----------|-------|:-----:|
| GET | `/conversations/search` | Search Conversations | conversations.readonly | YES |
| POST | `/conversations/` | Create Conversation | conversations.write | - |
| GET | `/conversations/{conversationId}` | Get Conversation | conversations.readonly | - |
| PUT | `/conversations/{conversationId}` | Update Conversation | conversations.write | YES |
| DELETE | `/conversations/{conversationId}` | Delete Conversation | conversations.write | - |
| GET | `/conversations/{conversationId}/messages` | Get Messages | conversations/message.readonly | YES |
| POST | `/conversations/messages` | Send New Message | conversations/message.write | YES |
| POST | `/conversations/messages/inbound` | Add Inbound Message | conversations/message.write | - |
| POST | `/conversations/messages/outbound` | Add Outbound Call | conversations/message.write | - |
| GET | `/conversations/messages/{id}` | Get Message by ID | conversations/message.readonly | - |
| GET | `/conversations/messages/email/{id}` | Get Email by ID | conversations/message.readonly | - |
| PUT | `/conversations/messages/{messageId}/status` | Update Message Status | conversations/message.write | - |
| DELETE | `/conversations/messages/{messageId}/schedule` | Cancel Scheduled Message | conversations/message.write | - |
| DELETE | `/conversations/messages/email/{emailMessageId}/schedule` | Cancel Scheduled Email | conversations/message.write | - |
| POST | `/conversations/messages/upload` | Upload Attachments | conversations/message.write | - |
| GET | `/conversations/messages/{messageId}/locations/{locationId}/recording` | Get Recording | bearer | - |
| GET | `/conversations/locations/{locationId}/messages/{messageId}/transcription` | Get Transcription | bearer | - |
| GET | `/conversations/locations/{locationId}/messages/{messageId}/transcription/download` | Download Transcription | bearer | - |

---

## GET /conversations/search

Search conversations with filtering and sorting.

**Parameters**:

| Name | In | Type | Required | Default | Description |
|------|----|------|----------|---------|-------------|
| locationId | query | string | YES | - | Location ID |
| contactId | query | string | no | - | Filter by contact |
| assignedTo | query | string | no | - | Comma-separated user IDs |
| followers | query | string | no | - | Comma-separated user IDs |
| query | query | string | no | - | Search string |
| sort | query | string | no | - | `asc` or `desc` |
| limit | query | number | no | 20 | Max results |
| startAfterDate | query | number | no | - | Pagination cursor (timestamp) |
| id | query | string | no | - | Conversation ID |
| lastMessageType | query | string | no | - | See enum below |
| lastMessageAction | query | string | no | - | `automated` or `manual` |
| lastMessageDirection | query | string | no | - | `inbound` or `outbound` |
| status | query | string | no | - | `all`, `read`, `unread`, `starred`, `recents` |
| sortBy | query | string | no | - | `last_manual_message_date`, `last_message_date`, `score_profile` |

**lastMessageType enum**: TYPE_CALL, TYPE_SMS, TYPE_EMAIL, TYPE_SMS_REVIEW_REQUEST, TYPE_WEBCHAT, TYPE_SMS_NO_SHOW_REQUEST, TYPE_CAMPAIGN_SMS, TYPE_CAMPAIGN_CALL, TYPE_CAMPAIGN_EMAIL, TYPE_CAMPAIGN_VOICEMAIL, TYPE_FACEBOOK, TYPE_CAMPAIGN_FACEBOOK, TYPE_CAMPAIGN_MANUAL_CALL, TYPE_CAMPAIGN_MANUAL_SMS, TYPE_GMB, TYPE_CAMPAIGN_GMB, TYPE_REVIEW, TYPE_INSTAGRAM, TYPE_WHATSAPP, TYPE_CUSTOM_SMS, TYPE_CUSTOM_EMAIL, TYPE_CUSTOM_PROVIDER_SMS, TYPE_CUSTOM_PROVIDER_EMAIL, TYPE_IVR_CALL, TYPE_ACTIVITY_CONTACT, TYPE_ACTIVITY_INVOICE, TYPE_ACTIVITY_PAYMENT, TYPE_ACTIVITY_OPPORTUNITY, TYPE_LIVE_CHAT, TYPE_LIVE_CHAT_INFO_MESSAGE, TYPE_ACTIVITY_APPOINTMENT, TYPE_FACEBOOK_COMMENT, TYPE_INSTAGRAM_COMMENT, TYPE_CUSTOM_CALL, TYPE_INTERNAL_COMMENT, TYPE_ACTIVITY_EMPLOYEE_ACTION_LOG

**Response 200**:
```json
{
  "conversations": [{
    "id": "string",
    "contactId": "string",
    "locationId": "string",
    "lastMessageBody": "string",
    "lastMessageType": "enum",
    "type": "TYPE_PHONE|TYPE_EMAIL|TYPE_FB_MESSENGER|TYPE_REVIEW|TYPE_GROUP_SMS",
    "unreadCount": 0,
    "fullName": "string",
    "contactName": "string",
    "email": "string",
    "phone": "string"
  }],
  "total": 100
}
```

---

## POST /conversations/ (Create)

Create a new conversation.

**Request Body** (required: locationId, contactId):
```json
{
  "locationId": "string",
  "contactId": "string"
}
```

**Response 201**:
```json
{
  "success": true,
  "conversation": {
    "id": "string",
    "dateUpdated": "ISO datetime",
    "dateAdded": "ISO datetime",
    "deleted": false,
    "contactId": "string",
    "locationId": "string",
    "lastMessageDate": "ISO datetime",
    "assignedTo": "string"
  }
}
```

---

## GET /conversations/{conversationId}

**Response 200**:
```json
{
  "contactId": "string",
  "locationId": "string",
  "deleted": false,
  "inbox": true,
  "type": 0,
  "unreadCount": 0,
  "id": "string",
  "assignedTo": "string",
  "starred": false
}
```

---

## PUT /conversations/{conversationId} (Update)

**Request Body**:
```json
{
  "locationId": "string",
  "unreadCount": 0,
  "starred": true,
  "feedback": {}
}
```

**Response 200**:
```json
{
  "success": true,
  "conversation": {
    "id": "string",
    "locationId": "string",
    "contactId": "string",
    "assignedTo": "string",
    "userId": "string",
    "lastMessageBody": "string",
    "lastMessageDate": "ISO datetime",
    "lastMessageType": "enum",
    "unreadCount": 0,
    "inbox": true,
    "starred": false,
    "deleted": false
  }
}
```

---

## DELETE /conversations/{conversationId}

**Response 200**: `{ "success": true }`

---

## GET /conversations/{conversationId}/messages

Get message history for a conversation.

**Parameters**:

| Name | In | Type | Required | Default | Description |
|------|----|------|----------|---------|-------------|
| conversationId | path | string | YES | - | Conversation ID |
| lastMessageId | query | string | no | - | Pagination cursor |
| limit | query | number | no | 20 | Max messages |
| type | query | string | no | - | Filter by message type |

**Response 200**:
```json
{
  "messages": {
    "lastMessageId": "string",
    "nextPage": false,
    "messages": [{
      "id": "string",
      "type": 0,
      "messageType": "enum",
      "locationId": "string",
      "contactId": "string",
      "conversationId": "string",
      "dateAdded": "ISO datetime",
      "body": "string",
      "direction": "inbound|outbound",
      "status": "pending|scheduled|sent|delivered|read|undelivered|connected|failed|opened|clicked|opt_out",
      "contentType": "string",
      "attachments": [],
      "meta": {
        "callDuration": "string",
        "callStatus": "pending|completed|answered|busy|no-answer|failed|canceled|voicemail",
        "email": {}
      },
      "source": "workflow|bulk_actions|campaign|api|app",
      "userId": "string",
      "from": "string",
      "to": "string"
    }]
  }
}
```

---

## POST /conversations/messages (Send)

Send a new message (SMS, Email, WhatsApp, etc.).

**Request Body** (required: type, contactId):
```json
{
  "type": "SMS|Email|WhatsApp|IG|FB|Custom|Live_Chat",
  "contactId": "string",
  "message": "message body",
  "subject": "email subject (required for Email)",
  "conversationId": "string",
  "appointmentId": "string",
  "attachments": ["url1"],
  "emailFrom": "string",
  "emailTo": "string",
  "emailCc": ["string"],
  "emailBcc": ["string"],
  "html": "HTML body for email",
  "replyMessageId": "string",
  "templateId": "string",
  "threadId": "string",
  "scheduledTimestamp": 1628008053263,
  "conversationProviderId": "string",
  "emailReplyMode": "reply|reply_all",
  "fromNumber": "string",
  "toNumber": "string"
}
```

**Response 200**:
```json
{
  "conversationId": "string",
  "emailMessageId": "string",
  "messageId": "string",
  "messageIds": ["string"],
  "msg": "string"
}
```

---

## POST /conversations/messages/inbound (Add Inbound)

Record an inbound message from an external system.

**Request Body** (required: type, conversationId, conversationProviderId):
```json
{
  "type": "SMS|Email|WhatsApp|GMB|IG|FB|Custom|WebChat|Live_Chat|Call",
  "message": "string",
  "conversationId": "string",
  "conversationProviderId": "string",
  "html": "string",
  "subject": "string",
  "attachments": [],
  "emailFrom": "string",
  "emailTo": "string",
  "emailCc": [],
  "emailBcc": [],
  "altId": "string",
  "date": "ISO datetime",
  "call": {
    "to": "string",
    "from": "string",
    "status": "pending|completed|answered|busy|no-answer|failed|canceled|voicemail"
  }
}
```

**Response 200**:
```json
{
  "success": true,
  "conversationId": "string",
  "messageId": "string",
  "message": "string",
  "contactId": "string",
  "dateAdded": "ISO datetime"
}
```

---

## GET /conversations/messages/{id} (Get Message)

Get a single message by ID.

**Response 200**: Same as individual message in the messages array above.

---

## GET /conversations/messages/email/{id} (Get Email)

**Response 200**:
```json
{
  "id": "string",
  "threadId": "string",
  "locationId": "string",
  "contactId": "string",
  "conversationId": "string",
  "dateAdded": "ISO datetime",
  "subject": "string",
  "body": "string",
  "direction": "inbound|outbound",
  "status": "pending|scheduled|sent|delivered|read|undelivered|connected|failed|opened",
  "contentType": "string",
  "attachments": [],
  "provider": "Leadconnector Gmail|mailgun|smtp|custom",
  "from": "string",
  "to": ["string"],
  "cc": ["string"],
  "bcc": ["string"],
  "replyToMessageId": "string",
  "source": "workflow|bulk_actions|campaign|api|app"
}
```

---

## PUT /conversations/messages/{messageId}/status

**Request Body**:
```json
{
  "status": "delivered|failed|pending|read",
  "error": { "code": "string", "type": "string", "message": "string" },
  "emailMessageId": "string",
  "recipients": ["string"]
}
```

---

## DELETE /conversations/messages/{messageId}/schedule

Cancel a scheduled message.

**Response 200**: `{ "status": 200, "message": "string" }`

---

## POST /conversations/messages/upload

Upload file attachments (multipart/form-data).

**Request Body**:
```
conversationId: string (required)
locationId: string (required)
attachmentUrls: string[] (required)
```

**Response 200**: `{ "uploadedFiles": {} }`

**Error 413**: File too large. **Error 415**: Unsupported media type.

---

## GET .../recording, GET .../transcription, GET .../transcription/download

Call recording and transcription endpoints. Require locationId and messageId in path. Return audio/wav or text/plain respectively.
