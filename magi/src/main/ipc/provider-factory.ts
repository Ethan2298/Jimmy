import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import type { ModelMessage } from "ai";
import type { AIProvider } from "../../shared/ai-provider";

export type ProviderRuntime = {
  model: unknown;
  system: string;
  messages: ModelMessage[];
};

export function createProviderRuntime(params: {
  provider: AIProvider;
  model: string;
  apiKey: string;
  systemPrompt: string;
  messages: ModelMessage[];
}): ProviderRuntime {
  if (params.provider === "anthropic") {
    const anthropic = createAnthropic({ apiKey: params.apiKey });
    return {
      model: anthropic(params.model),
      system: params.systemPrompt,
      messages: params.messages,
    };
  }

  const openai = createOpenAI({ apiKey: params.apiKey });
  return {
    model: openai(params.model),
    system: params.systemPrompt,
    messages: params.messages,
  };
}
