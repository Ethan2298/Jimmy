import { useState, useRef, useEffect, useCallback } from "react";
import { ChevronDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ModelOption } from "../../shared/ai-provider";
import claudeLogo from "@/assets/provider-logos/claude.svg";
import openaiLogo from "@/assets/provider-logos/openai.svg";

interface ModelPickerProps {
  value: string;
  options: readonly ModelOption[];
  disabled?: boolean;
  onChange: (model: string) => void;
}

const MENU_CONTAINER_CLASSES =
  "rounded-[12px] border border-white/[0.08] bg-[#171717] p-1 shadow-[0_8px_24px_rgba(0,0,0,0.35),0_2px_8px_rgba(0,0,0,0.2)]";

const MENU_ROW_BASE_CLASSES =
  "h-[28px] w-full rounded-[10px] px-2 text-left text-[14px] transition-[background-color,color] duration-75 ease-out";

const PROVIDER_LOGOS: Partial<Record<ModelOption["provider"], string>> = {
  anthropic: claudeLogo,
  openai: openaiLogo,
};

function formatModelDisplayName(model: string): string {
  if (/^gpt-/i.test(model)) {
    return model
      .replace(/^gpt-/i, "GPT-")
      .replace(/-mini$/i, " Mini")
      .replace(/-nano$/i, " Nano");
  }

  if (/^claude-/i.test(model)) {
    const parts = model.replace(/^claude-/i, "").split("-");
    const formatted: string[] = ["Claude"];

    for (let i = 0; i < parts.length; i += 1) {
      const current = parts[i];
      const next = parts[i + 1];
      if (/^\d+$/.test(current) && /^\d+$/.test(next)) {
        formatted.push(`${current}.${next}`);
        i += 1;
        continue;
      }

      if (current === "sonnet") {
        formatted.push("Sonnet");
        continue;
      }

      if (current === "latest") {
        formatted.push("Latest");
        continue;
      }

      formatted.push(current.toUpperCase());
    }

    return formatted.join(" ");
  }

  return model;
}

export function ModelPicker({ value, options, disabled = false, onChange }: ModelPickerProps) {
  const [open, setOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);
  const active = options.find((option) => option.model === value) ?? options[0];
  const activeLogo = active ? PROVIDER_LOGOS[active.provider] : null;

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (disabled) {
      close();
    }
  }, [disabled, close]);

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
          setOpen((current) => !current);
        }}
        disabled={disabled}
        className={cn(
          "magi-no-drag flex items-center gap-1.5 rounded-full px-3 py-[5px] text-xs font-medium",
          "border border-transparent transition-all duration-150",
          "text-[#b4b4b4] hover:bg-[#2f2f2f] hover:text-[#ececec]",
          open && "bg-[#2f2f2f] border-[#424242] text-[#ececec]",
          disabled && "cursor-not-allowed opacity-50 hover:bg-transparent hover:text-[#b4b4b4]"
        )}
        title="Model"
      >
        {activeLogo && (
          <img
            src={activeLogo}
            alt={active.provider === "anthropic" ? "Claude logo" : "OpenAI logo"}
            className="h-3.5 w-3.5 shrink-0 object-contain invert opacity-90"
          />
        )}
        <span>{active ? formatModelDisplayName(active.model) : "Select model"}</span>
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
          "absolute bottom-[calc(100%+6px)] left-0 min-w-[240px] z-[100]",
          MENU_CONTAINER_CLASSES,
          "transition-all duration-150",
          open
            ? "opacity-100 visible translate-y-0"
            : "opacity-0 invisible translate-y-1"
        )}
      >
        {options.map((option) => {
          const isActive = option.model === value;
          const logo = PROVIDER_LOGOS[option.provider];
          return (
            <button
              key={option.model}
              onClick={() => {
                onChange(option.model);
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
              {logo && (
                <img
                  src={logo}
                  alt={option.provider === "anthropic" ? "Claude logo" : "OpenAI logo"}
                  className="h-3.5 w-3.5 shrink-0 object-contain invert opacity-90"
                />
              )}
              <div className="flex min-w-0 flex-1 overflow-hidden">
                <span className="truncate text-[14px] leading-[1.05]">
                  {formatModelDisplayName(option.model)}
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
