import { getToolDisplayLabel } from "@/lib/ai";
import { cn } from "@/lib/utils";

export type StreamStatusEvent = {
  type: "status-update";
  phase: "waiting-approval";
  label: string;
  toolName?: string;
  toolCallId?: string;
};

interface StreamStatusRowProps {
  status: StreamStatusEvent;
}

function phaseTone(): string {
  return "bg-amber-500/20 text-amber-200";
}

export function StreamStatusRow({ status }: StreamStatusRowProps) {
  const toolLabel = status.toolName ? getToolDisplayLabel(status.toolName) : null;

  return (
    <div className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2">
      <div className="flex items-center gap-2 text-[12px] text-white/75">
        <span
          className={cn(
            "inline-flex items-center rounded-full px-2 py-[2px] font-medium",
            phaseTone()
          )}
        >
          {status.label}
        </span>
        {toolLabel && <span className="text-white/60">{toolLabel}</span>}
      </div>
    </div>
  );
}
