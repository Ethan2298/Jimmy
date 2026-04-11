import { tool } from "ai";
import { z } from "zod";
import { getGHLClient } from "@/lib/ghl/client";

export const ghlTools = {
  searchContacts: tool({
    description:
      "Search dealership contacts by name, phone, email, or tag. Returns up to 20 contacts by default.",
    inputSchema: z.object({
      query: z.string().optional().describe("Search by name, phone, or email"),
      tag: z.string().optional().describe("Filter by tag"),
      limit: z.number().default(20).describe("Max results"),
    }),
    execute: async ({ query, tag, limit }) => {
      const client = getGHLClient();
      const params: Record<string, string> = {
        limit: String(Math.min(limit, 100)),
      };
      if (query) params.query = query;
      if (tag) params.query = tag;

      const data = await client.get("/contacts/", params);
      const contacts = ((data.contacts as Array<Record<string, unknown>>) || []).map((c) => ({
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
      return { contacts, total, hasMore: total > contacts.length };
    },
  }),

  getContact: tool({
    description: "Get full details for a specific contact by their GHL contact ID.",
    inputSchema: z.object({
      contactId: z.string().describe("The GHL contact ID"),
    }),
    execute: async ({ contactId }) => {
      const client = getGHLClient();
      const data = await client.get(`/contacts/${contactId}`);
      const c = (data.contact as Record<string, unknown>) || data;
      return {
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
        dnd: c.dnd,
        assignedTo: c.assignedTo,
      };
    },
  }),

  searchConversations: tool({
    description:
      "Search conversations. Optionally filter by contact ID. Returns recent conversations with last message preview.",
    inputSchema: z.object({
      contactId: z.string().optional().describe("Filter by contact ID"),
      limit: z.number().default(20).describe("Max results"),
    }),
    execute: async ({ contactId, limit }) => {
      const client = getGHLClient();
      const params: Record<string, string> = {
        limit: String(Math.min(limit, 100)),
      };
      if (contactId) params.contactId = contactId;

      const data = await client.get("/conversations/search", params);
      const conversations = (
        (data.conversations as Array<Record<string, unknown>>) || []
      ).map((c) => ({
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
      return { conversations, total, hasMore: total > conversations.length };
    },
  }),

  getConversationMessages: tool({
    description:
      "Get the full message thread for a conversation. Returns messages in chronological order.",
    inputSchema: z.object({
      conversationId: z.string().describe("The GHL conversation ID"),
    }),
    execute: async ({ conversationId }) => {
      const client = getGHLClient();
      const data = await client.get(`/conversations/${conversationId}/messages`);
      const rawMsgs =
        ((data.messages as Record<string, unknown>)?.messages as Array<Record<string, unknown>>) ||
        [];
      const messages = [...rawMsgs].reverse().map((m) => ({
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
      const hasMore =
        ((data.messages as Record<string, unknown>)?.nextPage as boolean) || false;
      return { messages, count: messages.length, hasMore };
    },
  }),

  getPipelines: tool({
    description:
      "Get all sales pipelines and their stages. Use this to look up pipeline/stage IDs before searching or updating opportunities.",
    inputSchema: z.object({}),
    execute: async () => {
      const client = getGHLClient();
      const data = await client.get("/opportunities/pipelines");
      const pipelines = (
        (data.pipelines as Array<Record<string, unknown>>) || []
      ).map((p) => ({
        id: p.id,
        name: p.name,
        stages: ((p.stages as Array<Record<string, unknown>>) || []).map((s) => ({
          id: s.id,
          name: s.name,
          position: s.position,
        })),
      }));
      return { pipelines };
    },
  }),

  searchOpportunities: tool({
    description:
      "Search deals/opportunities. Filter by pipeline, stage, contact, or status (open/won/lost/abandoned).",
    inputSchema: z.object({
      pipelineId: z.string().optional().describe("Filter by pipeline ID"),
      stageId: z.string().optional().describe("Filter by stage ID"),
      status: z
        .string()
        .optional()
        .describe("Filter by status: open, won, lost, abandoned"),
      contactId: z.string().optional().describe("Filter by contact ID"),
      limit: z.number().default(20).describe("Max results"),
    }),
    execute: async ({ pipelineId, stageId, status, contactId, limit }) => {
      const client = getGHLClient();
      const params: Record<string, string> = {
        limit: String(Math.min(limit, 100)),
      };
      if (pipelineId) params.pipelineId = pipelineId;
      if (stageId) params.pipelineStageId = stageId;
      if (status) params.status = status;
      if (contactId) params.contactId = contactId;

      const data = await client.get("/opportunities/search", params);
      const opportunities = (
        (data.opportunities as Array<Record<string, unknown>>) || []
      ).map((o) => {
        const contact = o.contact as Record<string, unknown> | undefined;
        return {
          id: o.id,
          name: o.name,
          status: o.status,
          pipelineId: o.pipelineId,
          pipelineStageId: o.pipelineStageId,
          monetaryValue: o.monetaryValue,
          contactId: contact?.id || o.contactId,
          contactName: contact?.name || null,
          dateAdded: o.dateAdded,
        };
      });
      const total =
        ((data.meta as Record<string, unknown>)?.total as number) || opportunities.length;
      return { opportunities, total, hasMore: total > opportunities.length };
    },
  }),

  getOpportunity: tool({
    description: "Get full details for a specific opportunity/deal by its ID.",
    inputSchema: z.object({
      opportunityId: z.string().describe("The GHL opportunity ID"),
    }),
    execute: async ({ opportunityId }) => {
      const client = getGHLClient();
      return await client.get(`/opportunities/${opportunityId}`);
    },
  }),

  sendMessage: tool({
    description:
      "Send an SMS or email through an existing conversation. Message goes from the dealership's GHL number/address.",
    inputSchema: z.object({
      conversationId: z
        .string()
        .describe("The conversation ID (look up via searchConversations first)"),
      messageType: z.enum(["SMS", "Email"]).describe("SMS or Email"),
      body: z.string().describe("Message text"),
      subject: z
        .string()
        .optional()
        .describe("Email subject line (required for Email type)"),
    }),
    execute: async ({ conversationId, messageType, body, subject }) => {
      const client = getGHLClient();
      const payload: Record<string, unknown> = {
        type: messageType,
        message: body,
        conversationId,
      };
      if (messageType === "Email" && subject) {
        payload.subject = subject;
      }
      const data = await client.post("/conversations/messages", payload);
      return { success: true, messageId: data.messageId, message: data };
    },
  }),

  updateOpportunity: tool({
    description:
      "Update a deal — move pipeline stage, change status (open/won/lost/abandoned), or update value.",
    inputSchema: z.object({
      opportunityId: z.string().describe("The opportunity ID"),
      stageId: z.string().optional().describe("New pipeline stage ID"),
      status: z
        .string()
        .optional()
        .describe("New status: open, won, lost, abandoned"),
      monetaryValue: z.number().optional().describe("Deal value"),
      title: z.string().optional().describe("Deal title/name"),
    }),
    execute: async ({ opportunityId, stageId, status, monetaryValue, title }) => {
      const client = getGHLClient();
      const body: Record<string, unknown> = {};
      if (stageId) body.pipelineStageId = stageId;
      if (status) body.status = status;
      if (monetaryValue !== undefined) body.monetaryValue = monetaryValue;
      if (title) body.name = title;
      const data = await client.put(`/opportunities/${opportunityId}`, body);
      return { success: true, opportunity: data };
    },
  }),
};
