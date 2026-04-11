"use client";

import type { UIMessage } from "ai";
import { isToolUIPart } from "ai";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

export function MessageBubble({ message }: { message: UIMessage }) {
  const isUser = message.role === "user";

  return (
    <div className={cn("flex w-full", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed",
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-foreground",
        )}
      >
        {message.parts.map((part, i) => {
          if (part.type === "text") {
            return (
              <p key={i} className="whitespace-pre-wrap">
                {part.text}
              </p>
            );
          }
          if (isToolUIPart(part)) {
            const toolName = part.type.replace("tool-", "");
            return (
              <div key={i} className="mt-2 flex items-center gap-2">
                <Badge variant="secondary" className="text-xs">
                  {toolName}
                </Badge>
                {part.state === "input-streaming" && (
                  <span className="text-xs text-muted-foreground animate-pulse">
                    running...
                  </span>
                )}
              </div>
            );
          }
          return null;
        })}
      </div>
    </div>
  );
}
