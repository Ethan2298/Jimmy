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
  onToggleSidebar: () => void;
  sidebar: ReactNode;
  stream: ReactNode;
  composer: ReactNode;
}

export { DEFAULT_SIDEBAR_WIDTH };

export function AppShell({
  sidebarOpen,
  sidebarWidth,
  onSidebarWidthChange,
  onToggleSidebar,
  sidebar,
  stream,
  composer,
}: AppShellProps) {
  const [liveSidebarWidth, setLiveSidebarWidth] = useState(sidebarWidth);
  const [isResizing, setIsResizing] = useState(false);
  const dragStateRef = useRef<{ pointerId: number; startX: number; startWidth: number } | null>(null);
  const resizeHandleRef = useRef<HTMLDivElement | null>(null);
  const liveSidebarWidthRef = useRef(sidebarWidth);

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
      setIsResizing(true);
      dragStateRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startWidth: liveSidebarWidthRef.current,
      };
    },
    [sidebarOpen]
  );

  useEffect(() => {
    if (dragStateRef.current) return;
    setLiveSidebarWidth(sidebarWidth);
    liveSidebarWidthRef.current = sidebarWidth;
  }, [sidebarWidth]);

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

  useEffect(() => {
    if (!sidebarOpen) endResize(true);
  }, [endResize, sidebarOpen]);

  return (
    <div className="h-screen w-screen overflow-hidden text-white bg-[#0a0a0a]">
      <div className="h-full w-full flex">
        {/* Sidebar */}
        <div
          className="relative h-full flex-shrink-0 overflow-hidden"
          style={{
            width: sidebarOpen ? liveSidebarWidth : 0,
            transition: isResizing ? "none" : "width 180ms ease",
          }}
        >
          <div
            className="h-full"
            style={{
              width: liveSidebarWidth,
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
              className="absolute top-0 right-0 h-full w-[8px] cursor-col-resize z-20"
              style={{ touchAction: "none" }}
              title="Resize sidebar"
            />
          )}
        </div>

        {/* Main */}
        <div className="flex-1 min-w-0 h-full flex flex-col">
          <section className="relative z-10 flex-1 min-h-0 flex flex-col rounded-[5px] overflow-hidden bg-[#171717] m-2 ml-0">
            <div className="flex-1 min-h-0">{stream}</div>
            {composer}
          </section>
        </div>
      </div>
    </div>
  );
}
