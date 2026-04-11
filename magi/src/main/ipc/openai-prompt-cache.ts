import { createHash } from "node:crypto";

export function buildOpenAIPromptCacheKey(params: {
  model: string;
  systemPrompt: string;
  threadId?: string;
}): string | undefined {
  const threadId = params.threadId?.trim();
  if (!threadId) return undefined;

  const digest = createHash("sha256")
    .update(params.model)
    .update("\n")
    .update(threadId)
    .update("\n")
    .update(params.systemPrompt)
    .digest("hex");

  // OpenAI prompt_cache_key max length is 64 chars.
  return `oa:v1:${digest.slice(0, 56)}`;
}
