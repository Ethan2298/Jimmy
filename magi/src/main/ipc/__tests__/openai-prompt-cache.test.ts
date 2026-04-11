import { describe, expect, it } from "vitest";
import { buildOpenAIPromptCacheKey } from "../openai-prompt-cache";

describe("openai prompt cache key", () => {
  it("returns undefined when thread id is missing", () => {
    expect(
      buildOpenAIPromptCacheKey({
        model: "gpt-5",
        systemPrompt: "system prompt",
      })
    ).toBeUndefined();
  });

  it("is deterministic for the same input", () => {
    const a = buildOpenAIPromptCacheKey({
      model: "gpt-5",
      systemPrompt: "system prompt",
      threadId: "thread-1",
    });
    const b = buildOpenAIPromptCacheKey({
      model: "gpt-5",
      systemPrompt: "system prompt",
      threadId: "thread-1",
    });
    expect(a).toBe(b);
  });

  it("changes with model, thread, or system prompt", () => {
    const base = buildOpenAIPromptCacheKey({
      model: "gpt-5",
      systemPrompt: "system prompt",
      threadId: "thread-1",
    });
    const differentModel = buildOpenAIPromptCacheKey({
      model: "gpt-4.1",
      systemPrompt: "system prompt",
      threadId: "thread-1",
    });
    const differentThread = buildOpenAIPromptCacheKey({
      model: "gpt-5",
      systemPrompt: "system prompt",
      threadId: "thread-2",
    });
    const differentSystem = buildOpenAIPromptCacheKey({
      model: "gpt-5",
      systemPrompt: "different system prompt",
      threadId: "thread-1",
    });

    expect(base).not.toBe(differentModel);
    expect(base).not.toBe(differentThread);
    expect(base).not.toBe(differentSystem);
  });

  it("always stays within OpenAI max length (64)", () => {
    const key = buildOpenAIPromptCacheKey({
      model: "gpt-5",
      systemPrompt: "x".repeat(2000),
      threadId: "thread-with-a-very-long-id-".repeat(6),
    });
    expect(key).toBeDefined();
    expect((key as string).length).toBeLessThanOrEqual(64);
  });
});
