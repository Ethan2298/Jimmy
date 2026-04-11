import { memo, useState, useCallback } from "react";
import { isReasoningUIPart, isTextUIPart } from "ai";
import { Copy, Check, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { ToolWhisper } from "./tool-whisper";
import { AiMarkdown } from "./ai-markdown";
import { isToolMessagePart, getMessageText, type ChatMessage } from "@/lib/ai";
import { ReasoningBlock } from "./reasoning-block";

interface MessageProps {
  message: ChatMessage;
  isStreaming?: boolean;
  pendingApprovals?: Record<string, {
    approvalId: string;
    destructive: boolean;
    reason: string;
    resolving?: boolean;
  }>;
  onResolveApproval?: (approvalId: string, approved: boolean) => void;
  toolDurationsMs?: Record<string, number>;
  isLast?: boolean;
  onRegenerate?: () => void;
}

export const Message = memo(function Message({
  message,
  isStreaming,
  pendingApprovals,
  onResolveApproval,
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
      "group relative flex",
      isUser ? "justify-end" : "justify-start",
      isUser && "animate-msg-send",
      !isUser && isStreaming && "animate-msg-enter"
    )}>
      <div
        className={cn(
          "max-w-[88%] rounded-lg px-3 py-2",
          isUser
            ? "bg-user-bubble text-foreground text-[13px] leading-relaxed"
            : "text-foreground"
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
                reasoning={part.reasoning}
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
                  approval={pendingApprovals?.[part.toolCallId]}
                  onResolveApproval={onResolveApproval}
                  durationMs={toolDurationsMs?.[part.toolCallId]}
                />
              </div>
            );
          }

          return null;
        })}

      </div>
      {!isUser && !isStreaming && (
        <div className="absolute top-1 right-0 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
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
