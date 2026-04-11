"use client";

import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface ReasoningBlockProps {
  reasoning: string;
  isStreaming: boolean;
}

export function ReasoningBlock({ reasoning, isStreaming }: ReasoningBlockProps) {
  const [expanded, setExpanded] = useState(isStreaming);

  return (
    <div className="my-1">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-1 text-[12px] text-white/35 hover:text-white/50 transition-colors"
      >
        <ChevronRight
          size={12}
          className={cn("transition-transform", expanded && "rotate-90")}
        />
        <span>{isStreaming ? "Thinking..." : "Thought"}</span>
      </button>
      {expanded && (
        <div className="mt-1 pl-3 border-l-2 border-white/[0.08] text-[12px] leading-relaxed text-white/35 italic whitespace-pre-wrap">
          {reasoning}
        </div>
      )}
    </div>
  );
}
