import type { AIProvider } from "../../shared/ai-provider";

type Message = {
  role: string;
  [key: string]: unknown;
};
type MessageWithCache<T extends Message> = T & {
  providerOptions?: {
    anthropic: { cacheControl: { type: "ephemeral" } };
  };
};

export function addCacheBreakpoints<T extends Message>(
  messages: T[],
  provider: AIProvider
): MessageWithCache<T>[] {
  if (provider !== "anthropic") return messages;

  let userCount = 0;
  let targetIndex = -1;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === "user") {
      userCount++;
      if (userCount === 2) {
        targetIndex = i;
        break;
      }
    }
  }
  if (targetIndex === -1) return messages;
  return messages.map((m, i) =>
    i === targetIndex
      ? {
          ...m,
          providerOptions: {
            anthropic: { cacheControl: { type: "ephemeral" as const } },
          },
        }
      : m
  );
}
