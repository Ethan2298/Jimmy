export interface ChatRequest {
  apiKey: string;
  systemPrompt: string;
  messages: { role: "user" | "assistant"; content: string }[];
  tools: unknown[];
}

export interface ChatResponse {
  streamId: string;
  toolCalls: { name: string; input: Record<string, unknown> }[];
  error?: string;
}

declare global {
  interface Window {
    api: {
      platform: string;
      windowMinimize: () => void;
      windowMaximize: () => void;
      windowClose: () => void;
      chat: (request: ChatRequest) => Promise<ChatResponse>;
      getApiKey: () => Promise<string | null>;
      setApiKey: (key: string) => Promise<{ ok: boolean; error?: string }>;
      onChatStreamDelta: (streamId: string, cb: (text: string) => void) => void;
      onChatStreamDone: (streamId: string, cb: () => void) => void;
      onChatStreamError: (streamId: string, cb: (error: string) => void) => void;
      offChatStream: (streamId: string) => void;
      loadData: () => Promise<string | null>;
      saveData: (json: string) => Promise<void>;
    };
  }
}
