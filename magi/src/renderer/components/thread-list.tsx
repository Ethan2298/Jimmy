import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent,
} from "react";
import { ThreadItem } from "./thread-item";
import { formatThreadAge, type ChatThread } from "@/lib/chat-threads";

interface ThreadListProps {
  threads: ChatThread[];
  activeThreadId: string;
  onSelectThread: (id: string) => void;
  onDeleteThread: (id: string) => void;
  onRenameThread: (id: string, title: string) => void;
}

const ITEM_HEIGHT = 28;
const ITEM_GAP = 4;
const ITEM_STRIDE = ITEM_HEIGHT + ITEM_GAP;
const HOVER_EXIT_DELAY_MS = 70;

function ThreadListImpl({ threads, activeThreadId, onSelectThread, onDeleteThread, onRenameThread }: ThreadListProps) {
  const [hoveredThreadId, setHoveredThreadId] = useState<string | null>(null);
  const leaveTimeoutRef = useRef<number | null>(null);

  const threadRows = useMemo(() => {
    const now = new Date();
    return threads.map((thread) => ({
      id: thread.id,
      title: thread.title,
      age: formatThreadAge(thread.updatedAt, now),
    }));
  }, [threads]);

  const clearLeaveTimer = useCallback(() => {
    if (leaveTimeoutRef.current == null) return;
    window.clearTimeout(leaveTimeoutRef.current);
    leaveTimeoutRef.current = null;
  }, []);

  const resolveHoverIdByY = useCallback(
    (y: number) => {
      if (threadRows.length === 0) return null;
      const index = Math.max(0, Math.min(threadRows.length - 1, Math.floor((y + ITEM_GAP / 2) / ITEM_STRIDE)));
      return threadRows[index]?.id ?? null;
    },
    [threadRows]
  );

  const handlePointerMove = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (event.pointerType === "touch") return;
      clearLeaveTimer();
      const rect = event.currentTarget.getBoundingClientRect();
      const nextHoverId = resolveHoverIdByY(event.clientY - rect.top);
      setHoveredThreadId((prev) => (prev === nextHoverId ? prev : nextHoverId));
    },
    [clearLeaveTimer, resolveHoverIdByY]
  );

  const handlePointerEnter = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (event.pointerType === "touch") return;
      clearLeaveTimer();
      const rect = event.currentTarget.getBoundingClientRect();
      const nextHoverId = resolveHoverIdByY(event.clientY - rect.top);
      setHoveredThreadId((prev) => (prev === nextHoverId ? prev : nextHoverId));
    },
    [clearLeaveTimer, resolveHoverIdByY]
  );

  const handlePointerLeave = useCallback(() => {
    clearLeaveTimer();
    leaveTimeoutRef.current = window.setTimeout(() => {
      setHoveredThreadId(null);
      leaveTimeoutRef.current = null;
    }, HOVER_EXIT_DELAY_MS);
  }, [clearLeaveTimer]);

  useEffect(() => {
    if (hoveredThreadId != null && !threadRows.some((thread) => thread.id === hoveredThreadId)) {
      setHoveredThreadId(null);
    }
  }, [hoveredThreadId, threadRows]);

  useEffect(() => {
    return () => {
      clearLeaveTimer();
    };
  }, [clearLeaveTimer]);

  return (
    <div
      className="space-y-1"
      onPointerMove={handlePointerMove}
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
    >
      {threadRows.map((thread) => (
        <ThreadItem
          key={thread.id}
          id={thread.id}
          title={thread.title}
          age={thread.age}
          active={thread.id === activeThreadId}
          highlighted={thread.id === hoveredThreadId}
          onSelectThread={onSelectThread}
          onDeleteThread={onDeleteThread}
          onRenameThread={onRenameThread}
        />
      ))}
    </div>
  );
}

export const ThreadList = memo(ThreadListImpl);
