import { describe, expect, it } from "vitest";
import {
  buildDefaultChatState,
  deriveThreadTitle,
  formatThreadAge,
  normalizeChatState,
  sortThreads,
  type ChatState,
} from "../chat-threads";

const NOW = "2026-02-26T12:00:00.000Z";

describe("chat-threads", () => {
  it("creates a default state when input is invalid", () => {
    const state = normalizeChatState(null, NOW);
    expect(state.version).toBe(3);
    expect(state.threads).toHaveLength(1);
    expect(state.activeThreadId).toBe(state.threads[0].id);
    expect(state.threads[0].title).toBe("New thread");
  });

  it("migrates legacy messages payload into a single thread", () => {
    const legacy = {
      messages: [
        {
          id: "m1",
          role: "user",
          text: "Connect to paper MCP and scaffold app shell",
          createdAt: "2026-02-26T10:00:00.000Z",
        },
        {
          id: "m2",
          role: "ai",
          text: "I can do that.",
          createdAt: "2026-02-26T10:01:00.000Z",
        },
      ],
    };

    const state = normalizeChatState(legacy, NOW);

    expect(state.version).toBe(3);
    expect(state.threads).toHaveLength(1);
    expect(state.threads[0].messages).toHaveLength(2);
    expect(state.threads[0].messages[1].role).toBe("assistant");
    expect(state.threads[0].messages[0].parts[0]).toMatchObject({
      type: "text",
      text: "Connect to paper MCP and scaffold app shell",
    });
  });

  it("retains valid v3 payload and keeps active thread", () => {
    const v3: ChatState = {
      version: 3,
      activeThreadId: "t2",
      threads: [
        {
          id: "t1",
          title: "older",
          messages: [],
          createdAt: "2026-02-25T09:00:00.000Z",
          updatedAt: "2026-02-25T10:00:00.000Z",
        },
        {
          id: "t2",
          title: "newer",
          messages: [],
          createdAt: "2026-02-26T09:00:00.000Z",
          updatedAt: "2026-02-26T10:00:00.000Z",
        },
      ],
    };

    const state = normalizeChatState(v3, NOW);
    expect(state.threads[0].id).toBe("t2");
    expect(state.activeThreadId).toBe("t2");
  });

  it("migrates legacy v2 tool parts into dynamic-tool states", () => {
    const v2 = {
      version: 2,
      activeThreadId: "t1",
      threads: [
        {
          id: "t1",
          title: "legacy",
          createdAt: NOW,
          updatedAt: NOW,
          messages: [
            {
              id: "m1",
              role: "ai",
              text: "",
              createdAt: NOW,
              parts: [
                {
                  type: "tool",
                  toolName: "search_tasks",
                  toolCallId: "tc1",
                  args: { query: "migration" },
                  status: "running",
                },
                {
                  type: "tool",
                  toolName: "get_overview",
                  toolCallId: "tc2",
                  args: {},
                  resultSummary: { overdue: 2 },
                  status: "done",
                },
              ],
            },
          ],
        },
      ],
    };

    const state = normalizeChatState(v2, NOW);
    const parts = state.threads[0].messages[0].parts;

    expect(parts[0]).toMatchObject({
      type: "dynamic-tool",
      toolName: "search_tasks",
      toolCallId: "tc1",
      state: "input-available",
    });
    expect(parts[1]).toMatchObject({
      type: "dynamic-tool",
      toolName: "get_overview",
      toolCallId: "tc2",
      state: "output-available",
    });
  });

  it("falls back active thread when missing", () => {
    const v3 = {
      version: 3,
      activeThreadId: "missing",
      threads: [
        {
          id: "t1",
          title: "thread",
          messages: [],
          createdAt: "2026-02-26T09:00:00.000Z",
          updatedAt: "2026-02-26T09:00:00.000Z",
        },
      ],
    };

    const state = normalizeChatState(v3, NOW);
    expect(state.activeThreadId).toBe("t1");
  });

  it("derives thread title and trims long values", () => {
    expect(deriveThreadTitle("   ")).toBe("New thread");
    expect(deriveThreadTitle("Rename app for project planning")).toBe("Rename app for project planni…");
    expect(deriveThreadTitle("This title is way too long to be used as-is in the sidebar")).toBe(
      "This title is way too long to…"
    );
  });

  it("sorts threads by updatedAt desc", () => {
    const base = buildDefaultChatState(NOW);
    const sorted = sortThreads([
      { ...base.threads[0], id: "a", updatedAt: "2026-02-26T07:00:00.000Z" },
      { ...base.threads[0], id: "b", updatedAt: "2026-02-26T09:00:00.000Z" },
      { ...base.threads[0], id: "c", updatedAt: "2026-02-26T08:00:00.000Z" },
    ]);

    expect(sorted.map((t) => t.id)).toEqual(["b", "c", "a"]);
  });

  it("formats thread relative age", () => {
    const now = new Date("2026-02-26T12:00:00.000Z");
    expect(formatThreadAge("2026-02-26T11:59:31.000Z", now)).toBe("now");
    expect(formatThreadAge("2026-02-26T11:47:00.000Z", now)).toBe("13m");
    expect(formatThreadAge("2026-02-26T09:00:00.000Z", now)).toBe("3h");
    expect(formatThreadAge("2026-02-24T12:00:00.000Z", now)).toBe("2d");
  });
});
