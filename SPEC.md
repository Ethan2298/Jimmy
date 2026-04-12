# RPM — Jimmy, AI Sales Co-Worker

## What This Is

RPM is a standalone web app — a chat interface where car dealers work with Jimmy, their AI sales co-worker. Jimmy operates on GoHighLevel CRM. GHL is the system of record — contacts, conversations, pipelines, calendars, everything. Jimmy reads and writes GHL through server-side tool calls.

The dealer logs in, chats with Jimmy in a ChatGPT-style interface. Jimmy pulls up leads, reads conversation history, drafts responses, reviews pipeline stages, books appointments — all through GHL's API.

---

## Architecture

```
Dealer (browser) <-> Next.js App <-> Claude API (Jimmy) <-> GHL API
                         |
                     Supabase
                  (auth, chat history)
```

### Tech Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router) |
| AI/Streaming | Vercel AI SDK + @ai-sdk/anthropic |
| Styling | Tailwind CSS v4 |
| Components | shadcn/ui |
| Database | Supabase (Postgres) — chat sessions + messages |
| Auth | Supabase Auth |
| Deployment | Vercel |
| CRM | GHL API (server-side tool calls) |

### GHL MCP Connection

Endpoint: `https://services.leadconnectorhq.com/mcp/`
Transport: HTTP Streamable
Auth: PIT bearer token + locationId header
36 tools available (contacts, conversations, opportunities, calendars, payments, social, blogs, emails, locations)

```json
{
  "mcpServers": {
    "ghl": {
      "url": "https://services.leadconnectorhq.com/mcp/",
      "headers": {
        "Authorization": "Bearer <PIT_TOKEN>",
        "locationId": "1QB8GTp5uOImt305H61U"
      }
    }
  }
}
```

### Jimmy Personality & Sales Methodology

Loaded via CLAUDE.md or a dedicated skill. Andrej's sales philosophy — the voice, buyer adaptation, conversation flow, objection handling, follow-up rules. This is prompt, not code.

### GHL as the Database

| Data | Where It Lives |
|---|---|
| Inventory | GHL Products / Custom Objects |
| Leads | GHL Contacts |
| Conversations | GHL Conversations |
| Appointments | GHL Calendar Events |
| Deadlines / Commitments | GHL Tasks on Contacts |
| Conversation Summaries | GHL Contact Notes |
| Buyer Type | GHL Contact Custom Field |
| Deal Phase | GHL Pipeline Stage |
| Automated Follow-Ups | GHL Workflows |

---

## Capabilities

### Read (current PIT scopes)

| Capability | GHL MCP Tool |
|---|---|
| Look up a contact | `contacts_get-contacts`, `contacts_get-contact` |
| Read conversation thread | `conversations_get-messages` |
| Search/filter conversations | `conversations_search-conversation` |
| View pipelines and opportunities | `opportunities_get-pipelines`, `opportunities_search-opportunity` |
| Check calendar availability | `calendars_get-calendar-events` |
| Read appointment notes | `calendars_get-appointment-notes` |
| View contact tasks | `contacts_get-all-tasks` |

### Write (scopes not yet enabled)

| Capability | GHL MCP Tool | Scope Required |
|---|---|---|
| Create/update contacts | `contacts_create-contact`, `contacts_update-contact` | `contacts.write` |
| Tag contacts | `contacts_add-tags` | `contacts.write` |
| Send SMS/email as dealership | `conversations_send-a-new-message` | `conversations/message.write` |
| Move deals through pipeline | `opportunities_update-opportunity` | `opportunities.write` |
| Book appointments | (calendar tools) | `calendars.write`, `calendars/events.write` |
| Read calendar availability | (calendar tools) | `calendars.readonly`, `calendars/events.readonly` |

Read-only scopes = research mode. Write scopes = co-worker.

---

## Dealer Workflows

### Working a Lead

Dealer: "pull up the conversation with Mike, the guy asking about the Syclone"

Jimmy searches contacts, pulls the thread, reads pipeline stage, summarizes where the deal stands — last messages, buyer signals, current phase.

Dealer: "draft a follow-up, he went quiet after I sent photos"

Jimmy references the history, applies the 40-minute follow-up strategy (qualifying question, reciprocity ask, or value-add with ask), drafts a message. Dealer reviews, approves. Jimmy sends via GHL.

### Pipeline Review

Dealer: "what's sitting in the Car Sales pipeline"

Jimmy pulls all opportunities, groups by stage, flags stale deals, suggests next moves based on stage and conversation history.

### New Inbound Lead

Dealer: "new text from 305-555-1234, handle it"

Jimmy checks if the contact exists. If returning — pulls history, summarizes prior context. Drafts a response following the conversation flow (hook → qualify → close → wrap). Dealer approves or edits, Jimmy sends.

### Booking an Appointment

Dealer: "this guy wants to come see the GT500 Saturday"

Jimmy checks calendar availability, suggests open slots, books it in GHL, sends confirmation to the customer, adds a note to the contact.

---

## Sales Intelligence

### Buyer Type Tracking

Custom field on GHL Contact — emotional, analytical, or mixed. Jimmy reads it on every interaction, updates it when he detects signals. Persists across conversations so Jimmy never re-learns what he already knows.

### Conversation Phase

Pipeline stage position in GHL. The Car Sales pipeline maps to the sales flow: New Inquiry (hook) → Follow Up (qualify) → Qualified Lead → Appointment Set (close) → Sold (wrap). Jimmy reads pipeline position to know where a deal stands.

### Conversation Summaries

Jimmy writes a summary as a Note on the GHL Contact after significant interactions. Continuity across conversations — next time someone texts, Jimmy knows the full history without re-reading every message.

### Follow-Ups

Two modes:
1. **GHL Workflows** — automated follow-up sequences triggered by conversation inactivity. Native GHL capability, no code.
2. **Jimmy-assisted** — dealer asks Jimmy to review stale conversations, Jimmy identifies who needs follow-up and drafts personalized messages. Human-in-the-loop.

### Deadline Tracking

GHL Tasks on Contacts. Jimmy creates a task when a commitment is made ("holding the Camaro till Friday for Mike"). GHL's native task system handles reminders and visibility.

---

## Test Dealer — Mikalyzed Auto Boutique

- **Location ID:** `1QB8GTp5uOImt305H61U`
- **Contacts:** 8,273
- **Conversations:** 8,242
- **Pipelines:** Car Sales, Sold Car Leads, The Reserve, Vehicle Acquisition
- **Phone numbers:** +13056147396 (customer-facing), +17866103716 (internal)
- **Owner:** Andrej Perez (`ed97nQUXNdbmes5uJEaS`)

---

## Constraints

1. **GHL is the single source of truth.** No shadow databases. No local state.
2. **Jimmy's voice doesn't change.** The personality and sales methodology are locked.
3. **Human-in-the-loop by default.** Jimmy drafts, dealer approves. Write operations get dealer confirmation until trust is established.
4. **No infrastructure.** No servers, no cron jobs, no databases. Claude Code + MCP + GHL.
5. **PIT token security.** Token in environment variables or MCP config. Never committed to the repo.

---

## What Needs to Happen

1. **Enable write scopes on the PIT** — contacts.write, conversations/message.write, opportunities.write, calendars.readonly, calendars.write, calendars/events.readonly, calendars/events.write
2. **Wire up GHL MCP in `.mcp.json`**
3. **Create Jimmy skill or CLAUDE.md section** — port the personality into Claude Code format
4. **Set up custom fields in GHL** — buyer_type on contacts
5. **Test read loop** — pull a real contact, read their conversation, summarize
6. **Test write loop** — send a message through Jimmy, verify it lands in GHL
