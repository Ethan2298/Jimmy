import { describe, expect, it } from "vitest";
import {
  buildMissingApiKeyError,
  resolveApiKeyForProvider,
} from "../chat-key-resolution";

describe("chat key resolution", () => {
  const baseRequest = {
    apiKey: undefined,
    apiKeys: undefined,
  } as const;

  it("uses provider-specific override key first", () => {
    const resolved = resolveApiKeyForProvider({
      request: {
        ...baseRequest,
        apiKey: "legacy-key",
        apiKeys: { openai: "openai-override" },
      },
      provider: "openai",
      storedKey: "stored-key",
      env: { OPENAI_API_KEY: "env-key" },
    });
    expect(resolved).toBe("openai-override");
  });

  it("falls back to legacy request key before stored/env", () => {
    const resolved = resolveApiKeyForProvider({
      request: { ...baseRequest, apiKey: "legacy-key" },
      provider: "openai",
      storedKey: "stored-key",
      env: { OPENAI_API_KEY: "env-key" },
    });
    expect(resolved).toBe("legacy-key");
  });

  it("uses stored key before environment fallback", () => {
    const resolved = resolveApiKeyForProvider({
      request: baseRequest,
      provider: "openai",
      storedKey: "stored-key",
      env: { OPENAI_API_KEY: "env-key" },
    });
    expect(resolved).toBe("stored-key");
  });

  it("uses provider-specific environment fallback", () => {
    const openai = resolveApiKeyForProvider({
      request: baseRequest,
      provider: "openai",
      storedKey: null,
      env: { OPENAI_API_KEY: "openai-env" },
    });
    expect(openai).toBe("openai-env");

    const anthropic = resolveApiKeyForProvider({
      request: baseRequest,
      provider: "anthropic",
      storedKey: null,
      env: { ANTHROPIC_API_KEY: "anthropic-env" },
    });
    expect(anthropic).toBe("anthropic-env");
  });

  it("returns null when no key is available", () => {
    const resolved = resolveApiKeyForProvider({
      request: baseRequest,
      provider: "openai",
      storedKey: null,
      env: {},
    });
    expect(resolved).toBeNull();
  });

  it("builds provider-specific missing-key errors", () => {
    expect(buildMissingApiKeyError("openai")).toBe(
      "Error [auth]: Missing OpenAI API key. Add one in Settings."
    );
    expect(buildMissingApiKeyError("anthropic")).toBe(
      "Error [auth]: Missing Anthropic API key. Add one in Settings."
    );
  });
});
