"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { createClient } from "@/lib/supabase/client";
import { ChatContainer } from "@/components/chat/chat-container";
import { ChatInput } from "@/components/chat/chat-input";
import type { UIMessage } from "ai";

export default function ChatSessionPage() {
  const { id: sessionId } = useParams<{ id: string }>();
  const [initialMessages, setInitialMessages] = useState<UIMessage[] | null>(null);

  // Load existing messages from Supabase on mount
  useEffect(() => {
    async function loadMessages() {
      const supabase = createClient();
      const { data } = await supabase
        .from("messages")
        .select("*")
        .eq("session_id", sessionId)
        .order("created_at", { ascending: true });

      if (data) {
        const msgs: UIMessage[] = data.map((m, i) => ({
          id: m.id || String(i),
          role: m.role as "user" | "assistant",
          parts: [{ type: "text" as const, text: m.content }],
          createdAt: new Date(m.created_at),
        }));
        setInitialMessages(msgs);
      } else {
        setInitialMessages([]);
      }
    }
    loadMessages();
  }, [sessionId]);

  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({
      api: "/api/chat",
      body: { sessionId },
    }),
    messages: initialMessages || [],
  });

  if (initialMessages === null) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-sm text-muted-foreground animate-pulse">Loading...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <ChatContainer messages={messages} status={status} />
      <ChatInput
        onSend={(text) => sendMessage({ text })}
        disabled={status !== "ready"}
      />
    </div>
  );
}
