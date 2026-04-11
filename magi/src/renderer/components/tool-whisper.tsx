import { useMemo, useState } from "react";
import {
  getToolPartName,
  toPrettyJson,
  type ToolMessagePart,
} from "@/lib/ai";
import { cn } from "@/lib/utils";
import { resolveToolFeedback } from "@/lib/tool-feedback/resolve";

interface ToolWhisperProps {
  part: ToolMessagePart;
  approval?: {
    approvalId: string;
    destructive: boolean;
    reason: string;
    resolving?: boolean;
  };
  onResolveApproval?: (approvalId: string, approved: boolean) => void;
  durationMs?: number;
}

type StatusTone = "running" | "done" | "failed" | "approval";

function formatDuration(durationMs?: number): string | null {
  if (durationMs === undefined) return null;
  if (durationMs < 1000) return `${durationMs}ms`;
  return `${(durationMs / 1000).toFixed(1)}s`;
}

function toneClass(tone: StatusTone): string {
  if (tone === "running") return "text-blue-200";
  if (tone === "done") return "text-emerald-200";
  if (tone === "failed") return "text-red-200";
  return "text-amber-200";
}

export function ToolWhisper({
  part,
  approval,
  onResolveApproval,
  durationMs,
}: ToolWhisperProps) {
  const [showDetails, setShowDetails] = useState(false);
  const toolName = getToolPartName(part);
  const feedback = useMemo(
    () =>
      resolveToolFeedback({
        part,
        approval,
        durationMs,
        toolName,
      }),
    [approval, durationMs, part, toolName]
  );

  const rawPayload = useMemo(() => {
    return toPrettyJson(feedback.debugPayload ?? {});
  }, [feedback.debugPayload]);

  return (
    <div className="text-[12px] leading-snug text-white/55">
      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
        <span className={cn("font-medium", toneClass(feedback.tone))}>{feedback.line}</span>
        {formatDuration(durationMs) && (
          <>
            <span className="text-white/30">·</span>
            <span className="text-white/40">{formatDuration(durationMs)}</span>
          </>
        )}
        <span className="text-white/30">·</span>
        <button
          onClick={() => setShowDetails((value) => !value)}
          className="text-[11px] text-white/45 underline-offset-2 hover:text-white/70 hover:underline"
        >
          {showDetails ? "hide details" : "details"}
        </button>
      </div>

      {feedback.detail && !showDetails && (
        <div className="mt-0.5 text-[11px] text-white/45">{feedback.detail}</div>
      )}

      {approval && onResolveApproval && (
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px]">
          <span className="text-white/45">{approval.reason}</span>
          <button
            disabled={approval.resolving}
            onClick={() => onResolveApproval(approval.approvalId, true)}
            className={cn("text-white/75 underline-offset-2 hover:underline disabled:opacity-45")}
          >
            approve
          </button>
          <button
            disabled={approval.resolving}
            onClick={() => onResolveApproval(approval.approvalId, false)}
            className={cn("text-white/60 underline-offset-2 hover:underline disabled:opacity-45")}
          >
            deny
          </button>
        </div>
      )}

      {showDetails && (
        <pre className="mt-1 overflow-x-auto whitespace-pre-wrap break-words text-[11px] text-white/45">
          {rawPayload}
        </pre>
      )}
    </div>
  );
}
