import { describe, it, expect } from "vitest";
import { addCacheBreakpoints } from "../cache-breakpoints";

describe("addCacheBreakpoints", () => {
  const cacheMarker = {
    anthropic: { cacheControl: { type: "ephemeral" } },
  };

  it("returns original array when fewer than 2 user messages", () => {
    const messages = [
      { role: "user" as const, content: "hello" },
      { role: "assistant" as const, content: "hi" },
    ];
    const result = addCacheBreakpoints(messages, "anthropic");
    expect(result).toBe(messages); // same reference
  });

  it("returns original array when 0 messages", () => {
    const messages: { role: "user" | "assistant"; content: string }[] = [];
    const result = addCacheBreakpoints(messages, "anthropic");
    expect(result).toBe(messages);
  });

  it("marks the 2nd-to-last user message with cache breakpoint", () => {
    const messages = [
      { role: "user" as const, content: "first" },
      { role: "assistant" as const, content: "reply1" },
      { role: "user" as const, content: "second" },
      { role: "assistant" as const, content: "reply2" },
    ];
    const result = addCacheBreakpoints(messages, "anthropic");
    expect(result).toHaveLength(4);
    // Index 0 is the 2nd-to-last user message
    expect((result[0] as any).providerOptions).toEqual(cacheMarker);
    // Other messages should not have providerOptions
    expect((result[1] as any).providerOptions).toBeUndefined();
    expect((result[2] as any).providerOptions).toBeUndefined();
    expect((result[3] as any).providerOptions).toBeUndefined();
  });

  it("handles exactly 2 user messages", () => {
    const messages = [
      { role: "user" as const, content: "first" },
      { role: "user" as const, content: "second" },
    ];
    const result = addCacheBreakpoints(messages, "anthropic");
    expect((result[0] as any).providerOptions).toEqual(cacheMarker);
    expect((result[1] as any).providerOptions).toBeUndefined();
  });

  it("handles many messages — always marks 2nd-to-last user", () => {
    const messages = [
      { role: "user" as const, content: "msg1" },
      { role: "assistant" as const, content: "r1" },
      { role: "user" as const, content: "msg2" },
      { role: "assistant" as const, content: "r2" },
      { role: "user" as const, content: "msg3" },
      { role: "assistant" as const, content: "r3" },
      { role: "user" as const, content: "msg4" },
    ];
    const result = addCacheBreakpoints(messages, "anthropic");
    // 2nd-to-last user is "msg3" at index 4
    expect((result[4] as any).providerOptions).toEqual(cacheMarker);
    // All others should not have it
    for (let i = 0; i < result.length; i++) {
      if (i !== 4) {
        expect((result[i] as any).providerOptions).toBeUndefined();
      }
    }
  });

  it("does not mutate the original messages", () => {
    const messages = [
      { role: "user" as const, content: "first" },
      { role: "assistant" as const, content: "reply" },
      { role: "user" as const, content: "second" },
    ];
    const original = messages.map((m) => ({ ...m }));
    addCacheBreakpoints(messages, "anthropic");
    expect(messages).toEqual(original);
  });

  it("preserves content and role on the marked message", () => {
    const messages = [
      { role: "user" as const, content: "keep this content" },
      { role: "assistant" as const, content: "reply" },
      { role: "user" as const, content: "latest" },
    ];
    const result = addCacheBreakpoints(messages, "anthropic");
    expect(result[0].content).toBe("keep this content");
    expect(result[0].role).toBe("user");
  });

  it("handles consecutive user messages correctly", () => {
    const messages = [
      { role: "user" as const, content: "first" },
      { role: "user" as const, content: "second" },
      { role: "user" as const, content: "third" },
    ];
    const result = addCacheBreakpoints(messages, "anthropic");
    // 2nd-to-last user is "second" at index 1
    expect((result[1] as any).providerOptions).toEqual(cacheMarker);
    expect((result[0] as any).providerOptions).toBeUndefined();
    expect((result[2] as any).providerOptions).toBeUndefined();
  });

  it("handles single assistant message between many user messages", () => {
    const messages = [
      { role: "user" as const, content: "a" },
      { role: "user" as const, content: "b" },
      { role: "assistant" as const, content: "reply" },
      { role: "user" as const, content: "c" },
    ];
    const result = addCacheBreakpoints(messages, "anthropic");
    // 2nd-to-last user is "b" at index 1
    expect((result[1] as any).providerOptions).toEqual(cacheMarker);
  });

  it("does not apply cache breakpoints for openai", () => {
    const messages = [
      { role: "user" as const, content: "first" },
      { role: "assistant" as const, content: "reply1" },
      { role: "user" as const, content: "second" },
    ];
    const result = addCacheBreakpoints(messages, "openai");
    expect(result).toBe(messages);
    expect((result[0] as any).providerOptions).toBeUndefined();
    expect((result[1] as any).providerOptions).toBeUndefined();
    expect((result[2] as any).providerOptions).toBeUndefined();
  });
});
