import { useState, useRef, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Message } from "./message";
import { ArrowUp } from "lucide-react";
import type { ChatMessage } from "@/lib/ai";
import { PermissionPicker, type PermissionMode } from "./permission-picker";

interface MagiChatProps {
  className?: string;
  messages: ChatMessage[];
  isStreaming: boolean;
  streamingMessage?: ChatMessage | null;
  onSend: (text: string) => void;
}

export function MagiChat({
  className,
  messages,
  isStreaming,
  streamingMessage,
  onSend,
}: MagiChatProps) {
  const [input, setInput] = useState("");
  const [permMode, setPermMode] = useState<PermissionMode>("ask");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll on new messages or streaming text
  useEffect(() => {
    const el = scrollRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages.length, streamingMessage]);

  // Focus input when chat opens
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSend = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed || isStreaming) return;
    onSend(trimmed);
    setInput("");
  }, [input, isStreaming, onSend]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  return (
    <div className={cn("flex flex-col overflow-hidden", className)}>
      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-3 py-3 space-y-3"
      >
        {messages.length === 0 && !isStreaming && (
          <p className="text-center text-muted-foreground text-[13px] py-8">
            Ask anything
          </p>
        )}

        {messages.map((msg) => (
          <Message key={msg.id} message={msg} />
        ))}

        {isStreaming && (
          <Message
            message={
              streamingMessage ?? { id: "streaming-placeholder", role: "assistant", parts: [] }
            }
            isStreaming
          />
        )}
      </div>

      {/* Input */}
      <div className="px-3 pb-3 pt-1">
        <div className="rounded-2xl bg-white/[0.04] border border-white/[0.06]">
          {/* Textarea */}
          <div className="px-3 pt-3">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Message..."
              rows={1}
              className={cn(
                "w-full bg-transparent text-[13px] text-foreground placeholder:text-muted-foreground/50",
                "resize-none outline-none max-h-24"
              )}
              style={{
                height: "auto",
                minHeight: "20px",
              }}
              onInput={(e) => {
                const target = e.target as HTMLTextAreaElement;
                target.style.height = "auto";
                target.style.height = Math.min(target.scrollHeight, 96) + "px";
              }}
            />
          </div>
          {/* Bottom bar */}
          <div className="flex items-center px-3 py-2">
            <PermissionPicker value={permMode} onChange={setPermMode} />
            <div className="flex-1" />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isStreaming}
              className={cn(
                "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ml-1 transition-opacity",
                input.trim() && !isStreaming
                  ? "bg-foreground text-background opacity-100 cursor-pointer hover:opacity-85"
                  : "bg-foreground text-background opacity-10 cursor-default"
              )}
            >
              <ArrowUp size={16} strokeWidth={2.5} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
