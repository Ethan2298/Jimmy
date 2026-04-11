import type { ChatMessage } from "./ai";
import { getMessagePreview, getMessageText } from "./ai";

export interface ChatThread {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
}

export interface ChatState {
  version: 3;
  threads: ChatThread[];
  activeThreadId: string;
}

const MAX_TITLE_LENGTH = 30;

type LegacyToolPart = {
  type: "tool";
  toolName: string;
  toolCallId: string;
  args: unknown;
  resultSummary?: unknown;
  result?: unknown;
  status: "running" | "done";
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function asUIParts(value: unknown): ChatMessage["parts"] {
  if (!Array.isArray(value)) return [];

  const parts: ChatMessage["parts"] = [];
  for (const item of value) {
    const rec = asRecord(item);
    if (!rec || typeof rec.type !== "string") continue;
    parts.push(rec as ChatMessage["parts"][number]);
  }
  return parts;
}

function asLegacyToolParts(value: unknown): LegacyToolPart[] {
  if (!Array.isArray(value)) return [];

  const toolParts: LegacyToolPart[] = [];
  for (const item of value) {
    const rec = asRecord(item);
    if (!rec) continue;
    if (
      rec.type === "tool" &&
      typeof rec.toolName === "string" &&
      typeof rec.toolCallId === "string" &&
      (rec.status === "running" || rec.status === "done")
    ) {
      toolParts.push({
        type: "tool",
        toolName: rec.toolName,
        toolCallId: rec.toolCallId,
        args: rec.args,
        resultSummary: rec.resultSummary,
        result: rec.result,
        status: rec.status,
      });
    }
  }

  return toolParts;
}

function legacyToUIMessage(value: unknown): ChatMessage | null {
  const rec = asRecord(value);
  if (!rec) return null;

  const role = rec.role === "user" || rec.role === "ai" ? rec.role : null;
  const text = typeof rec.text === "string" ? rec.text : "";
  if (!role) return null;

  const parts: ChatMessage["parts"] = [];
  if (text.trim()) {
    parts.push({ type: "text", text });
  }

  const legacyToolParts = asLegacyToolParts(rec.parts);
  for (const toolPart of legacyToolParts) {
    const toolResult = toolPart.resultSummary ?? toolPart.result;
    if (toolPart.status === "running") {
      parts.push({
        type: "dynamic-tool",
        toolName: toolPart.toolName,
        toolCallId: toolPart.toolCallId,
        state: "input-available",
        input: toolPart.args,
      });
      continue;
    }

    if (toolResult !== undefined) {
      parts.push({
        type: "dynamic-tool",
        toolName: toolPart.toolName,
        toolCallId: toolPart.toolCallId,
        state: "output-available",
        input: toolPart.args,
        output: toolResult,
      });
      continue;
    }

    parts.push({
      type: "dynamic-tool",
      toolName: toolPart.toolName,
      toolCallId: toolPart.toolCallId,
      state: "input-available",
      input: toolPart.args,
    });
  }

  return {
    id: typeof rec.id === "string" ? rec.id : crypto.randomUUID(),
    role: role === "ai" ? "assistant" : "user",
    parts,
  };
}

function asV3Message(value: unknown): ChatMessage | null {
  const rec = asRecord(value);
  if (!rec) return null;

  const role = rec.role;
  if (role !== "user" && role !== "assistant" && role !== "system") return null;

  return {
    id: typeof rec.id === "string" ? rec.id : crypto.randomUUID(),
    role,
    parts: asUIParts(rec.parts),
    metadata: rec.metadata,
  };
}

function asV3Messages(value: unknown): ChatMessage[] {
  if (!Array.isArray(value)) return [];

  const messages: ChatMessage[] = [];
  for (const item of value) {
    const message = asV3Message(item);
    if (message) messages.push(message);
  }
  return messages;
}

function asLegacyMessages(value: unknown): ChatMessage[] {
  if (!Array.isArray(value)) return [];

  const messages: ChatMessage[] = [];
  for (const item of value) {
    const message = legacyToUIMessage(item);
    if (message) messages.push(message);
  }
  return messages;
}

function parseV3Thread(value: unknown): ChatThread | null {
  const rec = asRecord(value);
  if (!rec) return null;

  const id = typeof rec.id === "string" ? rec.id : null;
  const title = typeof rec.title === "string" ? rec.title : null;
  const createdAt = typeof rec.createdAt === "string" ? rec.createdAt : null;
  const updatedAt = typeof rec.updatedAt === "string" ? rec.updatedAt : null;

  if (!id || !title || !createdAt || !updatedAt) return null;

  return {
    id,
    title,
    createdAt,
    updatedAt,
    messages: asV3Messages(rec.messages),
  };
}

function parseLegacyThread(value: unknown): ChatThread | null {
  const rec = asRecord(value);
  if (!rec) return null;

  const id = typeof rec.id === "string" ? rec.id : null;
  const title = typeof rec.title === "string" ? rec.title : null;
  const createdAt = typeof rec.createdAt === "string" ? rec.createdAt : null;
  const updatedAt = typeof rec.updatedAt === "string" ? rec.updatedAt : null;

  if (!id || !title || !createdAt || !updatedAt) return null;

  return {
    id,
    title,
    createdAt,
    updatedAt,
    messages: asLegacyMessages(rec.messages),
  };
}

function withSortedThreads(threads: ChatThread[]): ChatThread[] {
  return [...threads].sort(
    (a, b) =>
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime() ||
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export function createThread(nowISO: string, title = "New thread"): ChatThread {
  return {
    id: crypto.randomUUID(),
    title,
    messages: [],
    createdAt: nowISO,
    updatedAt: nowISO,
  };
}

export function buildDefaultChatState(nowISO: string): ChatState {
  const thread = createThread(nowISO);
  return {
    version: 3,
    threads: [thread],
    activeThreadId: thread.id,
  };
}

export function deriveThreadTitle(text: string): string {
  const compact = text.replace(/\s+/g, " ").trim();
  if (!compact) return "New thread";
  if (compact.length <= MAX_TITLE_LENGTH) return compact;
  return `${compact.slice(0, MAX_TITLE_LENGTH - 1).trimEnd()}…`;
}

function deriveTitleFromMessages(messages: ChatMessage[]): string {
  const firstUser = messages.find((message) => message.role === "user");
  if (!firstUser) return "New thread";
  return deriveThreadTitle(getMessagePreview(firstUser));
}

export function normalizeChatState(input: unknown, nowISO: string): ChatState {
  const rec = asRecord(input);
  if (!rec) return buildDefaultChatState(nowISO);

  if (rec.version === 3 && Array.isArray(rec.threads)) {
    const parsedThreads = rec.threads
      .map((item) => parseV3Thread(item))
      .filter((thread): thread is ChatThread => !!thread);

    if (parsedThreads.length > 0) {
      const threads = withSortedThreads(parsedThreads);
      const activeThreadId =
        typeof rec.activeThreadId === "string" && threads.some((t) => t.id === rec.activeThreadId)
          ? rec.activeThreadId
          : threads[0].id;

      return {
        version: 3,
        threads,
        activeThreadId,
      };
    }
  }

  if (rec.version === 2 && Array.isArray(rec.threads)) {
    const parsedThreads = rec.threads
      .map((item) => parseLegacyThread(item))
      .filter((thread): thread is ChatThread => !!thread);

    if (parsedThreads.length > 0) {
      const threads = withSortedThreads(parsedThreads);
      const activeThreadId =
        typeof rec.activeThreadId === "string" && threads.some((t) => t.id === rec.activeThreadId)
          ? rec.activeThreadId
          : threads[0].id;

      return {
        version: 3,
        threads,
        activeThreadId,
      };
    }
  }

  if (Array.isArray(rec.messages)) {
    const messages = asLegacyMessages(rec.messages);
    const thread: ChatThread = {
      id: crypto.randomUUID(),
      title: deriveTitleFromMessages(messages),
      messages,
      createdAt: nowISO,
      updatedAt: nowISO,
    };

    return {
      version: 3,
      threads: [thread],
      activeThreadId: thread.id,
    };
  }

  return buildDefaultChatState(nowISO);
}

export function serializeChatState(state: ChatState): string {
  return JSON.stringify({
    version: 3,
    threads: state.threads,
    activeThreadId: state.activeThreadId,
  });
}

export function formatThreadAge(updatedAt: string, now = new Date()): string {
  const deltaMs = Math.max(0, now.getTime() - new Date(updatedAt).getTime());
  const mins = Math.floor(deltaMs / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo`;
  const years = Math.floor(days / 365);
  return `${years}y`;
}

export function searchThreads(threads: ChatThread[], query: string): ChatThread[] {
  const q = query.toLowerCase();
  return threads.filter((thread) => {
    if (thread.title.toLowerCase().includes(q)) return true;
    return thread.messages.some((msg) => {
      const text = getMessageText(msg);
      return text ? text.toLowerCase().includes(q) : false;
    });
  });
}

export function sortThreads(threads: ChatThread[]): ChatThread[] {
  return withSortedThreads(threads);
}
