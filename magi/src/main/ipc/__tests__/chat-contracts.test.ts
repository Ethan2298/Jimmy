import { describe, expect, it } from "vitest";
import {
  parseApprovalEventPayload,
  parseStatusEventPayload,
  parseStreamChunkPayload,
} from "../chat-contracts";
import { chatRequestSchema } from "../chat-request-schema";
import { isValidModelForProvider } from "../../../shared/ai-provider";

describe("chat contracts", () => {
  it("accepts valid UI message chunks", async () => {
    expect(
      await parseStreamChunkPayload({ type: "text-delta", id: "t1", delta: "hello" })
    ).toEqual({ type: "text-delta", id: "t1", delta: "hello" });

    expect(
      await parseStreamChunkPayload({
        type: "tool-input-available",
        toolName: "search_tasks",
        toolCallId: "tc1",
        input: { query: "migration" },
      })
    ).toEqual({
      type: "tool-input-available",
      toolName: "search_tasks",
      toolCallId: "tc1",
      input: { query: "migration" },
    });

    expect(
      await parseStreamChunkPayload({
        type: "reasoning-delta",
        id: "r1",
        delta: "thinking",
      })
    ).toEqual({
      type: "reasoning-delta",
      id: "r1",
      delta: "thinking",
    });
  });

  it("rejects malformed stream chunks", async () => {
    await expect(
      parseStreamChunkPayload({ type: "tool-input-available", toolName: "x" })
    ).rejects.toThrow(/Invalid stream chunk payload/);
  });

  it("accepts valid approval payloads", () => {
    expect(
      parseApprovalEventPayload({
        type: "tool-approval-requested",
        approvalId: "a1",
        toolCallId: "tc1",
        toolName: "create_task",
        args: { title: "x" },
        destructive: false,
        reason: "Needs approval",
      })
    ).toEqual({
      type: "tool-approval-requested",
      approvalId: "a1",
      toolCallId: "tc1",
      toolName: "create_task",
      args: { title: "x" },
      destructive: false,
      reason: "Needs approval",
    });
  });

  it("accepts valid status payloads", () => {
    expect(
      parseStatusEventPayload({
        type: "status-update",
        phase: "waiting-approval",
        label: "Waiting for approval",
        toolName: "update_task",
        toolCallId: "tc1",
      })
    ).toEqual({
      type: "status-update",
      phase: "waiting-approval",
      label: "Waiting for approval",
      toolName: "update_task",
      toolCallId: "tc1",
    });
  });

  it("rejects malformed status payloads", () => {
    expect(() =>
      parseStatusEventPayload({
        type: "status-update",
        phase: "running",
        label: "",
      })
    ).toThrow(/Invalid status event payload/);
  });

  it("validates provider/model request fields", () => {
    const valid = chatRequestSchema.safeParse({
      provider: "openai",
      model: "gpt-5",
      systemPrompt: "sys",
      permissionMode: "ask",
      meta: { threadId: "thread-1", requestId: "req-1" },
      messages: [{ id: "1", role: "user", parts: [{ type: "text", text: "hello" }] }],
    });
    expect(valid.success).toBe(true);
    if (valid.success) {
      expect(isValidModelForProvider("openai", valid.data.model)).toBe(true);
    }

    const mismatch = chatRequestSchema.safeParse({
      provider: "openai",
      model: "claude-sonnet-4-6",
      systemPrompt: "sys",
      permissionMode: "ask",
      messages: [{ id: "1", role: "user", parts: [{ type: "text", text: "hello" }] }],
    });
    expect(mismatch.success).toBe(true);
    if (mismatch.success) {
      expect(isValidModelForProvider("openai", mismatch.data.model)).toBe(false);
    }

    expect(
      chatRequestSchema.safeParse({
        provider: "anthropic",
        model: "",
        systemPrompt: "sys",
        permissionMode: "ask",
      messages: [{ id: "1", role: "user", parts: [{ type: "text", text: "hello" }] }],
    }).success
    ).toBe(false);
  });
});
