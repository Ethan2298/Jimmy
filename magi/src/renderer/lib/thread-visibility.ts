import type { ChatThread } from "./chat-threads";

export const THREAD_COLLAPSE_LIMIT = 10;

export interface ThreadVisibility {
  visibleThreads: ChatThread[];
  hiddenCount: number;
  canToggle: boolean;
}

export function getThreadVisibility(
  threads: ChatThread[],
  expanded: boolean,
  limit = THREAD_COLLAPSE_LIMIT
): ThreadVisibility {
  const canToggle = threads.length > limit;
  if (!canToggle) {
    return {
      visibleThreads: threads,
      hiddenCount: 0,
      canToggle: false,
    };
  }

  if (expanded) {
    return {
      visibleThreads: threads,
      hiddenCount: 0,
      canToggle: true,
    };
  }

  return {
    visibleThreads: threads.slice(0, limit),
    hiddenCount: threads.length - limit,
    canToggle: true,
  };
}
