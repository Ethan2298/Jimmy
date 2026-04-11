import type { AIProvider } from "../../shared/ai-provider";
import type { ChatRequest } from "./chat-request-schema";

type EnvApiKeys = {
  [key: string]: string | null | undefined;
  OPENAI_API_KEY?: string | null;
  ANTHROPIC_API_KEY?: string | null;
};

function trimOrNull(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export function getProviderLabel(provider: AIProvider): string {
  return provider === "openai" ? "OpenAI" : "Anthropic";
}

export function resolveApiKeyForProvider(params: {
  request: Pick<ChatRequest, "apiKey" | "apiKeys">;
  provider: AIProvider;
  storedKey: string | null;
  env?: EnvApiKeys;
}): string | null {
  const overrideFromMap = trimOrNull(params.request.apiKeys?.[params.provider]);
  if (overrideFromMap) return overrideFromMap;

  const overrideFromLegacyField = trimOrNull(params.request.apiKey);
  if (overrideFromLegacyField) return overrideFromLegacyField;

  const stored = trimOrNull(params.storedKey);
  if (stored) return stored;

  const env = params.env ?? process.env;
  return params.provider === "openai"
    ? trimOrNull(env.OPENAI_API_KEY)
    : trimOrNull(env.ANTHROPIC_API_KEY);
}

export function buildMissingApiKeyError(provider: AIProvider): string {
  return `Error [auth]: Missing ${getProviderLabel(provider)} API key. Add one in Settings.`;
}
