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
    <div className="px-[26px] pb-4 pt-0 flex justify-center">
      <div className="w-full max-w-[704px] rounded-[16px] border border-white/[0.08] bg-white/[0.03]">
        <div className="px-3.5 pt-3 pb-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            placeholder="Message..."
            rows={1}
            className={cn(
              "w-full bg-transparent text-[14px] leading-5 text-white placeholder:text-white/35",
              "resize-none outline-none max-h-24",
              disabled && "cursor-not-allowed opacity-65"
            )}
            onInput={(e) => {
              const target = e.target as HTMLTextAreaElement;
              target.style.height = "auto";
              target.style.height = `${Math.min(target.scrollHeight, 96)}px`;
            }}
          />
        </div>

        <div className="h-[48px] px-2.5 pb-2 flex items-center">
          <div className="mr-1">
            <ModelPicker
              value={model}
              options={modelOptions}
              disabled={disabled || isStreaming}
              onChange={onModelChange}
            />
          </div>
          <PermissionPicker value={permMode} disabled={disabled} onChange={onPermModeChange} />
          <div className="flex-1" />
          {isStreaming ? (
            <button
              onClick={onCancel}
              className="w-8 h-8 rounded-full flex items-center justify-center bg-white/[0.12] text-white/70 hover:bg-white/[0.18] transition-colors"
              title="Stop (Esc)"
            >
              <Square size={12} fill="currentColor" />
            </button>
          ) : (
            <button
              onClick={onSend}
              disabled={sendDisabled}
              className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center transition-opacity",
                !sendDisabled
                  ? "bg-white text-black opacity-100 hover:opacity-85"
                  : "bg-white text-black opacity-15"
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
