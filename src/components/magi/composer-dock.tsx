"use client";

import { useCallback, useEffect, useRef } from "react";
import { ArrowUp, Square } from "lucide-react";
import { ModelPicker } from "./model-picker";
import { PermissionPicker, type PermissionMode } from "./permission-picker";
import { cn } from "@/lib/utils";
import type { ModelOption } from "@/lib/magi/ai-provider";

interface ComposerDockProps {
  input: string;
  isStreaming: boolean;
  disabled?: boolean;
  permMode: PermissionMode;
  model: string;
  modelOptions: readonly ModelOption[];
  onInputChange: (value: string) => void;
  onPermModeChange: (mode: PermissionMode) => void;
  onModelChange: (model: string) => void;
  onSend: () => void;
  onCancel?: () => void;
}

export function ComposerDock({
  input,
  isStreaming,
  disabled = false,
  permMode,
  model,
  modelOptions,
  onInputChange,
  onPermModeChange,
  onModelChange,
  onSend,
  onCancel,
}: ComposerDockProps) {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const sendDisabled = disabled || !input.trim() || isStreaming;

  useEffect(() => {
    if (disabled) return;
    inputRef.current?.focus();
  }, [disabled]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (disabled) return;
      if (e.key === "Escape" && isStreaming && onCancel) {
        e.preventDefault();
        onCancel();
        return;
      }
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        onSend();
      }
    },
    [disabled, isStreaming, onCancel, onSend]
  );

  return (
    <div className="flex justify-center px-5 pb-5 pt-3">
      <div className="relative w-full max-w-[760px] overflow-hidden rounded-[24px] border border-white/[0.08] bg-[#0d1014]/92 shadow-[0_12px_40px_rgba(0,0,0,0.28)]">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-[radial-gradient(circle_at_top,rgba(161,202,255,0.12),transparent_72%)]" />
        <div className="relative px-4 pt-4 pb-3">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            placeholder="Ask Jimmy to debug, build, explain, or review code..."
            rows={3}
            className={cn(
              "min-h-[96px] w-full resize-none bg-transparent text-[15px] leading-6 text-white placeholder:text-white/28 outline-none",
              "max-h-[220px]",
              disabled && "cursor-not-allowed opacity-65"
            )}
            onInput={(e) => {
              const target = e.target as HTMLTextAreaElement;
              target.style.height = "auto";
              target.style.height = `${Math.min(target.scrollHeight, 220)}px`;
            }}
          />
        </div>

        <div className="relative flex min-h-[58px] items-center gap-2 border-t border-white/[0.06] px-3 py-3">
          <div>
            <ModelPicker
              value={model}
              options={modelOptions}
              disabled={disabled || isStreaming}
              onChange={onModelChange}
            />
          </div>
          <PermissionPicker value={permMode} disabled={disabled} onChange={onPermModeChange} />
          <p className="hidden flex-1 text-[11px] text-white/30 md:block">
            Enter to send. Shift+Enter for a newline.
          </p>
          <div className="flex-1 md:hidden" />
          {isStreaming ? (
            <button
              onClick={onCancel}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.08] text-white/75 transition-colors hover:bg-white/[0.14]"
              title="Stop (Esc)"
            >
              <Square size={12} fill="currentColor" />
            </button>
          ) : (
            <button
              onClick={onSend}
              disabled={sendDisabled}
              className={cn(
                "flex h-10 w-10 items-center justify-center rounded-full border transition-all",
                !sendDisabled
                  ? "border-transparent bg-white text-black opacity-100 hover:scale-[0.98] hover:opacity-90"
                  : "border-white/[0.06] bg-white/[0.08] text-white/28"
              )}
              title="Send"
            >
              <ArrowUp size={16} strokeWidth={2.5} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
