import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getGHLClient, GHLAPIError } from "./client";

// ── Response helpers ────────────────────────────────────────────────────────

type McpResult = { content: [{ type: "text"; text: string }] };

function ok(data: Record<string, unknown>): McpResult {
  return { content: [{ type: "text" as const, text: JSON.stringify({ success: true, data }) }] };
}

function apiError(e: GHLAPIError, requiredScope?: string): McpResult {
  const payload: Record<string, unknown> = { status_code: e.statusCode, message: e.message };
  if (requiredScope && (e.statusCode === 401 || e.statusCode === 403)) {
    payload.required_scope = requiredScope;
  }
  return { content: [{ type: "text" as const, text: JSON.stringify({ success: false, error: payload }) }] };
}

function validationError(message: string, field?: string, allowedValues?: string[]): McpResult {
  const payload: Record<string, unknown> = { status_code: 400, message };
  if (field) payload.field = field;
  if (allowedValues) payload.allowed_values = allowedValues;
  return { content: [{ type: "text" as const, text: JSON.stringify({ success: false, error: payload }) }] };
}

class RequiredFieldError extends Error {
  field: string;
  constructor(message: string, field: string) {
    super(message);
    this.field = field;
  }
}

function requireField(val: string, name: string, action: string): void {
  if (!val) throw new RequiredFieldError(`${name} is required for action "${action}".`, name);
}

// ── Validation helpers ──────────────────────────────────────────────────────

const VALID_OPPORTUNITY_STATUSES = new Set(["open", "won", "lost", "abandoned", "all"]);
const VALID_WRITE_OPPORTUNITY_STATUSES = new Set(["open", "won", "lost", "abandoned"]);
const VALID_MESSAGE_TYPES = new Set(["SMS", "Email"]);

function normalizeLimit(limit: number): number {
  if (limit < 1) throw new Error("limit must be between 1 and 100");
  return Math.min(limit, 100);
}

function validateOpportunityStatus(status: string, allowAll: boolean): void {
  if (!status) return;
  const valid = allowAll ? VALID_OPPORTUNITY_STATUSES : VALID_WRITE_OPPORTUNITY_STATUSES;
  if (!valid.has(status)) {
    throw new Error(`status must be one of: ${[...valid].sort().join(", ")}`);
  }
}

function validateMessageType(messageType: string): void {
  if (!VALID_MESSAGE_TYPES.has(messageType)) {
    throw new Error(`message_type must be one of: ${[...VALID_MESSAGE_TYPES].sort().join(", ")}`);
  }
}

function parseISO8601(value: string, field: string): string {
  const d = new Date(value);
  if (isNaN(d.getTime())) throw new Error(`${field} must be a valid ISO 8601 datetime string`);
  return d.toISOString();
}

function serializeOpportunitySummary(opp: Record<string, unknown>): Record<string, unknown> {
  const contact = opp.contact as Record<string, unknown> | undefined;
  return {
    id: opp.id, name: opp.name, status: opp.status,
    pipelineId: opp.pipelineId, pipelineStageId: opp.pipelineStageId,
    monetaryValue: opp.monetaryValue,
    contactId: contact?.id ?? opp.contactId, contactName: contact?.name ?? null,
    dateAdded: opp.dateAdded || opp.createdAt,
  };
}

function catchError(e: unknown, scope?: string, field?: string, allowed?: string[]): McpResult {
  if (e instanceof GHLAPIError) return apiError(e, scope);
  if (e instanceof RequiredFieldError) return validationError(e.message, e.field);
  return validationError(String(e), field, allowed);
}

// ── Register all tools (11 consolidated from 32) ────────────────────────────

export function registerTools(server: McpServer): void {
  const client = () => getGHLClient();

  // ── 1. contacts ────────────────────────────────────────────────────────

  server.tool(
    "contacts",
    "Manage dealership contacts. Actions: search (by name/phone/email/tag), get (full details by ID), upsert (create or update matched by phone/email), update (modify fields), delete.",
    {
      action: z.enum(["search", "get", "upsert", "update", "delete"]).describe("Operation to perform."),
      contact_id: z.string().default("").describe("GHL contact ID. Required for get, update, delete."),
      query: z.string().default("").describe("search: free-text across name, phone, email."),
      tag: z.string().default("").describe("search: filter by tag keyword."),
      limit: z.number().default(20).describe("search: max results (1-100)."),
      first_name: z.string().default("").describe("upsert/update: first name."),
      last_name: z.string().default("").describe("upsert/update: last name."),
      phone: z.string().default("").describe("upsert/update: phone number."),
      email: z.string().default("").describe("upsert/update: email address."),
      tags: z.array(z.string()).optional().describe("upsert: list of tags."),
      source: z.string().default("").describe("upsert: lead source."),
      city: z.string().default("").describe("update: city."),
      state: z.string().default("").describe("update: state."),
      address: z.string().default("").describe("update: street address."),
      postal_code: z.string().default("").describe("update: zip/postal code."),
      assigned_to: z.string().default("").describe("update: user ID to assign contact to."),
      dnd: z.boolean().optional().describe("update: Do Not Disturb flag."),
      custom_fields: z.array(z.object({ id: z.string(), field_value: z.string() })).optional().describe("update: custom field values."),
    },
    async ({ action, contact_id, query, tag, limit, first_name, last_name, phone, email, tags, source, city, state, address, postal_code, assigned_to, dnd, custom_fields }) => {
      try {
        switch (action) {
          case "search": {
            const params: Record<string, string> = { limit: String(normalizeLimit(limit)) };
            if (query) params.query = query;
            if (tag) params.query = tag;
            const data = await client().get("/contacts/", params);
            const contacts = ((data.contacts as Record<string, unknown>[]) || []).map((c) => ({
              id: c.id, name: c.contactName, firstName: c.firstName, lastName: c.lastName,
              phone: c.phone, email: c.email, tags: c.tags || [], source: c.source, dateAdded: c.dateAdded,
            }));
            const total = ((data.meta as Record<string, unknown>)?.total as number) || 0;
            return ok({ contacts, total, has_more: total > contacts.length });
          }
          case "get": {
            requireField(contact_id, "contact_id", action);
            const data = await client().get(`/contacts/${contact_id}`);
            const c = (data.contact as Record<string, unknown>) || data;
            return ok({
              contact: {
                id: c.id, name: c.contactName, firstName: c.firstName, lastName: c.lastName,
                phone: c.phone, email: c.email, tags: c.tags || [], source: c.source,
                city: c.city, state: c.state, country: c.country, dateAdded: c.dateAdded,
                customFields: c.customFields || [], attributions: c.attributions || [],
                dnd: c.dnd, assignedTo: c.assignedTo,
              },
            });
          }
          case "upsert": {
            if (!first_name && !last_name && !phone && !email && !tags?.length && !source) {
              return validationError("At least one contact field must be provided.", "phone");
            }
            const body: Record<string, unknown> = { locationId: client().getLocationId() };
            if (first_name) body.firstName = first_name;
            if (last_name) body.lastName = last_name;
            if (phone) body.phone = phone;
            if (email) body.email = email;
            if (tags?.length) body.tags = tags;
            if (source) body.source = source;
            const data = await client().post("/contacts/upsert", body);
            return ok({ contact: data.contact || data });
          }
          case "update": {
            requireField(contact_id, "contact_id", action);
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
              return validationError("At least one field must be provided to update.", "contact_id");
            }
            const data = await client().put(`/contacts/${contact_id}`, body);
            return ok({ contact: data.contact || data });
          }
          case "delete": {
            requireField(contact_id, "contact_id", action);
            await client().delete(`/contacts/${contact_id}`);
            return ok({ deleted: true, contactId: contact_id });
          }
        }
      } catch (e) {
        return catchError(e, "contacts.write", "limit");
      }
    },
  );

  // ── 2. contact_tags ────────────────────────────────────────────────────

  server.tool(
    "contact_tags",
    "Add or remove tags on a contact. Actions: add, remove.",
    {
      action: z.enum(["add", "remove"]).describe("add or remove tags."),
      contact_id: z.string().describe("The GHL contact ID."),
      tags: z.array(z.string()).describe("Tags to add or remove."),
    },
    async ({ action, contact_id, tags }) => {
      try {
        if (action === "add") {
          const data = await client().post(`/contacts/${contact_id}/tags`, { tags });
          return ok({ tags: data.tags || tags });
        } else {
          const data = await client().delete(`/contacts/${contact_id}/tags`, { tags });
          return ok({ tags: data.tags || tags });
        }
      } catch (e) {
        return catchError(e, "contacts.write");
      }
    },
  );

  // ── 3. contact_notes ───────────────────────────────────────────────────

  server.tool(
    "contact_notes",
    "List or add notes on a contact. Actions: list, add.",
    {
      action: z.enum(["list", "add"]).describe("list existing notes or add a new one."),
      contact_id: z.string().describe("The GHL contact ID."),
      body: z.string().default("").describe("add: the note text."),
    },
    async ({ action, contact_id, body: noteBody }) => {
      try {
        if (action === "list") {
          const data = await client().get(`/contacts/${contact_id}/notes`);
          const notes = (data.notes as unknown[]) || [];
          return ok({ notes, count: notes.length });
        } else {
          if (!noteBody.trim()) return validationError("body cannot be empty", "body");
          const data = await client().post(`/contacts/${contact_id}/notes`, { body: noteBody });
          return ok({ note: data });
        }
      } catch (e) {
        return catchError(e, "contacts.write");
      }
    },
  );

  // ── 4. contact_tasks ───────────────────────────────────────────────────

  server.tool(
    "contact_tasks",
    "List or create tasks (follow-ups, to-dos) for a contact. Actions: list, create.",
    {
      action: z.enum(["list", "create"]).describe("list existing tasks or create a new one."),
      contact_id: z.string().describe("The GHL contact ID."),
      title: z.string().default("").describe("create: task title."),
      due_date: z.string().default("").describe("create: due date in ISO 8601 format."),
      description: z.string().default("").describe("create: optional task description."),
      assigned_to: z.string().default("").describe("create: optional user ID to assign to."),
    },
    async ({ action, contact_id, title, due_date, description, assigned_to }) => {
      try {
        if (action === "list") {
          const data = await client().get(`/contacts/${contact_id}/tasks`);
          const tasks = (data.tasks as unknown[]) || [];
          return ok({ tasks, count: tasks.length });
        } else {
          requireField(title, "title", action);
          requireField(due_date, "due_date", action);
          if (!title.trim()) return validationError("title cannot be empty", "title");
          const normalizedDue = parseISO8601(due_date, "due_date");
          const body: Record<string, unknown> = { title, dueDate: normalizedDue };
          if (description) body.description = description;
          if (assigned_to) body.assignedTo = assigned_to;
          const data = await client().post(`/contacts/${contact_id}/tasks`, body);
          return ok({ task: data });
        }
      } catch (e) {
        return catchError(e, "contacts.write", "due_date");
      }
    },
  );

  // ── 5. conversations ───────────────────────────────────────────────────

  server.tool(
    "conversations",
    "Manage conversations. Actions: search (find conversations, optionally by contact), get_messages (full message thread), update (star/mark read), send (SMS or Email through a conversation).",
    {
      action: z.enum(["search", "get_messages", "update", "send"]).describe("Operation to perform."),
      conversation_id: z.string().default("").describe("Required for get_messages, update, send."),
      contact_id: z.string().default("").describe("search: optional contact ID filter."),
      limit: z.number().default(20).describe("search: max results (1-100)."),
      starred: z.boolean().optional().describe("update: set True to star, False to unstar."),
      unread_count: z.number().optional().describe("update: set to 0 to mark as read."),
      message_type: z.string().default("").describe("send: SMS or Email."),
      body: z.string().default("").describe("send: message text."),
      subject: z.string().default("").describe("send: email subject (required for Email)."),
    },
    async ({ action, conversation_id, contact_id, limit, starred, unread_count, message_type, body: msgBody, subject }) => {
      try {
        switch (action) {
          case "search": {
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
            return ok({ conversations, total, has_more: total > conversations.length });
          }
          case "get_messages": {
            requireField(conversation_id, "conversation_id", action);
            const data = await client().get(`/conversations/${conversation_id}/messages`);
            const rawMessages = ((data.messages as Record<string, unknown>)?.messages as Record<string, unknown>[]) || [];
            const messages = [...rawMessages].reverse().map((m) => ({
              direction: m.direction || "unknown",
              body: ((m.body as string) || "").slice(0, 500),
              messageType: m.messageType, dateAdded: m.dateAdded, source: m.source,
              from: m.from, to: m.to, status: m.status, attachments: m.attachments || [],
            }));
            const hasMore = ((data.messages as Record<string, unknown>)?.nextPage as boolean) || false;
            return ok({ messages, count: messages.length, has_more: hasMore });
          }
          case "update": {
            requireField(conversation_id, "conversation_id", action);
            const updateBody: Record<string, unknown> = {};
            if (starred !== undefined) updateBody.starred = starred;
            if (unread_count !== undefined) updateBody.unreadCount = unread_count;
            if (Object.keys(updateBody).length === 0) {
              return validationError("At least one field must be provided: starred or unread_count.", "conversation_id");
            }
            const data = await client().put(`/conversations/${conversation_id}`, updateBody);
            return ok({ conversation: data });
          }
          case "send": {
            requireField(conversation_id, "conversation_id", action);
            validateMessageType(message_type);
            if (!msgBody.trim()) return validationError("body cannot be empty", "body");
            if (message_type === "Email" && !subject.trim()) {
              return validationError("subject is required when message_type is Email", "subject");
            }
            const payload: Record<string, unknown> = {
              type: message_type, message: msgBody, conversationId: conversation_id,
            };
            if (message_type === "Email") payload.subject = subject;
            const data = await client().post("/conversations/messages", payload);
            return ok({ messageId: data.messageId, message: data });
          }
        }
      } catch (e) {
        const scope = action === "send" ? "conversations/message.write" : action === "update" ? "conversations.write" : undefined;
        return catchError(e, scope, "limit");
      }
    },
  );

  // ── 6. pipelines ───────────────────────────────────────────────────────

  server.tool(
    "pipelines",
    "Get all sales pipelines and their stages. Use this to look up valid pipeline and stage IDs before working with opportunities.",
    {},
    async () => {
      try {
        const data = await client().get("/opportunities/pipelines");
        const pipelines = ((data.pipelines as Record<string, unknown>[]) || []).map((p) => ({
          id: p.id, name: p.name,
          stages: ((p.stages as Record<string, unknown>[]) || []).map((s) => ({
            id: s.id, name: s.name, position: s.position,
          })),
        }));
        return ok({ pipelines });
      } catch (e) {
        return catchError(e);
      }
    },
  );

  // ── 7. opportunities ──────────────────────────────────────────────────

  server.tool(
    "opportunities",
    "Manage deals/opportunities. Actions: search (filter by pipeline/stage/status/contact), get (full details), create, update (stage/status/value/title), delete.",
    {
      action: z.enum(["search", "get", "create", "update", "delete"]).describe("Operation to perform."),
      opportunity_id: z.string().default("").describe("Required for get, update, delete."),
      pipeline_id: z.string().default("").describe("search/create: pipeline ID from pipelines tool."),
      stage_id: z.string().default("").describe("search/create/update: stage ID from pipelines tool."),
      status: z.string().default("").describe("search: open|won|lost|abandoned|all. create/update: open|won|lost|abandoned."),
      contact_id: z.string().default("").describe("search/create: GHL contact ID."),
      limit: z.number().default(20).describe("search: max results (1-100)."),
      title: z.string().default("").describe("create/update: deal name."),
      monetary_value: z.number().optional().describe("create/update: deal value."),
    },
    async ({ action, opportunity_id, pipeline_id, stage_id, status, contact_id, limit, title, monetary_value }) => {
      try {
        switch (action) {
          case "search": {
            validateOpportunityStatus(status, true);
            const params: Record<string, string> = { limit: String(normalizeLimit(limit)) };
            if (pipeline_id) params.pipelineId = pipeline_id;
            if (stage_id) params.pipelineStageId = stage_id;
            if (status) params.status = status;
            if (contact_id) params.contactId = contact_id;
            const data = await client().get("/opportunities/search", params);
            const opportunities = ((data.opportunities as Record<string, unknown>[]) || []).map(serializeOpportunitySummary);
            const total = ((data.meta as Record<string, unknown>)?.total as number) || opportunities.length;
            return ok({ opportunities, total, has_more: total > opportunities.length });
          }
          case "get": {
            requireField(opportunity_id, "opportunity_id", action);
            const data = await client().get(`/opportunities/${opportunity_id}`);
            return ok({ opportunity: data.opportunity || data });
          }
          case "create": {
            requireField(contact_id, "contact_id", action);
            requireField(pipeline_id, "pipeline_id", action);
            requireField(stage_id, "stage_id", action);
            requireField(title, "title", action);
            if (!title.trim()) return validationError("title cannot be empty", "title");
            validateOpportunityStatus(status || "open", false);
            const body: Record<string, unknown> = {
              locationId: client().getLocationId(), contactId: contact_id,
              pipelineId: pipeline_id, pipelineStageId: stage_id,
              name: title, status: status || "open",
            };
            if (monetary_value !== undefined) body.monetaryValue = monetary_value;
            const data = await client().post("/opportunities", body);
            return ok({ opportunity: data.opportunity || data });
          }
          case "update": {
            requireField(opportunity_id, "opportunity_id", action);
            validateOpportunityStatus(status, false);
            const body: Record<string, unknown> = {};
            if (stage_id) body.pipelineStageId = stage_id;
            if (status) body.status = status;
            if (monetary_value !== undefined) body.monetaryValue = monetary_value;
            if (title) body.name = title;
            if (Object.keys(body).length === 0) {
              return validationError("At least one update field must be provided.", "opportunity_id");
            }
            const data = await client().put(`/opportunities/${opportunity_id}`, body);
            return ok({ opportunity: data });
          }
          case "delete": {
            requireField(opportunity_id, "opportunity_id", action);
            await client().delete(`/opportunities/${opportunity_id}`);
            return ok({ deleted: true, opportunityId: opportunity_id });
          }
        }
      } catch (e) {
        const scope = ["create", "update", "delete"].includes(action) ? "opportunities.write" : undefined;
        const msg = String(e);
        const field = msg.includes("status") ? "status" : "limit";
        return catchError(e, scope, field, field === "status" ? [...VALID_OPPORTUNITY_STATUSES].sort() : undefined);
      }
    },
  );

  // ── 8. calendars ──────────────────────────────────────────────────────

  server.tool(
    "calendars",
    "Read calendar data. Actions: list (all calendars), events (appointments by calendar/user/group/date range), free_slots (available booking times).",
    {
      action: z.enum(["list", "events", "free_slots"]).describe("Operation to perform."),
      calendar_id: z.string().default("").describe("events (optional), free_slots (required): calendar ID from list action."),
      start_time: z.string().default("").describe("events: optional range start in ISO 8601."),
      end_time: z.string().default("").describe("events: optional range end in ISO 8601."),
      user_id: z.string().default("").describe("events: optional user ID filter."),
      group_id: z.string().default("").describe("events: optional calendar group ID."),
      start_date: z.string().default("").describe("free_slots: start date YYYY-MM-DD."),
      end_date: z.string().default("").describe("free_slots: end date YYYY-MM-DD."),
      timezone: z.string().default("America/New_York").describe("free_slots: IANA timezone."),
    },
    async ({ action, calendar_id, start_time, end_time, user_id, group_id, start_date, end_date, timezone: tz }) => {
      try {
        switch (action) {
          case "list": {
            const data = await client().get("/calendars/");
            const calendars = ((data.calendars || data.data) as Record<string, unknown>[] || []).map((c) => ({
              id: c.id, name: c.name, description: c.description, isActive: c.isActive, groupId: c.groupId,
            }));
            return ok({ calendars, count: calendars.length });
          }
          case "events": {
            if (!calendar_id && !user_id && !group_id) {
              return validationError("At least one of calendar_id, user_id, or group_id is required.", "calendar_id");
            }
            const params: Record<string, string> = {};
            if (calendar_id) params.calendarId = calendar_id;
            if (user_id) params.userId = user_id;
            if (group_id) params.groupId = group_id;
            if (start_time) params.startTime = parseISO8601(start_time, "start_time");
            if (end_time) params.endTime = parseISO8601(end_time, "end_time");
            const data = await client().get("/calendars/events", params);
            const events = ((data.events || data.data) as unknown[]) || [];
            return ok({ events, count: events.length });
          }
          case "free_slots": {
            requireField(calendar_id, "calendar_id", action);
            requireField(start_date, "start_date", action);
            requireField(end_date, "end_date", action);
            const params: Record<string, string> = {
              startDate: start_date, endDate: end_date, timezone: tz, calendarId: calendar_id,
            };
            const data = await client().get(`/calendars/${calendar_id}/free-slots`, params);
            return ok({ slots: data.slots || data.data || data });
          }
        }
      } catch (e) {
        const scope = action === "list" || action === "events" ? "calendars/events.readonly" : "calendars.readonly";
        const msg = String(e);
        return catchError(e, scope, msg.includes("end_") ? "end_time" : "start_time");
      }
    },
  );

  // ── 9. appointments ───────────────────────────────────────────────────

  server.tool(
    "appointments",
    "Manage calendar appointments. Actions: book (new appointment), update (reschedule/modify), delete (cancel).",
    {
      action: z.enum(["book", "update", "delete"]).describe("Operation to perform."),
      event_id: z.string().default("").describe("Required for update, delete."),
      calendar_id: z.string().default("").describe("Required for book, update."),
      contact_id: z.string().default("").describe("book: the attending contact's GHL ID."),
      start_time: z.string().default("").describe("book (required), update (optional): ISO 8601 with timezone."),
      end_time: z.string().default("").describe("book (required), update (optional): ISO 8601 with timezone."),
      title: z.string().default("").describe("book/update: optional appointment title."),
      notes: z.string().default("").describe("book/update: optional notes."),
      status: z.string().default("").describe("update: confirmed, cancelled, showed, noshow."),
    },
    async ({ action, event_id, calendar_id, contact_id, start_time, end_time, title, notes, status }) => {
      try {
        switch (action) {
          case "book": {
            requireField(calendar_id, "calendar_id", action);
            requireField(contact_id, "contact_id", action);
            requireField(start_time, "start_time", action);
            requireField(end_time, "end_time", action);
            const normalizedStart = parseISO8601(start_time, "start_time");
            const normalizedEnd = parseISO8601(end_time, "end_time");
            if (normalizedEnd <= normalizedStart) {
              return validationError("end_time must be after start_time", "end_time");
            }
            const body: Record<string, unknown> = {
              calendarId: calendar_id, locationId: client().getLocationId(),
              contactId: contact_id, startTime: normalizedStart, endTime: normalizedEnd,
            };
            if (title) body.title = title;
            if (notes) body.notes = notes;
            const data = await client().post("/calendars/events/appointments", body);
            return ok({ appointment: data });
          }
          case "update": {
            requireField(event_id, "event_id", action);
            requireField(calendar_id, "calendar_id", action);
            const body: Record<string, unknown> = { calendarId: calendar_id };
            if (start_time) body.startTime = parseISO8601(start_time, "start_time");
            if (end_time) body.endTime = parseISO8601(end_time, "end_time");
            if (title) body.title = title;
            if (notes) body.notes = notes;
            if (status) body.status = status;
            if (Object.keys(body).length <= 1) {
              return validationError("At least one field must be provided to update.", "event_id");
            }
            const data = await client().put(`/calendars/events/appointments/${event_id}`, body);
            return ok({ appointment: data });
          }
          case "delete": {
            requireField(event_id, "event_id", action);
            await client().delete(`/calendars/events/appointments/${event_id}`);
            return ok({ deleted: true, eventId: event_id });
          }
        }
      } catch (e) {
        const msg = String(e);
        return catchError(e, "calendars/events.write", msg.includes("end_") ? "end_time" : "start_time");
      }
    },
  );

  // ── 10. location_info ─────────────────────────────────────────────────

  server.tool(
    "location_info",
    "Get info about the current dealership location. Actions: details (sub-account info), custom_fields (field definitions), tags (all configured tags).",
    {
      action: z.enum(["details", "custom_fields", "tags"]).describe("What info to retrieve."),
    },
    async ({ action }) => {
      try {
        const locId = client().getLocationId();
        switch (action) {
          case "details": {
            const data = await client().get(`/locations/${locId}`);
            return ok({ location: data.location || data });
          }
          case "custom_fields": {
            const data = await client().get(`/locations/${locId}/customFields`);
            return ok({ customFields: data.customFields || data.fields || data });
          }
          case "tags": {
            const data = await client().get(`/locations/${locId}/tags`);
            return ok({ tags: data.tags || data.locationTags || data });
          }
        }
      } catch (e) {
        return catchError(e);
      }
    },
  );

  // ── 11. users ─────────────────────────────────────────────────────────

  server.tool(
    "users",
    "Get team members. Actions: list (all users for this location), get (single user details).",
    {
      action: z.enum(["list", "get"]).describe("list all or get one."),
      user_id: z.string().default("").describe("get: the GHL user ID."),
    },
    async ({ action, user_id }) => {
      try {
        if (action === "list") {
          const data = await client().get("/users/");
          const users = ((data.users as Record<string, unknown>[]) || []).map((u) => ({
            id: u.id, name: u.name, firstName: u.firstName, lastName: u.lastName,
            email: u.email, phone: u.phone, role: u.role || u.type,
          }));
          return ok({ users, count: users.length });
        } else {
          requireField(user_id, "user_id", action);
          const data = await client().get(`/users/${user_id}`);
          return ok({ user: data });
        }
      } catch (e) {
        return catchError(e, "users.readonly");
      }
    },
  );
}
