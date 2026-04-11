"use client";

import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";

const MIN_SIDEBAR_WIDTH = 200;
const MAX_SIDEBAR_WIDTH = 400;
const DEFAULT_SIDEBAR_WIDTH = 260;

function clampSidebarWidth(w: number): number {
  return Math.max(MIN_SIDEBAR_WIDTH, Math.min(MAX_SIDEBAR_WIDTH, Math.round(w)));
}

interface AppShellProps {
  sidebarOpen: boolean;
  sidebarWidth: number;
  onSidebarWidthChange: (width: number) => void;
  sidebar: ReactNode;
  header?: ReactNode;
  stream: ReactNode;
  composer: ReactNode;
}

export { DEFAULT_SIDEBAR_WIDTH };

export function AppShell({
  sidebarOpen,
  sidebarWidth,
  onSidebarWidthChange,
  sidebar,
  header,
  stream,
  composer,
}: AppShellProps) {
  const [liveSidebarWidth, setLiveSidebarWidth] = useState(sidebarWidth);
  const [isResizing, setIsResizing] = useState(false);
  const dragStateRef = useRef<{ pointerId: number; startX: number; startWidth: number } | null>(null);
  const resizeHandleRef = useRef<HTMLDivElement | null>(null);
  const liveSidebarWidthRef = useRef(sidebarWidth);
  const renderedSidebarWidth = isResizing ? liveSidebarWidth : sidebarWidth;

  const endResize = useCallback((commitWidth: boolean) => {
    const dragState = dragStateRef.current;
    if (!dragState) return;
    const resizeHandleEl = resizeHandleRef.current;
    if (resizeHandleEl?.hasPointerCapture(dragState.pointerId)) {
      resizeHandleEl.releasePointerCapture(dragState.pointerId);
    }
    const finalWidth = liveSidebarWidthRef.current;
    if (commitWidth && finalWidth !== sidebarWidth) {
      onSidebarWidthChange(finalWidth);
    }
    dragStateRef.current = null;
    setIsResizing(false);
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  }, [onSidebarWidthChange, sidebarWidth]);

  const handleResizePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!sidebarOpen || event.button !== 0) return;
      event.preventDefault();
      const handle = event.currentTarget;
      resizeHandleRef.current = handle;
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
      handle.setPointerCapture(event.pointerId);
      liveSidebarWidthRef.current = sidebarWidth;
      setLiveSidebarWidth(sidebarWidth);
      setIsResizing(true);
      dragStateRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startWidth: sidebarWidth,
      };
    },
    [sidebarOpen, sidebarWidth]
  );

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      const dragState = dragStateRef.current;
      if (!dragState || dragState.pointerId !== event.pointerId) return;
      const nextWidth = clampSidebarWidth(dragState.startWidth + (event.clientX - dragState.startX));
      liveSidebarWidthRef.current = nextWidth;
      setLiveSidebarWidth(nextWidth);
    };
    const handlePointerEnd = (event: PointerEvent) => {
      const dragState = dragStateRef.current;
      if (!dragState || dragState.pointerId !== event.pointerId) return;
      endResize(true);
    };
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerEnd);
    window.addEventListener("pointercancel", handlePointerEnd);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerEnd);
      window.removeEventListener("pointercancel", handlePointerEnd);
      endResize(false);
    };
  }, [endResize]);

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#08090b] text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(110,168,255,0.12),transparent_34%),linear-gradient(180deg,#0a0c10_0%,#08090b_100%)]" />
      <div className="relative flex h-full w-full">
        {/* Sidebar */}
        <div
          className="relative h-full flex-shrink-0 overflow-hidden"
          style={{
            width: sidebarOpen ? renderedSidebarWidth : 0,
            transition: isResizing ? "none" : "width 180ms ease",
          }}
        >
          <div
            className="h-full px-3 py-3 pr-0"
            style={{
              width: renderedSidebarWidth,
              opacity: sidebarOpen ? 1 : 0,
              transform: sidebarOpen ? "translateX(0)" : "translateX(-8px)",
              transition: isResizing ? "none" : "opacity 140ms ease, transform 180ms ease",
              pointerEvents: sidebarOpen ? "auto" : "none",
            }}
          >
            {sidebar}
          </div>
          {sidebarOpen && (
            <div
              ref={resizeHandleRef}
              onPointerDown={handleResizePointerDown}
              className="absolute top-0 right-0 z-20 h-full w-[8px] cursor-col-resize"
              style={{ touchAction: "none" }}
              title="Resize sidebar"
            />
          )}
        </div>

        {/* Main */}
        <div className="flex h-full min-w-0 flex-1 flex-col p-3 pl-0">
          <section className="relative z-10 flex min-h-0 flex-1 flex-col overflow-hidden rounded-[28px] border border-white/[0.08] bg-[#101215]/92 shadow-[0_20px_80px_rgba(0,0,0,0.45)] backdrop-blur-xl">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-[radial-gradient(circle_at_top,rgba(161,202,255,0.12),transparent_72%)]" />
            {header && (
              <div className="relative shrink-0 border-b border-white/[0.06] px-4 py-3">
                {header}
              </div>
            )}
            <div className="flex-1 min-h-0">{stream}</div>
            {composer}
          </section>
        </div>
      </div>
    </div>
  );
}
