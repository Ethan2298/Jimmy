"use client";

import { useEffect, useRef } from "react";
import type { UIMessage } from "ai";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageBubble } from "./message-bubble";

interface ChatContainerProps {
  messages: UIMessage[];
  status: string;
}

export function ChatContainer({ messages, status }: ChatContainerProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <ScrollArea className="flex-1">
      <div className="mx-auto max-w-3xl space-y-4 p-4 pb-8">
        {messages.length === 0 && (
          <div className="flex h-[60vh] items-center justify-center">
            <div className="text-center">
              <h2 className="text-lg font-medium">Marcus</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Your AI sales co-worker. Ask about leads, conversations, or pipeline.
              </p>
            </div>
          </div>
        )}
        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}
        {status === "submitted" && (
          <div className="flex justify-start">
            <div className="bg-muted rounded-2xl px-4 py-3 text-sm text-muted-foreground animate-pulse">
              Marcus is thinking...
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
    </ScrollArea>
  );
}
