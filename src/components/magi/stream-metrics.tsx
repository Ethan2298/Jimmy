"use client";

import { useState, useEffect } from "react";

export type StreamUsage = {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
};

interface StreamMetricsProps {
  isStreaming: boolean;
  startTime: number | null;
  usage: StreamUsage | null;
}

function formatElapsed(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  return `${minutes}m ${remaining}s`;
}

function formatTokens(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

export function StreamMetrics({ isStreaming, startTime, usage }: StreamMetricsProps) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!isStreaming || !startTime) {
      setElapsed(0);
      return;
    }
    setElapsed(Date.now() - startTime);
    const interval = setInterval(() => {
      setElapsed(Date.now() - startTime);
    }, 1000);
    return () => clearInterval(interval);
  }, [isStreaming, startTime]);

  if (isStreaming && startTime) {
    return (
      <div className="text-[11px] text-white/25 mt-1">
        {formatElapsed(elapsed)}
      </div>
    );
  }

  if (!isStreaming && usage) {
    const parts: string[] = [];
    parts.push(`${formatTokens(usage.outputTokens)} out`);
    parts.push(`${formatTokens(usage.inputTokens)} in`);
    if (usage.cacheReadTokens && usage.inputTokens > 0) {
      const pct = Math.round((usage.cacheReadTokens / usage.inputTokens) * 100);
      if (pct > 0) parts.push(`${pct}% cached`);
    }
    if (startTime) {
      const totalMs = Date.now() - startTime;
      parts.push(formatElapsed(totalMs));
    }
    return (
      <div className="text-[11px] text-white/25 mt-1">
        {parts.join(" · ")}
      </div>
    );
  }

  return null;
}
