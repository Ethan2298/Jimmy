import { describe, it, expect } from "vitest";
import {
  buildSystemPrompt,
  getToolDisplayLabel,
  getMessagePreview,
  getMessageText,
  getToolPartName,
  isToolMessagePart,
  toPrettyJson,
  type ChatMessage,
} from "../ai";

describe("buildSystemPrompt", () => {
  const ctx = {
    currentDate: "2026-02-25",
    currentTime: "14:32",
    dayOfWeek: "Wednesday",
    permissionMode: "ask" as const,
  };

  it("interpolates date, time, and day into the context block", () => {
    const prompt = buildSystemPrompt(ctx);
    expect(prompt).toContain("Today is Wednesday, 2026-02-25. Time: 14:32.");
  });

  it("contains all required structural sections", () => {
    const prompt = buildSystemPrompt(ctx);
    expect(prompt).toContain("<identity>");
    expect(prompt).toContain("</identity>");
    expect(prompt).toContain("<context>");
    expect(prompt).toContain("</context>");
    expect(prompt).toContain("<outcome_framework>");
    expect(prompt).toContain("</outcome_framework>");
    expect(prompt).toContain("<tools_guidance>");
    expect(prompt).toContain("</tools_guidance>");
    expect(prompt).toContain("<communication>");
    expect(prompt).toContain("</communication>");
    expect(prompt).toContain("<permissions>");
    expect(prompt).toContain("</permissions>");
    expect(prompt).toContain("<examples>");
    expect(prompt).toContain("</examples>");
  });

  it("includes all five outcome framework stages", () => {
    const prompt = buildSystemPrompt(ctx);
    expect(prompt).toContain("**Unclear**");
    expect(prompt).toContain("**Clarifying**");
    expect(prompt).toContain("**Decided**");
    expect(prompt).toContain("**Executing**");
    expect(prompt).toContain("**Done**");
  });

  it("includes tool usage guidance for key tools", () => {
    const prompt = buildSystemPrompt(ctx);
    expect(prompt).toContain("get_overview");
    expect(prompt).toContain("list_tasks");
    expect(prompt).toContain("search_tasks");
  });

  it("includes at least 3 few-shot examples", () => {
    const prompt = buildSystemPrompt(ctx);
    const exampleCount = (prompt.match(/<example>/g) || []).length;
    expect(exampleCount).toBeGreaterThanOrEqual(3);
  });

  it("returns different output for different contexts", () => {
    const prompt1 = buildSystemPrompt(ctx);
    const prompt2 = buildSystemPrompt({
      currentDate: "2026-12-31",
      currentTime: "09:00",
      dayOfWeek: "Thursday",
      permissionMode: "full",
    });
    expect(prompt1).not.toBe(prompt2);
    expect(prompt2).toContain("Thursday, 2026-12-31");
    expect(prompt2).toContain("Time: 09:00");
    expect(prompt1).toContain("Current permission mode: ask");
    expect(prompt2).toContain("Current permission mode: full");
  });
});

describe("ui message helpers", () => {
  it("extracts and compacts text from text parts", () => {
    const message: ChatMessage = {
      id: "m1",
      role: "assistant",
      parts: [
        { type: "text", text: "Hello" },
        { type: "reasoning", text: "hidden" },
        { type: "text", text: " world" },
      ],
    };

    expect(getMessageText(message)).toBe("Hello world");
    expect(getMessagePreview(message)).toBe("Hello world");
  });

  it("detects dynamic and static tool parts", () => {
    const dynamicTool = {
      type: "dynamic-tool",
      toolName: "search_tasks",
      toolCallId: "tc1",
      state: "input-available",
      input: { query: "migrate" },
    } as const;

    const staticTool = {
      type: "tool-get_overview",
      toolCallId: "tc2",
      state: "output-available",
      input: {},
      output: { overdue_count: 2 },
    } as const;

    expect(isToolMessagePart(dynamicTool)).toBe(true);
    expect(isToolMessagePart(staticTool)).toBe(true);
    expect(getToolPartName(dynamicTool)).toBe("search_tasks");
    expect(getToolPartName(staticTool)).toBe("get_overview");
  });

  it("formats json safely", () => {
    expect(toPrettyJson({ ok: true })).toContain('"ok": true');
    expect(toPrettyJson("hello")).toContain("hello");
  });

  it("maps known tool names to concise display labels", () => {
    expect(getToolDisplayLabel("search_tasks")).toBe("Looking up tasks");
    expect(getToolDisplayLabel("get_overview")).toBe("Checking task overview");
    expect(getToolDisplayLabel("update_task")).toBe("Updating task");
  });

  it("falls back to normalized title case labels for unknown tools", () => {
    expect(getToolDisplayLabel("sync_calendar_events")).toBe("Sync Calendar Events");
    expect(getToolDisplayLabel("cleanup-temp-files")).toBe("Cleanup Temp Files");
  });
});
