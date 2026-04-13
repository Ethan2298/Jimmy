import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getGHLClient, GHLAPIError } from "./client";

type McpResult = { content: [{ type: "text"; text: string }] };

const OPPORTUNITY_STATUS_VALUES = ["open", "won", "lost", "abandoned", "all"] as const;
const WRITE_OPPORTUNITY_STATUS_VALUES = ["open", "won", "lost", "abandoned"] as const;
const MESSAGE_TYPE_VALUES = ["SMS", "Email"] as const;

const VALID_OPPORTUNITY_STATUSES = new Set<string>(OPPORTUNITY_STATUS_VALUES);
const VALID_WRITE_OPPORTUNITY_STATUSES = new Set<string>(WRITE_OPPORTUNITY_STATUS_VALUES);
const VALID_MESSAGE_TYPES = new Set<string>(MESSAGE_TYPE_VALUES);

function ok(data: Record<string, unknown>): McpResult {
  return {
    content: [{ type: "text" as const, text: JSON.stringify({ success: true, data }) }],
  };
}

function apiError(e: GHLAPIError, requiredScope?: string): McpResult {
  const payload: Record<string, unknown> = {
    status_code: e.statusCode,
    message: e.message,
  };
  if (requiredScope && (e.statusCode === 401 || e.statusCode === 403)) {
    payload.required_scope = requiredScope;
  }
  return {
    content: [{ type: "text" as const, text: JSON.stringify({ success: false, error: payload }) }],
  };
}

function validationError(message: string, field?: string, allowedValues?: string[]): McpResult {
  const payload: Record<string, unknown> = { status_code: 400, message };
  if (field) payload.field = field;
  if (allowedValues) payload.allowed_values = allowedValues;
  return {
    content: [{ type: "text" as const, text: JSON.stringify({ success: false, error: payload }) }],
  };
}

class RequiredFieldError extends Error {
  field: string;

  constructor(message: string, field: string) {
    super(message);
    this.field = field;
  }
}

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
  if (isNaN(d.getTime())) {
    throw new Error(`${field} must be a valid ISO 8601 datetime string`);
  }
  return d.toISOString();
}

function serializeOpportunitySummary(opp: Record<string, unknown>): Record<string, unknown> {
  const contact = opp.contact as Record<string, unknown> | undefined;
  return {
    id: opp.id,
    name: opp.name,
    status: opp.status,
    pipelineId: opp.pipelineId,
    pipelineStageId: opp.pipelineStageId,
    monetaryValue: opp.monetaryValue,
    contactId: contact?.id ?? opp.contactId,
    contactName: contact?.name ?? null,
    dateAdded: opp.dateAdded || opp.createdAt,
  };
}

function requireField(val: string, name: string, action: string): void {
  if (!val) {
    throw new RequiredFieldError(`${name} is required for action "${action}".`, name);
  }
}

function catchError(
  e: unknown,
  requiredScope?: string,
  field?: string,
  allowedValues?: string[],
): McpResult {
  if (e instanceof GHLAPIError) return apiError(e, requiredScope);
  if (e instanceof RequiredFieldError) return validationError(e.message, e.field);
  return validationError(String(e), field, allowedValues);
}

const customFieldInput = z.object({ id: z.string(), field_value: z.string() });

const contactsInput = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("search"),
    query: z.string().default("").describe("Free-text across name, phone, or email."),
    tag: z.string().default("").describe("Optional tag keyword to narrow results."),
    limit: z.number().default(20).describe("Maximum contacts to return (1-100)."),
  }),
  z.object({
    action: z.literal("get"),
    contact_id: z.string().describe("The GHL contact ID."),
  }),
  z.object({
    action: z.literal("upsert"),
    first_name: z.string().default("").describe("Optional contact first name."),
    last_name: z.string().default("").describe("Optional contact last name."),
    phone: z.string().default("").describe("Optional phone number."),
    email: z.string().default("").describe("Optional email address."),
    tags: z.array(z.string()).optional().describe("Optional list of tags."),
    source: z.string().default("").describe("Optional lead source string."),
  }),
  z.object({
    action: z.literal("update"),
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
    custom_fields: z.array(customFieldInput).optional().describe("Optional custom field updates."),
  }),
  z.object({
    action: z.literal("delete"),
    contact_id: z.string().describe("The GHL contact ID to delete."),
  }),
]);

const contactTagsInput = z.object({
  action: z.enum(["add", "remove"]).describe("add or remove tags."),
  contact_id: z.string().describe("The GHL contact ID."),
  tags: z.array(z.string()).describe("Tags to add or remove."),
});

const contactNotesInput = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("list"),
    contact_id: z.string().describe("The GHL contact ID."),
  }),
  z.object({
    action: z.literal("add"),
    contact_id: z.string().describe("The GHL contact ID."),
    body: z.string().describe("The note text."),
  }),
]);

const contactTasksInput = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("list"),
    contact_id: z.string().describe("The GHL contact ID."),
  }),
  z.object({
    action: z.literal("create"),
    contact_id: z.string().describe("The GHL contact ID."),
    title: z.string().describe("Task title."),
    due_date: z.string().describe("Due date in ISO 8601 format with timezone offset."),
    description: z.string().default("").describe("Optional task description."),
    assigned_to: z.string().default("").describe("Optional user ID to assign the task to."),
  }),
]);

const conversationsInput = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("search"),
    contact_id: z.string().default("").describe("Optional GHL contact ID."),
    limit: z.number().default(20).describe("Maximum conversations to return (1-100)."),
  }),
  z.object({
    action: z.literal("get_messages"),
    conversation_id: z.string().describe("The GHL conversation ID."),
  }),
  z.object({
    action: z.literal("update"),
    conversation_id: z.string().describe("The GHL conversation ID."),
    starred: z.boolean().optional().describe("Set True to star, False to unstar."),
    unread_count: z.number().optional().describe("Set to 0 to mark as read."),
  }),
  z.object({
    action: z.literal("send"),
    conversation_id: z.string().describe("The conversation ID from search."),
    message_type: z.enum(MESSAGE_TYPE_VALUES).describe("Allowed values: SMS or Email."),
    body: z.string().describe("Message text."),
    subject: z.string().default("").describe("Email subject line. Required when message_type is Email."),
  }),
]);

const opportunitiesInput = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("search"),
    pipeline_id: z.string().default("").describe("Optional pipeline ID from pipelines tool."),
    stage_id: z.string().default("").describe("Optional stage ID from pipelines tool."),
    status: z.string().default("").describe("Optional status: open, won, lost, abandoned, or all."),
    contact_id: z.string().default("").describe("Optional GHL contact ID."),
    limit: z.number().default(20).describe("Maximum opportunities to return (1-100)."),
  }),
  z.object({
    action: z.literal("get"),
    opportunity_id: z.string().describe("The GHL opportunity ID."),
  }),
  z.object({
    action: z.literal("create"),
    contact_id: z.string().describe("The GHL contact ID the deal belongs to."),
    pipeline_id: z.string().describe("The destination pipeline ID from pipelines tool."),
    stage_id: z.string().describe("The destination stage ID from pipelines tool."),
    title: z.string().describe("Human-readable deal name."),
    monetary_value: z.number().optional().describe("Optional deal value."),
    status: z.string().default("open").describe("Initial status: open, won, lost, or abandoned."),
  }),
  z.object({
    action: z.literal("update"),
    opportunity_id: z.string().describe("The GHL opportunity ID."),
    stage_id: z.string().default("").describe("Optional stage ID."),
    status: z.string().default("").describe("Optional status: open, won, lost, or abandoned."),
    monetary_value: z.number().optional().describe("Optional updated deal value."),
    title: z.string().default("").describe("Optional new deal title."),
  }),
  z.object({
    action: z.literal("delete"),
    opportunity_id: z.string().describe("The GHL opportunity ID to delete."),
  }),
]);

const calendarsInput = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("list"),
  }),
  z.object({
    action: z.literal("events"),
    calendar_id: z.string().default("").describe("Optional calendar ID."),
    start_time: z.string().default("").describe("Optional start of range in ISO 8601."),
    end_time: z.string().default("").describe("Optional end of range in ISO 8601."),
    user_id: z.string().default("").describe("Optional user ID."),
    group_id: z.string().default("").describe("Optional calendar group ID."),
  }),
  z.object({
    action: z.literal("free_slots"),
    calendar_id: z.string().describe("The calendar ID from list."),
    start_date: z.string().describe("Start date in YYYY-MM-DD format."),
    end_date: z.string().describe("End date in YYYY-MM-DD format."),
    timezone: z.string().default("America/New_York").describe("IANA timezone string."),
  }),
]);

const appointmentsInput = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("book"),
    calendar_id: z.string().describe("The calendar ID from calendars list."),
    contact_id: z.string().describe("The GHL contact ID attending."),
    start_time: z.string().describe("Start in ISO 8601 format with timezone."),
    end_time: z.string().describe("End in ISO 8601 format with timezone."),
    title: z.string().default("").describe("Optional appointment title."),
    notes: z.string().default("").describe("Optional appointment notes."),
  }),
  z.object({
    action: z.literal("update"),
    event_id: z.string().describe("The GHL event/appointment ID."),
    calendar_id: z.string().describe("The calendar ID the appointment belongs to."),
    start_time: z.string().default("").describe("Optional new start time in ISO 8601."),
    end_time: z.string().default("").describe("Optional new end time in ISO 8601."),
    title: z.string().default("").describe("Optional new appointment title."),
    notes: z.string().default("").describe("Optional updated notes."),
    status: z.string().default("").describe("Optional status: confirmed, cancelled, showed, noshow."),
  }),
  z.object({
    action: z.literal("delete"),
    event_id: z.string().describe("The GHL event/appointment ID to delete."),
  }),
]);

const locationInfoInput = z.object({
  action: z.enum(["details", "custom_fields", "tags"]).describe("What info to retrieve."),
});

const usersInput = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("list"),
  }),
  z.object({
    action: z.literal("get"),
    user_id: z.string().describe("The GHL user ID."),
  }),
]);

export function registerTools(server: McpServer): void {
  const client = () => getGHLClient();

  server.registerTool(
    "contacts",
    {
      description: "Manage dealership contacts. Actions: search, get, upsert, update, delete.",
      inputSchema: contactsInput,
    },
    async (input) => {
      try {
        switch (input.action) {
          case "search": {
            const params: Record<string, string> = {
              limit: String(normalizeLimit(input.limit)),
            };
            if (input.query) params.query = input.query;
            if (input.tag) params.query = input.tag;

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
            return ok({ contacts, total, has_more: total > contacts.length });
          }
          case "get": {
            const data = await client().get(`/contacts/${input.contact_id}`);
            const c = (data.contact as Record<string, unknown>) || data;
            return ok({
              contact: {
                id: c.id,
                name: c.contactName,
                firstName: c.firstName,
                lastName: c.lastName,
                phone: c.phone,
                email: c.email,
                tags: c.tags || [],
                source: c.source,
                city: c.city,
                state: c.state,
                country: c.country,
                dateAdded: c.dateAdded,
                customFields: c.customFields || [],
                attributions: c.attributions || [],
                dnd: c.dnd,
                assignedTo: c.assignedTo,
              },
            });
          }
          case "upsert": {
            if (
              !input.first_name &&
              !input.last_name &&
              !input.phone &&
              !input.email &&
              !input.tags?.length &&
              !input.source
            ) {
              return validationError("At least one contact field must be provided.", "phone");
            }
            const body: Record<string, unknown> = { locationId: client().getLocationId() };
            if (input.first_name) body.firstName = input.first_name;
            if (input.last_name) body.lastName = input.last_name;
            if (input.phone) body.phone = input.phone;
            if (input.email) body.email = input.email;
            if (input.tags?.length) body.tags = input.tags;
            if (input.source) body.source = input.source;

            const data = await client().post("/contacts/upsert", body);
            return ok({ contact: data.contact || data });
          }
          case "update": {
            const body: Record<string, unknown> = {};
            if (input.first_name) body.firstName = input.first_name;
            if (input.last_name) body.lastName = input.last_name;
            if (input.phone) body.phone = input.phone;
            if (input.email) body.email = input.email;
            if (input.city) body.city = input.city;
            if (input.state) body.state = input.state;
            if (input.address) body.address1 = input.address;
            if (input.postal_code) body.postalCode = input.postal_code;
            if (input.assigned_to) body.assignedTo = input.assigned_to;
            if (input.dnd !== undefined) body.dnd = input.dnd;
            if (input.custom_fields?.length) body.customFields = input.custom_fields;

            if (Object.keys(body).length === 0) {
              return validationError("At least one field must be provided to update.", "contact_id");
            }

            const data = await client().put(`/contacts/${input.contact_id}`, body);
            return ok({ contact: data.contact || data });
          }
          case "delete": {
            await client().delete(`/contacts/${input.contact_id}`);
            return ok({ deleted: true, contactId: input.contact_id });
          }
        }
      } catch (e) {
        if (input.action === "search") {
          return catchError(e, undefined, "limit");
        }
        if (input.action === "upsert" || input.action === "update" || input.action === "delete") {
          return catchError(e, "contacts.write");
        }
        return catchError(e);
      }
    },
  );

  server.registerTool(
    "contact_tags",
    {
      description: "Add or remove tags on a contact. Actions: add, remove.",
      inputSchema: contactTagsInput,
    },
    async ({ action, contact_id, tags }) => {
      try {
        if (action === "add") {
          const data = await client().post(`/contacts/${contact_id}/tags`, { tags });
          return ok({ tags: data.tags || tags });
        }
        const data = await client().delete(`/contacts/${contact_id}/tags`, { tags });
        return ok({ tags: data.tags || tags });
      } catch (e) {
        return catchError(e, "contacts.write");
      }
    },
  );

  server.registerTool(
    "contact_notes",
    {
      description: "List or add notes on a contact. Actions: list, add.",
      inputSchema: contactNotesInput,
    },
    async (input) => {
      try {
        if (input.action === "list") {
          const data = await client().get(`/contacts/${input.contact_id}/notes`);
          const notes = (data.notes as unknown[]) || [];
          return ok({ notes, count: notes.length });
        }
        if (!input.body.trim()) return validationError("body cannot be empty", "body");
        const data = await client().post(`/contacts/${input.contact_id}/notes`, { body: input.body });
        return ok({ note: data });
      } catch (e) {
        return catchError(e, input.action === "add" ? "contacts.write" : undefined);
      }
    },
  );

  server.registerTool(
    "contact_tasks",
    {
      description: "List or create tasks for a contact. Actions: list, create.",
      inputSchema: contactTasksInput,
    },
    async (input) => {
      try {
        if (input.action === "list") {
          const data = await client().get(`/contacts/${input.contact_id}/tasks`);
          const tasks = (data.tasks as unknown[]) || [];
          return ok({ tasks, count: tasks.length });
        }
        if (!input.title.trim()) return validationError("title cannot be empty", "title");
        const normalizedDue = parseISO8601(input.due_date, "due_date");
        const body: Record<string, unknown> = { title: input.title, dueDate: normalizedDue };
        if (input.description) body.description = input.description;
        if (input.assigned_to) body.assignedTo = input.assigned_to;

        const data = await client().post(`/contacts/${input.contact_id}/tasks`, body);
        return ok({ task: data });
      } catch (e) {
        return catchError(e, input.action === "create" ? "contacts.write" : undefined, "due_date");
      }
    },
  );

  server.registerTool(
    "conversations",
    {
      description: "Manage conversations. Actions: search, get_messages, update, send.",
      inputSchema: conversationsInput,
    },
    async (input) => {
      try {
        switch (input.action) {
          case "search": {
            const params: Record<string, string> = { limit: String(normalizeLimit(input.limit)) };
            if (input.contact_id) params.contactId = input.contact_id;

            const data = await client().get("/conversations/search", params);
            const conversations = ((data.conversations as Record<string, unknown>[]) || []).map((c) => ({
              id: c.id,
              contactId: c.contactId,
              fullName: c.fullName,
              lastMessageBody: ((c.lastMessageBody as string) || "").slice(0, 200),
              lastMessageType: c.lastMessageType,
              lastMessageDirection: c.lastMessageDirection,
              lastMessageDate: c.lastMessageDate,
              unreadCount: c.unreadCount || 0,
              type: c.type,
              phone: c.phone,
              email: c.email,
              tags: c.tags || [],
            }));
            const total = (data.total as number) || 0;
            return ok({ conversations, total, has_more: total > conversations.length });
          }
          case "get_messages": {
            const data = await client().get(`/conversations/${input.conversation_id}/messages`);
            const rawMessages =
              ((data.messages as Record<string, unknown>)?.messages as Record<string, unknown>[]) || [];
            const messages = [...rawMessages].reverse().map((m) => ({
              direction: m.direction || "unknown",
              body: ((m.body as string) || "").slice(0, 500),
              messageType: m.messageType,
              dateAdded: m.dateAdded,
              source: m.source,
              from: m.from,
              to: m.to,
              status: m.status,
              attachments: m.attachments || [],
            }));
            const hasMore = ((data.messages as Record<string, unknown>)?.nextPage as boolean) || false;
            return ok({ messages, count: messages.length, has_more: hasMore });
          }
          case "update": {
            const body: Record<string, unknown> = {};
            if (input.starred !== undefined) body.starred = input.starred;
            if (input.unread_count !== undefined) body.unreadCount = input.unread_count;
            if (Object.keys(body).length === 0) {
              return validationError(
                "At least one field must be provided: starred or unread_count.",
                "conversation_id",
              );
            }
            const data = await client().put(`/conversations/${input.conversation_id}`, body);
            return ok({ conversation: data });
          }
          case "send": {
            if (!input.body.trim()) return validationError("body cannot be empty", "body");
            if (input.message_type === "Email" && !input.subject.trim()) {
              return validationError(
                "subject is required when message_type is Email",
                "subject",
              );
            }
            const payload: Record<string, unknown> = {
              type: input.message_type,
              message: input.body,
              conversationId: input.conversation_id,
            };
            if (input.message_type === "Email") payload.subject = input.subject;

            const data = await client().post("/conversations/messages", payload);
            return ok({ messageId: data.messageId, message: data });
          }
        }
      } catch (e) {
        if (input.action === "search") {
          return catchError(e, undefined, "limit");
        }
        if (input.action === "update") {
          return catchError(e, "conversations.write");
        }
        if (input.action === "send") {
          const msg = String(e);
          return catchError(
            e,
            "conversations/message.write",
            msg.includes("message_type") ? "message_type" : undefined,
            msg.includes("message_type") ? [...VALID_MESSAGE_TYPES].sort() : undefined,
          );
        }
        return catchError(e);
      }
    },
  );

  server.registerTool(
    "pipelines",
    {
      description: "Get all sales pipelines and their stages.",
      inputSchema: z.object({}),
    },
    async () => {
      try {
        const data = await client().get("/opportunities/pipelines");
        const pipelines = ((data.pipelines as Record<string, unknown>[]) || []).map((p) => ({
          id: p.id,
          name: p.name,
          stages: ((p.stages as Record<string, unknown>[]) || []).map((s) => ({
            id: s.id,
            name: s.name,
            position: s.position,
          })),
        }));
        return ok({ pipelines });
      } catch (e) {
        return catchError(e);
      }
    },
  );

  server.registerTool(
    "opportunities",
    {
      description: "Manage deals/opportunities. Actions: search, get, create, update, delete.",
      inputSchema: opportunitiesInput,
    },
    async (input) => {
      try {
        switch (input.action) {
          case "search": {
            validateOpportunityStatus(input.status, true);
            const params: Record<string, string> = { limit: String(normalizeLimit(input.limit)) };
            if (input.pipeline_id) params.pipelineId = input.pipeline_id;
            if (input.stage_id) params.pipelineStageId = input.stage_id;
            if (input.status) params.status = input.status;
            if (input.contact_id) params.contactId = input.contact_id;

            const data = await client().get("/opportunities/search", params);
            const opportunities = ((data.opportunities as Record<string, unknown>[]) || []).map(
              serializeOpportunitySummary,
            );
            const total =
              ((data.meta as Record<string, unknown>)?.total as number) || opportunities.length;
            return ok({ opportunities, total, has_more: total > opportunities.length });
          }
          case "get": {
            const data = await client().get(`/opportunities/${input.opportunity_id}`);
            return ok({ opportunity: data.opportunity || data });
          }
          case "create": {
            if (!input.title.trim()) return validationError("title cannot be empty", "title");
            validateOpportunityStatus(input.status, false);
            const body: Record<string, unknown> = {
              locationId: client().getLocationId(),
              contactId: input.contact_id,
              pipelineId: input.pipeline_id,
              pipelineStageId: input.stage_id,
              name: input.title,
              status: input.status,
            };
            if (input.monetary_value !== undefined) body.monetaryValue = input.monetary_value;

            const data = await client().post("/opportunities", body);
            return ok({ opportunity: data.opportunity || data });
          }
          case "update": {
            validateOpportunityStatus(input.status, false);
            const body: Record<string, unknown> = {};
            if (input.stage_id) body.pipelineStageId = input.stage_id;
            if (input.status) body.status = input.status;
            if (input.monetary_value !== undefined) body.monetaryValue = input.monetary_value;
            if (input.title) body.name = input.title;

            if (Object.keys(body).length === 0) {
              return validationError("At least one update field must be provided.", "opportunity_id");
            }

            const data = await client().put(`/opportunities/${input.opportunity_id}`, body);
            return ok({ opportunity: data });
          }
          case "delete": {
            await client().delete(`/opportunities/${input.opportunity_id}`);
            return ok({ deleted: true, opportunityId: input.opportunity_id });
          }
        }
      } catch (e) {
        const msg = String(e);
        if (input.action === "search") {
          const field = msg.includes("status") ? "status" : "limit";
          return catchError(
            e,
            undefined,
            field,
            field === "status" ? [...VALID_OPPORTUNITY_STATUSES].sort() : undefined,
          );
        }
        if (input.action === "create" || input.action === "update") {
          return catchError(
            e,
            "opportunities.write",
            msg.includes("status") ? "status" : undefined,
            msg.includes("status") ? [...VALID_WRITE_OPPORTUNITY_STATUSES].sort() : undefined,
          );
        }
        if (input.action === "delete") {
          return catchError(e, "opportunities.write");
        }
        return catchError(e);
      }
    },
  );

  server.registerTool(
    "calendars",
    {
      description: "Read calendar data. Actions: list, events, free_slots.",
      inputSchema: calendarsInput,
    },
    async (input) => {
      try {
        switch (input.action) {
          case "list": {
            const data = await client().get("/calendars/");
            const calendars = (((data.calendars || data.data) as Record<string, unknown>[]) || []).map(
              (c) => ({
                id: c.id,
                name: c.name,
                description: c.description,
                isActive: c.isActive,
                groupId: c.groupId,
              }),
            );
            return ok({ calendars, count: calendars.length });
          }
          case "events": {
            if (!input.calendar_id && !input.user_id && !input.group_id) {
              return validationError(
                "At least one of calendar_id, user_id, or group_id is required.",
                "calendar_id",
              );
            }
            const params: Record<string, string> = {};
            if (input.calendar_id) params.calendarId = input.calendar_id;
            if (input.user_id) params.userId = input.user_id;
            if (input.group_id) params.groupId = input.group_id;
            if (input.start_time) params.startTime = parseISO8601(input.start_time, "start_time");
            if (input.end_time) params.endTime = parseISO8601(input.end_time, "end_time");

            const data = await client().get("/calendars/events", params);
            const events = ((data.events || data.data) as unknown[]) || [];
            return ok({ events, count: events.length });
          }
          case "free_slots": {
            const params: Record<string, string> = {
              startDate: input.start_date,
              endDate: input.end_date,
              timezone: input.timezone,
              calendarId: input.calendar_id,
            };
            const data = await client().get(`/calendars/${input.calendar_id}/free-slots`, params);
            return ok({ slots: data.slots || data.data || data });
          }
        }
      } catch (e) {
        if (input.action === "list") {
          return catchError(e, "calendars.readonly");
        }
        if (input.action === "events") {
          const msg = String(e);
          return catchError(
            e,
            "calendars/events.readonly",
            msg.includes("end_time") ? "end_time" : "start_time",
          );
        }
        return catchError(e, "calendars.readonly");
      }
    },
  );

  server.registerTool(
    "appointments",
    {
      description: "Manage calendar appointments. Actions: book, update, delete.",
      inputSchema: appointmentsInput,
    },
    async (input) => {
      try {
        switch (input.action) {
          case "book": {
            const normalizedStart = parseISO8601(input.start_time, "start_time");
            const normalizedEnd = parseISO8601(input.end_time, "end_time");
            if (normalizedEnd <= normalizedStart) {
              return validationError("end_time must be after start_time", "end_time");
            }
            const body: Record<string, unknown> = {
              calendarId: input.calendar_id,
              locationId: client().getLocationId(),
              contactId: input.contact_id,
              startTime: normalizedStart,
              endTime: normalizedEnd,
            };
            if (input.title) body.title = input.title;
            if (input.notes) body.notes = input.notes;

            const data = await client().post("/calendars/events/appointments", body);
            return ok({ appointment: data });
          }
          case "update": {
            const body: Record<string, unknown> = { calendarId: input.calendar_id };
            if (input.start_time) body.startTime = parseISO8601(input.start_time, "start_time");
            if (input.end_time) body.endTime = parseISO8601(input.end_time, "end_time");
            if (input.title) body.title = input.title;
            if (input.notes) body.notes = input.notes;
            if (input.status) body.status = input.status;

            if (Object.keys(body).length <= 1) {
              return validationError("At least one field must be provided to update.", "event_id");
            }

            const data = await client().put(`/calendars/events/appointments/${input.event_id}`, body);
            return ok({ appointment: data });
          }
          case "delete": {
            await client().delete(`/calendars/events/appointments/${input.event_id}`);
            return ok({ deleted: true, eventId: input.event_id });
          }
        }
      } catch (e) {
        const msg = String(e);
        return catchError(
          e,
          "calendars/events.write",
          msg.includes("end_time") ? "end_time" : "start_time",
        );
      }
    },
  );

  server.registerTool(
    "location_info",
    {
      description: "Get info about the current dealership location. Actions: details, custom_fields, tags.",
      inputSchema: locationInfoInput,
    },
    async ({ action }) => {
      try {
        const locationId = client().getLocationId();
        switch (action) {
          case "details": {
            const data = await client().get(`/locations/${locationId}`);
            return ok({ location: data.location || data });
          }
          case "custom_fields": {
            const data = await client().get(`/locations/${locationId}/customFields`);
            return ok({ customFields: data.customFields || data.fields || data });
          }
          case "tags": {
            const data = await client().get(`/locations/${locationId}/tags`);
            return ok({ tags: data.tags || data.locationTags || data });
          }
        }
      } catch (e) {
        return catchError(e);
      }
    },
  );

  server.registerTool(
    "users",
    {
      description: "Get team members. Actions: list, get.",
      inputSchema: usersInput,
    },
    async (input) => {
      try {
        if (input.action === "list") {
          const data = await client().get("/users/");
          const users = ((data.users as Record<string, unknown>[]) || []).map((u) => ({
            id: u.id,
            name: u.name,
            firstName: u.firstName,
            lastName: u.lastName,
            email: u.email,
            phone: u.phone,
            role: u.role || u.type,
          }));
          return ok({ users, count: users.length });
        }
        const data = await client().get(`/users/${input.user_id}`);
        return ok({ user: data });
      } catch (e) {
        return catchError(e, "users.readonly");
      }
    },
  );
}
