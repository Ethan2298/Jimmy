import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getGHLClient, GHLAPIError } from "./client";

// ── Response helpers ────────────────────────────────────────────────────────

function success(data: Record<string, unknown>): string {
  return JSON.stringify({ success: true, data });
}

function error(
  e: GHLAPIError,
  requiredScope?: string,
): string {
  const payload: Record<string, unknown> = {
    status_code: e.statusCode,
    message: e.message,
  };
  if (requiredScope && (e.statusCode === 401 || e.statusCode === 403)) {
    payload.required_scope = requiredScope;
  }
  return JSON.stringify({ success: false, error: payload });
}

function validationError(
  message: string,
  field?: string,
  allowedValues?: string[],
): string {
  const payload: Record<string, unknown> = { status_code: 400, message };
  if (field) payload.field = field;
  if (allowedValues) payload.allowed_values = allowedValues;
  return JSON.stringify({ success: false, error: payload });
}

// ── Validation helpers ──────────────────────────────────────────────────────

const VALID_OPPORTUNITY_STATUSES = new Set([
  "open",
  "won",
  "lost",
  "abandoned",
  "all",
]);
const VALID_WRITE_OPPORTUNITY_STATUSES = new Set([
  "open",
  "won",
  "lost",
  "abandoned",
]);
const VALID_MESSAGE_TYPES = new Set(["SMS", "Email"]);

function normalizeLimit(limit: number): number {
  if (limit < 1) throw new Error("limit must be between 1 and 100");
  return Math.min(limit, 100);
}

function validateOpportunityStatus(
  status: string,
  allowAll: boolean,
): void {
  if (!status) return;
  const valid = allowAll
    ? VALID_OPPORTUNITY_STATUSES
    : VALID_WRITE_OPPORTUNITY_STATUSES;
  if (!valid.has(status)) {
    throw new Error(
      `status must be one of: ${[...valid].sort().join(", ")}`,
    );
  }
}

function validateMessageType(messageType: string): void {
  if (!VALID_MESSAGE_TYPES.has(messageType)) {
    throw new Error(
      `message_type must be one of: ${[...VALID_MESSAGE_TYPES].sort().join(", ")}`,
    );
  }
}

function parseISO8601(value: string, field: string): string {
  const d = new Date(value);
  if (isNaN(d.getTime())) {
    throw new Error(`${field} must be a valid ISO 8601 datetime string`);
  }
  return d.toISOString();
}

function serializeOpportunitySummary(
  opp: Record<string, unknown>,
): Record<string, unknown> {
  const contact = opp.contact as Record<string, unknown> | undefined;
  const createdAt = opp.dateAdded || opp.createdAt;
  return {
    id: opp.id,
    name: opp.name,
    status: opp.status,
    pipelineId: opp.pipelineId,
    pipelineStageId: opp.pipelineStageId,
    monetaryValue: opp.monetaryValue,
    contactId: contact?.id ?? opp.contactId,
    contactName: contact?.name ?? null,
    dateAdded: createdAt,
  };
}

// ── Register all tools ──────────────────────────────────────────────────────

export function registerTools(server: McpServer): void {
  const client = () => getGHLClient();

  // ── Contacts ────────────────────────────────────────────────────────────

  server.tool(
    "search_contacts",
    "Search dealership contacts by name, phone, email, or tag.",
    {
      query: z.string().default("").describe("Free-text search across contact name, phone, or email."),
      tag: z.string().default("").describe("Optional tag keyword to narrow results."),
      limit: z.number().default(20).describe("Maximum contacts to return (1-100)."),
    },
    async ({ query, tag, limit }) => {
      try {
        const params: Record<string, string> = {
          limit: String(normalizeLimit(limit)),
        };
        if (query) params.query = query;
        if (tag) params.query = tag;

        const data = await client().get("/contacts/", params);
        const contacts = ((data.contacts as Record<string, unknown>[]) || []).map((c) => ({
          id: c.id,
          name: c.contactName,
          firstName: c.firstName,
          lastName: c.lastName,
          phone: c.phone,
          email: c.email,
          tags: c.tags || [],
          source: c.source,
          dateAdded: c.dateAdded,
        }));
        const total = ((data.meta as Record<string, unknown>)?.total as number) || 0;
        return { content: [{ type: "text" as const, text: success({ contacts, total, has_more: total > contacts.length }) }] };
      } catch (e) {
        if (e instanceof GHLAPIError) return { content: [{ type: "text" as const, text: error(e) }] };
        return { content: [{ type: "text" as const, text: validationError(String(e), "limit") }] };
      }
    },
  );

  server.tool(
    "get_contact",
    "Get full details for a specific contact by their GHL contact ID.",
    {
      contact_id: z.string().describe("The GHL contact ID."),
    },
    async ({ contact_id }) => {
      try {
        const data = await client().get(`/contacts/${contact_id}`);
        const c = (data.contact as Record<string, unknown>) || data;
        return {
          content: [{
            type: "text" as const,
            text: success({
              contact: {
                id: c.id, name: c.contactName, firstName: c.firstName, lastName: c.lastName,
                phone: c.phone, email: c.email, tags: c.tags || [], source: c.source,
                city: c.city, state: c.state, country: c.country, dateAdded: c.dateAdded,
                customFields: c.customFields || [], attributions: c.attributions || [],
                dnd: c.dnd, assignedTo: c.assignedTo,
              },
            }),
          }],
        };
      } catch (e) {
        if (e instanceof GHLAPIError) return { content: [{ type: "text" as const, text: error(e) }] };
        throw e;
      }
    },
  );

  // ── Conversations ───────────────────────────────────────────────────────

  server.tool(
    "search_conversations",
    "Search conversations, optionally filtered by contact ID.",
    {
      contact_id: z.string().default("").describe("Optional GHL contact ID."),
      limit: z.number().default(20).describe("Maximum conversations to return (1-100)."),
    },
    async ({ contact_id, limit }) => {
      try {
        const params: Record<string, string> = { limit: String(normalizeLimit(limit)) };
        if (contact_id) params.contactId = contact_id;

        const data = await client().get("/conversations/search", params);
        const conversations = ((data.conversations as Record<string, unknown>[]) || []).map((c) => ({
          id: c.id, contactId: c.contactId, fullName: c.fullName,
          lastMessageBody: ((c.lastMessageBody as string) || "").slice(0, 200),
          lastMessageType: c.lastMessageType, lastMessageDirection: c.lastMessageDirection,
          lastMessageDate: c.lastMessageDate, unreadCount: c.unreadCount || 0,
          type: c.type, phone: c.phone, email: c.email, tags: c.tags || [],
        }));
        const total = (data.total as number) || 0;
        return { content: [{ type: "text" as const, text: success({ conversations, total, has_more: total > conversations.length }) }] };
      } catch (e) {
        if (e instanceof GHLAPIError) return { content: [{ type: "text" as const, text: error(e) }] };
        return { content: [{ type: "text" as const, text: validationError(String(e), "limit") }] };
      }
    },
  );

  server.tool(
    "get_conversation_messages",
    "Get the full message thread for a conversation in chronological order.",
    {
      conversation_id: z.string().describe("The GHL conversation ID."),
    },
    async ({ conversation_id }) => {
      try {
        const data = await client().get(`/conversations/${conversation_id}/messages`);
        const rawMessages = ((data.messages as Record<string, unknown>)?.messages as Record<string, unknown>[]) || [];
        const messages = [...rawMessages].reverse().map((m) => ({
          direction: m.direction || "unknown",
          body: ((m.body as string) || "").slice(0, 500),
          messageType: m.messageType, dateAdded: m.dateAdded, source: m.source,
          from: m.from, to: m.to, status: m.status, attachments: m.attachments || [],
        }));
        const hasMore = ((data.messages as Record<string, unknown>)?.nextPage as boolean) || false;
        return { content: [{ type: "text" as const, text: success({ messages, count: messages.length, has_more: hasMore }) }] };
      } catch (e) {
        if (e instanceof GHLAPIError) return { content: [{ type: "text" as const, text: error(e) }] };
        throw e;
      }
    },
  );

  server.tool(
    "update_conversation",
    "Update a conversation's metadata — star it, or mark read/unread.",
    {
      conversation_id: z.string().describe("The GHL conversation ID."),
      starred: z.boolean().optional().describe("Set True to star, False to unstar."),
      unread_count: z.number().optional().describe("Set to 0 to mark as read."),
    },
    async ({ conversation_id, starred, unread_count }) => {
      try {
        const body: Record<string, unknown> = {};
        if (starred !== undefined) body.starred = starred;
        if (unread_count !== undefined) body.unreadCount = unread_count;
        if (Object.keys(body).length === 0) {
          return { content: [{ type: "text" as const, text: validationError("At least one field must be provided: starred or unread_count.", "conversation_id") }] };
        }
        const data = await client().put(`/conversations/${conversation_id}`, body);
        return { content: [{ type: "text" as const, text: success({ conversation: data }) }] };
      } catch (e) {
        if (e instanceof GHLAPIError) return { content: [{ type: "text" as const, text: error(e, "conversations.write") }] };
        throw e;
      }
    },
  );

  // ── Pipelines & Opportunities ───────────────────────────────────────────

  server.tool(
    "get_pipelines",
    "Get all sales pipelines and their stages. Use this to look up valid pipeline and stage IDs.",
    {},
    async () => {
      try {
        const data = await client().get("/opportunities/pipelines");
        const pipelines = ((data.pipelines as Record<string, unknown>[]) || []).map((p) => ({
          id: p.id,
          name: p.name,
          stages: ((p.stages as Record<string, unknown>[]) || []).map((s) => ({
            id: s.id, name: s.name, position: s.position,
          })),
        }));
        return { content: [{ type: "text" as const, text: success({ pipelines }) }] };
      } catch (e) {
        if (e instanceof GHLAPIError) return { content: [{ type: "text" as const, text: error(e) }] };
        throw e;
      }
    },
  );

  server.tool(
    "search_opportunities",
    "Search deals/opportunities.",
    {
      pipeline_id: z.string().default("").describe("Optional pipeline ID from get_pipelines."),
      stage_id: z.string().default("").describe("Optional stage ID from get_pipelines."),
      status: z.string().default("").describe("Optional status: open, won, lost, abandoned, or all."),
      contact_id: z.string().default("").describe("Optional GHL contact ID."),
      limit: z.number().default(20).describe("Maximum opportunities to return (1-100)."),
    },
    async ({ pipeline_id, stage_id, status, contact_id, limit }) => {
      try {
        validateOpportunityStatus(status, true);
        const params: Record<string, string> = { limit: String(normalizeLimit(limit)) };
        if (pipeline_id) params.pipelineId = pipeline_id;
        if (stage_id) params.pipelineStageId = stage_id;
        if (status) params.status = status;
        if (contact_id) params.contactId = contact_id;

        const data = await client().get("/opportunities/search", params);
        const opportunities = ((data.opportunities as Record<string, unknown>[]) || []).map(serializeOpportunitySummary);
        const total = ((data.meta as Record<string, unknown>)?.total as number) || opportunities.length;
        return { content: [{ type: "text" as const, text: success({ opportunities, total, has_more: total > opportunities.length }) }] };
      } catch (e) {
        if (e instanceof GHLAPIError) return { content: [{ type: "text" as const, text: error(e) }] };
        const msg = String(e);
        const field = msg.includes("status") ? "status" : "limit";
        return { content: [{ type: "text" as const, text: validationError(msg, field, field === "status" ? [...VALID_OPPORTUNITY_STATUSES].sort() : undefined) }] };
      }
    },
  );

  server.tool(
    "get_opportunity",
    "Get full details for a specific opportunity/deal by its ID.",
    {
      opportunity_id: z.string().describe("The GHL opportunity ID."),
    },
    async ({ opportunity_id }) => {
      try {
        const data = await client().get(`/opportunities/${opportunity_id}`);
        const opportunity = data.opportunity || data;
        return { content: [{ type: "text" as const, text: success({ opportunity }) }] };
      } catch (e) {
        if (e instanceof GHLAPIError) return { content: [{ type: "text" as const, text: error(e) }] };
        throw e;
      }
    },
  );

  server.tool(
    "create_opportunity",
    "Create a new opportunity/deal for a contact.",
    {
      contact_id: z.string().describe("The GHL contact ID the deal belongs to."),
      pipeline_id: z.string().describe("The destination pipeline ID from get_pipelines."),
      stage_id: z.string().describe("The destination stage ID from get_pipelines."),
      title: z.string().describe("Human-readable deal name."),
      monetary_value: z.number().optional().describe("Optional deal value."),
      status: z.string().default("open").describe("Initial status: open, won, lost, or abandoned."),
    },
    async ({ contact_id, pipeline_id, stage_id, title, monetary_value, status }) => {
      try {
        if (!title.trim()) return { content: [{ type: "text" as const, text: validationError("title cannot be empty", "title") }] };
        validateOpportunityStatus(status, false);

        const body: Record<string, unknown> = {
          locationId: client().getLocationId(),
          contactId: contact_id,
          pipelineId: pipeline_id,
          pipelineStageId: stage_id,
          name: title,
          status,
        };
        if (monetary_value !== undefined) body.monetaryValue = monetary_value;

        const data = await client().post("/opportunities", body);
        return { content: [{ type: "text" as const, text: success({ opportunity: data.opportunity || data }) }] };
      } catch (e) {
        if (e instanceof GHLAPIError) return { content: [{ type: "text" as const, text: error(e, "opportunities.write") }] };
        return { content: [{ type: "text" as const, text: validationError(String(e), "status", [...VALID_WRITE_OPPORTUNITY_STATUSES].sort()) }] };
      }
    },
  );

  server.tool(
    "update_opportunity",
    "Update a deal by changing its stage, status, value, or title.",
    {
      opportunity_id: z.string().describe("The GHL opportunity ID."),
      stage_id: z.string().default("").describe("Optional stage ID."),
      status: z.string().default("").describe("Optional status: open, won, lost, or abandoned."),
      monetary_value: z.number().optional().describe("Optional updated deal value."),
      title: z.string().default("").describe("Optional new deal title."),
    },
    async ({ opportunity_id, stage_id, status, monetary_value, title }) => {
      try {
        validateOpportunityStatus(status, false);
        if (!stage_id && !status && monetary_value === undefined && !title) {
          return { content: [{ type: "text" as const, text: validationError("At least one update field must be provided.", "opportunity_id") }] };
        }
        const body: Record<string, unknown> = {};
        if (stage_id) body.pipelineStageId = stage_id;
        if (status) body.status = status;
        if (monetary_value !== undefined) body.monetaryValue = monetary_value;
        if (title) body.name = title;

        const data = await client().put(`/opportunities/${opportunity_id}`, body);
        return { content: [{ type: "text" as const, text: success({ opportunity: data }) }] };
      } catch (e) {
        if (e instanceof GHLAPIError) return { content: [{ type: "text" as const, text: error(e, "opportunities.write") }] };
        return { content: [{ type: "text" as const, text: validationError(String(e), "status", [...VALID_WRITE_OPPORTUNITY_STATUSES].sort()) }] };
      }
    },
  );

  server.tool(
    "delete_opportunity",
    "Permanently delete an opportunity/deal.",
    {
      opportunity_id: z.string().describe("The GHL opportunity ID to delete."),
    },
    async ({ opportunity_id }) => {
      try {
        await client().delete(`/opportunities/${opportunity_id}`);
        return { content: [{ type: "text" as const, text: success({ deleted: true, opportunityId: opportunity_id }) }] };
      } catch (e) {
        if (e instanceof GHLAPIError) return { content: [{ type: "text" as const, text: error(e, "opportunities.write") }] };
        throw e;
      }
    },
  );

  // ── Contacts write ──────────────────────────────────────────────────────

  server.tool(
    "create_or_update_contact",
    "Create a new contact or update an existing one matched by phone or email.",
    {
      first_name: z.string().default("").describe("Optional contact first name."),
      last_name: z.string().default("").describe("Optional contact last name."),
      phone: z.string().default("").describe("Optional phone number."),
      email: z.string().default("").describe("Optional email address."),
      tags: z.array(z.string()).optional().describe("Optional list of tags."),
      source: z.string().default("").describe("Optional lead source string."),
    },
    async ({ first_name, last_name, phone, email, tags, source }) => {
      try {
        if (!first_name && !last_name && !phone && !email && !tags?.length && !source) {
          return { content: [{ type: "text" as const, text: validationError("At least one contact field must be provided.", "phone") }] };
        }
        const body: Record<string, unknown> = { locationId: client().getLocationId() };
        if (first_name) body.firstName = first_name;
        if (last_name) body.lastName = last_name;
        if (phone) body.phone = phone;
        if (email) body.email = email;
        if (tags?.length) body.tags = tags;
        if (source) body.source = source;

        const data = await client().post("/contacts/upsert", body);
        return { content: [{ type: "text" as const, text: success({ contact: data.contact || data }) }] };
      } catch (e) {
        if (e instanceof GHLAPIError) return { content: [{ type: "text" as const, text: error(e, "contacts.write") }] };
        throw e;
      }
    },
  );

  server.tool(
    "update_contact",
    "Update specific fields on an existing contact.",
    {
      contact_id: z.string().describe("The GHL contact ID."),
      first_name: z.string().default("").describe("Optional new first name."),
      last_name: z.string().default("").describe("Optional new last name."),
      phone: z.string().default("").describe("Optional new phone number."),
      email: z.string().default("").describe("Optional new email address."),
      city: z.string().default("").describe("Optional city."),
      state: z.string().default("").describe("Optional state."),
      address: z.string().default("").describe("Optional street address."),
      postal_code: z.string().default("").describe("Optional zip/postal code."),
      assigned_to: z.string().default("").describe("Optional user ID to assign the contact to."),
      dnd: z.boolean().optional().describe("Optional Do Not Disturb flag."),
      custom_fields: z.array(z.object({ id: z.string(), field_value: z.string() })).optional().describe("Optional custom field updates."),
    },
    async ({ contact_id, first_name, last_name, phone, email, city, state, address, postal_code, assigned_to, dnd, custom_fields }) => {
      try {
        const body: Record<string, unknown> = {};
        if (first_name) body.firstName = first_name;
        if (last_name) body.lastName = last_name;
        if (phone) body.phone = phone;
        if (email) body.email = email;
        if (city) body.city = city;
        if (state) body.state = state;
        if (address) body.address1 = address;
        if (postal_code) body.postalCode = postal_code;
        if (assigned_to) body.assignedTo = assigned_to;
        if (dnd !== undefined) body.dnd = dnd;
        if (custom_fields?.length) body.customFields = custom_fields;

        if (Object.keys(body).length === 0) {
          return { content: [{ type: "text" as const, text: validationError("At least one field must be provided to update.", "contact_id") }] };
        }

        const data = await client().put(`/contacts/${contact_id}`, body);
        return { content: [{ type: "text" as const, text: success({ contact: data.contact || data }) }] };
      } catch (e) {
        if (e instanceof GHLAPIError) return { content: [{ type: "text" as const, text: error(e, "contacts.write") }] };
        throw e;
      }
    },
  );

  server.tool(
    "delete_contact",
    "Permanently delete a contact from the CRM.",
    {
      contact_id: z.string().describe("The GHL contact ID to delete."),
    },
    async ({ contact_id }) => {
      try {
        await client().delete(`/contacts/${contact_id}`);
        return { content: [{ type: "text" as const, text: success({ deleted: true, contactId: contact_id }) }] };
      } catch (e) {
        if (e instanceof GHLAPIError) return { content: [{ type: "text" as const, text: error(e, "contacts.write") }] };
        throw e;
      }
    },
  );

  server.tool(
    "add_contact_tags",
    "Add one or more tags to a contact.",
    {
      contact_id: z.string().describe("The GHL contact ID."),
      tags: z.array(z.string()).describe("The tags to add."),
    },
    async ({ contact_id, tags }) => {
      try {
        const data = await client().post(`/contacts/${contact_id}/tags`, { tags });
        return { content: [{ type: "text" as const, text: success({ tags: data.tags || tags }) }] };
      } catch (e) {
        if (e instanceof GHLAPIError) return { content: [{ type: "text" as const, text: error(e, "contacts.write") }] };
        throw e;
      }
    },
  );

  server.tool(
    "remove_contact_tags",
    "Remove one or more tags from a contact.",
    {
      contact_id: z.string().describe("The GHL contact ID."),
      tags: z.array(z.string()).describe("The tags to remove."),
    },
    async ({ contact_id, tags }) => {
      try {
        const data = await client().delete(`/contacts/${contact_id}/tags`, { tags });
        return { content: [{ type: "text" as const, text: success({ tags: data.tags || tags }) }] };
      } catch (e) {
        if (e instanceof GHLAPIError) return { content: [{ type: "text" as const, text: error(e, "contacts.write") }] };
        throw e;
      }
    },
  );

  // ── Contact notes ───────────────────────────────────────────────────────

  server.tool(
    "get_contact_notes",
    "Get all notes attached to a contact.",
    {
      contact_id: z.string().describe("The GHL contact ID."),
    },
    async ({ contact_id }) => {
      try {
        const data = await client().get(`/contacts/${contact_id}/notes`);
        const notes = (data.notes as unknown[]) || [];
        return { content: [{ type: "text" as const, text: success({ notes, count: notes.length }) }] };
      } catch (e) {
        if (e instanceof GHLAPIError) return { content: [{ type: "text" as const, text: error(e) }] };
        throw e;
      }
    },
  );

  server.tool(
    "add_contact_note",
    "Add a note to a contact record.",
    {
      contact_id: z.string().describe("The GHL contact ID."),
      body: z.string().describe("The note text."),
    },
    async ({ contact_id, body: noteBody }) => {
      try {
        if (!noteBody.trim()) return { content: [{ type: "text" as const, text: validationError("body cannot be empty", "body") }] };
        const data = await client().post(`/contacts/${contact_id}/notes`, { body: noteBody });
        return { content: [{ type: "text" as const, text: success({ note: data }) }] };
      } catch (e) {
        if (e instanceof GHLAPIError) return { content: [{ type: "text" as const, text: error(e, "contacts.write") }] };
        throw e;
      }
    },
  );

  // ── Contact tasks ───────────────────────────────────────────────────────

  server.tool(
    "get_contact_tasks",
    "Get all tasks (follow-ups, to-dos) for a contact.",
    {
      contact_id: z.string().describe("The GHL contact ID."),
    },
    async ({ contact_id }) => {
      try {
        const data = await client().get(`/contacts/${contact_id}/tasks`);
        const tasks = (data.tasks as unknown[]) || [];
        return { content: [{ type: "text" as const, text: success({ tasks, count: tasks.length }) }] };
      } catch (e) {
        if (e instanceof GHLAPIError) return { content: [{ type: "text" as const, text: error(e) }] };
        throw e;
      }
    },
  );

  server.tool(
    "create_contact_task",
    "Create a follow-up task for a contact.",
    {
      contact_id: z.string().describe("The GHL contact ID."),
      title: z.string().describe("Task title."),
      due_date: z.string().describe("Due date in ISO 8601 format with timezone offset."),
      description: z.string().default("").describe("Optional task description."),
      assigned_to: z.string().default("").describe("Optional user ID to assign the task to."),
    },
    async ({ contact_id, title, due_date, description, assigned_to }) => {
      try {
        if (!title.trim()) return { content: [{ type: "text" as const, text: validationError("title cannot be empty", "title") }] };
        const normalizedDue = parseISO8601(due_date, "due_date");
        const body: Record<string, unknown> = { title, dueDate: normalizedDue };
        if (description) body.description = description;
        if (assigned_to) body.assignedTo = assigned_to;

        const data = await client().post(`/contacts/${contact_id}/tasks`, body);
        return { content: [{ type: "text" as const, text: success({ task: data }) }] };
      } catch (e) {
        if (e instanceof GHLAPIError) return { content: [{ type: "text" as const, text: error(e, "contacts.write") }] };
        return { content: [{ type: "text" as const, text: validationError(String(e), "due_date") }] };
      }
    },
  );

  // ── Messaging ───────────────────────────────────────────────────────────

  server.tool(
    "send_message",
    "Send an SMS or email through an existing conversation.",
    {
      conversation_id: z.string().describe("The conversation ID from search_conversations."),
      message_type: z.string().describe("Allowed values: SMS or Email."),
      body: z.string().describe("Message text."),
      subject: z.string().default("").describe("Email subject line. Required when message_type is Email."),
    },
    async ({ conversation_id, message_type, body: msgBody, subject }) => {
      try {
        validateMessageType(message_type);
        if (!msgBody.trim()) return { content: [{ type: "text" as const, text: validationError("body cannot be empty", "body") }] };
        if (message_type === "Email" && !subject.trim()) {
          return { content: [{ type: "text" as const, text: validationError("subject is required when message_type is Email", "subject") }] };
        }

        const payload: Record<string, unknown> = {
          type: message_type,
          message: msgBody,
          conversationId: conversation_id,
        };
        if (message_type === "Email") payload.subject = subject;

        const data = await client().post("/conversations/messages", payload);
        return { content: [{ type: "text" as const, text: success({ messageId: data.messageId, message: data }) }] };
      } catch (e) {
        if (e instanceof GHLAPIError) return { content: [{ type: "text" as const, text: error(e, "conversations/message.write") }] };
        return { content: [{ type: "text" as const, text: validationError(String(e), "message_type", [...VALID_MESSAGE_TYPES].sort()) }] };
      }
    },
  );

  // ── Calendars ───────────────────────────────────────────────────────────

  server.tool(
    "list_calendars",
    "List available calendars for the current location.",
    {},
    async () => {
      try {
        const data = await client().get("/calendars/");
        const calendars = ((data.calendars || data.data) as Record<string, unknown>[] || []).map((c) => ({
          id: c.id, name: c.name, description: c.description,
          isActive: c.isActive, groupId: c.groupId,
        }));
        return { content: [{ type: "text" as const, text: success({ calendars, count: calendars.length }) }] };
      } catch (e) {
        if (e instanceof GHLAPIError) return { content: [{ type: "text" as const, text: error(e, "calendars.readonly") }] };
        throw e;
      }
    },
  );

  server.tool(
    "book_appointment",
    "Book an appointment on a GHL calendar.",
    {
      calendar_id: z.string().describe("The calendar ID from list_calendars."),
      contact_id: z.string().describe("The GHL contact ID attending."),
      start_time: z.string().describe("Start in ISO 8601 format with timezone."),
      end_time: z.string().describe("End in ISO 8601 format with timezone."),
      title: z.string().default("").describe("Optional appointment title."),
      notes: z.string().default("").describe("Optional appointment notes."),
    },
    async ({ calendar_id, contact_id, start_time, end_time, title, notes }) => {
      try {
        const normalizedStart = parseISO8601(start_time, "start_time");
        const normalizedEnd = parseISO8601(end_time, "end_time");
        if (normalizedEnd <= normalizedStart) {
          return { content: [{ type: "text" as const, text: validationError("end_time must be after start_time", "end_time") }] };
        }
        const body: Record<string, unknown> = {
          calendarId: calendar_id, locationId: client().getLocationId(),
          contactId: contact_id, startTime: normalizedStart, endTime: normalizedEnd,
        };
        if (title) body.title = title;
        if (notes) body.notes = notes;

        const data = await client().post("/calendars/events/appointments", body);
        return { content: [{ type: "text" as const, text: success({ appointment: data }) }] };
      } catch (e) {
        if (e instanceof GHLAPIError) return { content: [{ type: "text" as const, text: error(e, "calendars/events.write") }] };
        const msg = String(e);
        const field = msg.includes("end_time") ? "end_time" : "start_time";
        return { content: [{ type: "text" as const, text: validationError(msg, field) }] };
      }
    },
  );

  server.tool(
    "get_calendar_events",
    "Get calendar events/appointments. At least one of calendar_id, user_id, or group_id is required.",
    {
      calendar_id: z.string().default("").describe("Optional calendar ID."),
      start_time: z.string().default("").describe("Optional start of range in ISO 8601."),
      end_time: z.string().default("").describe("Optional end of range in ISO 8601."),
      user_id: z.string().default("").describe("Optional user ID."),
      group_id: z.string().default("").describe("Optional calendar group ID."),
    },
    async ({ calendar_id, start_time, end_time, user_id, group_id }) => {
      try {
        if (!calendar_id && !user_id && !group_id) {
          return { content: [{ type: "text" as const, text: validationError("At least one of calendar_id, user_id, or group_id is required.", "calendar_id") }] };
        }
        const params: Record<string, string> = {};
        if (calendar_id) params.calendarId = calendar_id;
        if (user_id) params.userId = user_id;
        if (group_id) params.groupId = group_id;
        if (start_time) params.startTime = parseISO8601(start_time, "start_time");
        if (end_time) params.endTime = parseISO8601(end_time, "end_time");

        const data = await client().get("/calendars/events", params);
        const events = ((data.events || data.data) as unknown[]) || [];
        return { content: [{ type: "text" as const, text: success({ events, count: events.length }) }] };
      } catch (e) {
        if (e instanceof GHLAPIError) return { content: [{ type: "text" as const, text: error(e, "calendars/events.readonly") }] };
        const msg = String(e);
        return { content: [{ type: "text" as const, text: validationError(msg, msg.includes("end_time") ? "end_time" : "start_time") }] };
      }
    },
  );

  server.tool(
    "get_calendar_free_slots",
    "Get available time slots for a calendar. Use before booking to find open times.",
    {
      calendar_id: z.string().describe("The calendar ID from list_calendars."),
      start_date: z.string().describe("Start date in YYYY-MM-DD format."),
      end_date: z.string().describe("End date in YYYY-MM-DD format."),
      timezone: z.string().default("America/New_York").describe("IANA timezone string."),
    },
    async ({ calendar_id, start_date, end_date, timezone: tz }) => {
      try {
        const params: Record<string, string> = {
          startDate: start_date, endDate: end_date, timezone: tz, calendarId: calendar_id,
        };
        const data = await client().get(`/calendars/${calendar_id}/free-slots`, params);
        const slots = data.slots || data.data || data;
        return { content: [{ type: "text" as const, text: success({ slots }) }] };
      } catch (e) {
        if (e instanceof GHLAPIError) return { content: [{ type: "text" as const, text: error(e, "calendars.readonly") }] };
        throw e;
      }
    },
  );

  server.tool(
    "update_appointment",
    "Reschedule or modify an existing appointment.",
    {
      event_id: z.string().describe("The GHL event/appointment ID."),
      calendar_id: z.string().describe("The calendar ID the appointment belongs to."),
      start_time: z.string().default("").describe("Optional new start time in ISO 8601."),
      end_time: z.string().default("").describe("Optional new end time in ISO 8601."),
      title: z.string().default("").describe("Optional new appointment title."),
      notes: z.string().default("").describe("Optional updated notes."),
      status: z.string().default("").describe("Optional status: confirmed, cancelled, showed, noshow."),
    },
    async ({ event_id, calendar_id, start_time, end_time, title, notes, status }) => {
      try {
        const body: Record<string, unknown> = { calendarId: calendar_id };
        if (start_time) body.startTime = parseISO8601(start_time, "start_time");
        if (end_time) body.endTime = parseISO8601(end_time, "end_time");
        if (title) body.title = title;
        if (notes) body.notes = notes;
        if (status) body.status = status;

        if (Object.keys(body).length <= 1) {
          return { content: [{ type: "text" as const, text: validationError("At least one field must be provided to update.", "event_id") }] };
        }

        const data = await client().put(`/calendars/events/appointments/${event_id}`, body);
        return { content: [{ type: "text" as const, text: success({ appointment: data }) }] };
      } catch (e) {
        if (e instanceof GHLAPIError) return { content: [{ type: "text" as const, text: error(e, "calendars/events.write") }] };
        const msg = String(e);
        return { content: [{ type: "text" as const, text: validationError(msg, msg.includes("end_time") ? "end_time" : "start_time") }] };
      }
    },
  );

  server.tool(
    "delete_appointment",
    "Cancel and delete an appointment.",
    {
      event_id: z.string().describe("The GHL event/appointment ID to delete."),
    },
    async ({ event_id }) => {
      try {
        await client().delete(`/calendars/events/appointments/${event_id}`);
        return { content: [{ type: "text" as const, text: success({ deleted: true, eventId: event_id }) }] };
      } catch (e) {
        if (e instanceof GHLAPIError) return { content: [{ type: "text" as const, text: error(e, "calendars/events.write") }] };
        throw e;
      }
    },
  );

  // ── Location ────────────────────────────────────────────────────────────

  server.tool(
    "get_location",
    "Get the current sub-account (location) details configured for this MCP server.",
    {},
    async () => {
      try {
        const data = await client().get(`/locations/${client().getLocationId()}`);
        return { content: [{ type: "text" as const, text: success({ location: data.location || data }) }] };
      } catch (e) {
        if (e instanceof GHLAPIError) return { content: [{ type: "text" as const, text: error(e) }] };
        throw e;
      }
    },
  );

  server.tool(
    "get_location_custom_fields",
    "Get custom field definitions for the current location.",
    {},
    async () => {
      try {
        const data = await client().get(`/locations/${client().getLocationId()}/customFields`);
        return { content: [{ type: "text" as const, text: success({ customFields: data.customFields || data.fields || data }) }] };
      } catch (e) {
        if (e instanceof GHLAPIError) return { content: [{ type: "text" as const, text: error(e) }] };
        throw e;
      }
    },
  );

  server.tool(
    "get_location_tags",
    "Get all tags configured for the current location.",
    {},
    async () => {
      try {
        const data = await client().get(`/locations/${client().getLocationId()}/tags`);
        return { content: [{ type: "text" as const, text: success({ tags: data.tags || data.locationTags || data }) }] };
      } catch (e) {
        if (e instanceof GHLAPIError) return { content: [{ type: "text" as const, text: error(e) }] };
        throw e;
      }
    },
  );

  // ── Users ───────────────────────────────────────────────────────────────

  server.tool(
    "get_users",
    "Get all team members/users for the current location.",
    {},
    async () => {
      try {
        const data = await client().get("/users/");
        const users = ((data.users as Record<string, unknown>[]) || []).map((u) => ({
          id: u.id, name: u.name, firstName: u.firstName, lastName: u.lastName,
          email: u.email, phone: u.phone, role: u.role || u.type,
        }));
        return { content: [{ type: "text" as const, text: success({ users, count: users.length }) }] };
      } catch (e) {
        if (e instanceof GHLAPIError) return { content: [{ type: "text" as const, text: error(e, "users.readonly") }] };
        throw e;
      }
    },
  );

  server.tool(
    "get_user",
    "Get details for a specific team member.",
    {
      user_id: z.string().describe("The GHL user ID."),
    },
    async ({ user_id }) => {
      try {
        const data = await client().get(`/users/${user_id}`);
        return { content: [{ type: "text" as const, text: success({ user: data }) }] };
      } catch (e) {
        if (e instanceof GHLAPIError) return { content: [{ type: "text" as const, text: error(e, "users.readonly") }] };
        throw e;
      }
    },
  );
}
