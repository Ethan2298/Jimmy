"use client";

import { memo, useState, useCallback } from "react";
import { isReasoningUIPart, isTextUIPart } from "ai";
import { Copy, Check, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { ToolWhisper } from "./tool-whisper";
import { AiMarkdown } from "./ai-markdown";
import { isToolMessagePart, getMessageText, type ChatMessage } from "@/lib/magi/ai";
import { ReasoningBlock } from "./reasoning-block";

interface MessageProps {
  message: ChatMessage;
  isStreaming?: boolean;
  toolDurationsMs?: Record<string, number>;
  isLast?: boolean;
  onRegenerate?: () => void;
}

export const Message = memo(function Message({
  message,
  isStreaming,
  toolDurationsMs,
  isLast,
  onRegenerate,
}: MessageProps) {
  const isUser = message.role === "user";
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    const text = getMessageText(message);
    if (!text) return;
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [message]);

  return (
    <div className={cn(
      "group relative flex w-full",
      isUser ? "justify-end" : "justify-start",
      isUser && "animate-msg-send",
      !isUser && isStreaming && "animate-msg-enter"
    )}>
      <div className={cn("w-full", isUser ? "max-w-[80%]" : "max-w-[760px]")}>
        {!isUser && (
          <div className="mb-2 flex items-center gap-2 px-1 text-[11px] font-medium uppercase tracking-[0.24em] text-white/28">
            <span>Jimmy</span>
            {isStreaming && <span className="h-1 w-1 rounded-full bg-sky-300/70" />}
          </div>
        )}

        <div
          className={cn(
            "rounded-[20px] px-4 py-3",
            isUser
              ? "border border-white/[0.08] bg-[#171a1f] text-[#f7f8f8] text-[13px] leading-relaxed shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]"
              : "text-[#f7f8f8]"
          )}
        >
          {message.parts.map((part, index) => {
            if (isTextUIPart(part)) {
              return (
                <AiMarkdown
                  key={`text-${index}`}
                  isStreaming={Boolean(isStreaming && part.state === "streaming")}
                >
                  {part.text}
                </AiMarkdown>
              );
            }

            if (isReasoningUIPart(part)) {
              return (
                <ReasoningBlock
                  key={`reasoning-${index}`}
                  reasoning={part.text}
                  isStreaming={part.state === "streaming"}
                />
              );
            }

            if (part.type === "step-start") {
              return null;
            }

            if (isToolMessagePart(part)) {
              return (
                <div key={part.toolCallId} className="my-1.5">
                  <ToolWhisper
                    part={part}
                    durationMs={toolDurationsMs?.[part.toolCallId]}
                  />
                </div>
              );
            }

            return null;
          })}
        </div>
      </div>
      {!isUser && !isStreaming && (
        <div className="absolute right-0 top-1 flex gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
          {isLast && onRegenerate && (
            <button
              onClick={onRegenerate}
              className="p-1 rounded text-white/30 hover:text-white/60"
              title="Regenerate"
            >
              <RefreshCw size={14} />
            </button>
          )}
          <button
            onClick={handleCopy}
            className="p-1 rounded text-white/30 hover:text-white/60"
            title={copied ? "Copied" : "Copy"}
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
          </button>
        </div>
      )}
    </div>
  );
});
