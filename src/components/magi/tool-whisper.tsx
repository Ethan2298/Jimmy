"use client";

import { useMemo, useState } from "react";
import { getToolPartName, toPrettyJson, type ToolMessagePart } from "@/lib/magi/ai";
import { cn } from "@/lib/utils";

interface ToolWhisperProps {
  part: ToolMessagePart;
  durationMs?: number;
}

type StatusTone = "running" | "done" | "failed";

function formatDuration(durationMs?: number): string | null {
  if (durationMs === undefined) return null;
  if (durationMs < 1000) return `${durationMs}ms`;
  return `${(durationMs / 1000).toFixed(1)}s`;
}

function toneClass(tone: StatusTone): string {
  if (tone === "running") return "text-blue-200";
  if (tone === "done") return "text-emerald-200";
  return "text-red-200";
}

function resolveTone(part: ToolMessagePart): StatusTone {
  if ("state" in part) {
    if (part.state === "output-available") return "done";
    if (part.state === "output-error" || part.state === "output-denied") return "failed";
  }
  return "running";
}

function resolveLine(part: ToolMessagePart): string {
  const toolName = getToolPartName(part);
  const tone = resolveTone(part);
  if (tone === "running") return `Running ${toolName}...`;
  if (tone === "failed") return `${toolName} failed`;
  return `${toolName} completed`;
}

export function ToolWhisper({ part, durationMs }: ToolWhisperProps) {
  const [showDetails, setShowDetails] = useState(false);
  const tone = resolveTone(part);
  const line = resolveLine(part);

  const rawPayload = useMemo(() => {
    const payload: Record<string, unknown> = {};
    if ("input" in part) payload.input = part.input;
    if ("output" in part) payload.output = part.output;
    return toPrettyJson(payload);
  }, [part]);

  return (
    <div className="text-[12px] leading-snug text-white/55">
      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
        <span className={cn("font-medium", toneClass(tone))}>{line}</span>
        {formatDuration(durationMs) && (
          <>
            <span className="text-white/30">·</span>
            <span className="text-white/40">{formatDuration(durationMs)}</span>
          </>
        )}
        <span className="text-white/30">·</span>
        <button
          onClick={() => setShowDetails((v) => !v)}
          className="text-[11px] text-white/45 underline-offset-2 hover:text-white/70 hover:underline"
        >
          {showDetails ? "hide details" : "details"}
        </button>
      </div>

      {showDetails && (
        <pre className="mt-1 overflow-x-auto whitespace-pre-wrap break-words text-[11px] text-white/45">
          {rawPayload}
        </pre>
      )}
    </div>
  );
}
