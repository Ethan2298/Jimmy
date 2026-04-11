"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Hand, Pencil, ChevronsRight, ChevronDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";

export type PermissionMode = "ask" | "edits" | "full";

interface PermissionPickerProps {
  value: PermissionMode;
  disabled?: boolean;
  onChange: (mode: PermissionMode) => void;
}

const modes = [
  {
    id: "ask" as const,
    label: "Ask",
    description: "Confirm before acting",
    icon: Hand,
  },
  {
    id: "edits" as const,
    label: "Edits",
    description: "Auto-approve file edits",
    icon: Pencil,
  },
  {
    id: "full" as const,
    label: "Full",
    description: "Auto-approve everything",
    icon: ChevronsRight,
  },
];

const MENU_CONTAINER_CLASSES =
  "rounded-[12px] border border-white/[0.08] bg-[#171717] p-1 shadow-[0_8px_24px_rgba(0,0,0,0.35),0_2px_8px_rgba(0,0,0,0.2)]";

const MENU_ROW_BASE_CLASSES =
  "h-[28px] w-full rounded-[10px] px-2 text-left text-[14px] transition-[background-color,color] duration-75 ease-out";

export function PermissionPicker({ value, disabled = false, onChange }: PermissionPickerProps) {
  const [open, setOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);
  const active = modes.find((m) => m.id === value)!;
  const ActiveIcon = active.icon;

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (disabled) close();
  }, [close, disabled]);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        close();
      }
    }
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [open, close]);

  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, close]);

  return (
    <div ref={pickerRef} className="relative">
      <button
        onClick={(e) => {
          e.stopPropagation();
          if (disabled) return;
          setOpen((o) => !o);
        }}
        disabled={disabled}
        className={cn(
          "flex items-center gap-1.5 rounded-full px-3 py-[5px] text-xs font-medium",
          "border border-transparent transition-all duration-150",
          "text-[#b4b4b4] hover:bg-[#2f2f2f] hover:text-[#ececec]",
          open && "bg-[#2f2f2f] border-[#424242] text-[#ececec]",
          disabled && "cursor-not-allowed opacity-50 hover:bg-transparent hover:text-[#b4b4b4]"
        )}
      >
        <ActiveIcon size={16} className="shrink-0" />
        <span>{active.label}</span>
        <ChevronDown
          size={12}
          className={cn(
            "text-[#8e8e8e] transition-transform duration-200",
            open && "rotate-180"
          )}
        />
      </button>

      <div
        className={cn(
          "absolute bottom-[calc(100%+6px)] left-0 min-w-[200px] z-[100]",
          MENU_CONTAINER_CLASSES,
          "transition-all duration-150",
          open
            ? "opacity-100 visible translate-y-0"
            : "opacity-0 invisible translate-y-1"
        )}
      >
        {modes.map((mode) => {
          const Icon = mode.icon;
          const isActive = mode.id === value;
          return (
            <button
              key={mode.id}
              onClick={() => {
                onChange(mode.id);
                close();
              }}
              className={cn(
                "flex items-center gap-2",
                MENU_ROW_BASE_CLASSES,
                isActive
                  ? "bg-white/[0.06] text-white"
                  : "text-[#C5CACF] hover:bg-white/[0.04] hover:text-white"
              )}
            >
              <div
                className={cn(
                  "flex h-[20px] w-[20px] shrink-0 items-center justify-center rounded-[6px]",
                  isActive ? "bg-white/[0.14] text-white" : "bg-white/[0.06] text-[#C5CACF]"
                )}
              >
                <Icon size={12} />
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-px overflow-hidden">
                <span className="truncate text-[14px] leading-[1.05]">{mode.label}</span>
                <span className="truncate text-[11px] leading-[1.05] text-[#8F959B]">
                  {mode.description}
                </span>
              </div>
              <Check
                size={16}
                strokeWidth={2.5}
                className={cn("shrink-0", isActive ? "opacity-100" : "opacity-0")}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}
