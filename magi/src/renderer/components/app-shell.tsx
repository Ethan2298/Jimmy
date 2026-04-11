import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { clampSidebarWidth } from "../lib/sidebar-resize";
import { SidebarToggleIcon } from "./sidebar-toggle-icon";
import type { ShellStyleConfig } from "../shells/types";

export interface AppShellProps {
  sidebarOpen: boolean;
  sidebarWidth: number;
  onSidebarWidthChange: (width: number) => void;
  onToggleSidebar: () => void;
  styleConfig: ShellStyleConfig;
  sidebar: ReactNode;
  topBar: ReactNode;
  stream: ReactNode;
  composer: ReactNode;
}

export function AppShell({
  sidebarOpen,
  sidebarWidth,
  onSidebarWidthChange,
  onToggleSidebar,
  styleConfig,
  sidebar,
  topBar,
  stream,
  composer,
}: AppShellProps) {
  const [liveSidebarWidth, setLiveSidebarWidth] = useState(sidebarWidth);
  const [isResizing, setIsResizing] = useState(false);
  const dragStateRef = useRef<{ pointerId: number; startX: number; startWidth: number } | null>(
    null
  );
  const resizeHandleRef = useRef<HTMLDivElement | null>(null);
  const prevBodyCursorRef = useRef<string | null>(null);
  const prevBodyUserSelectRef = useRef<string | null>(null);
  const liveSidebarWidthRef = useRef(sidebarWidth);
  const queuedWidthRef = useRef<number | null>(null);
  const rafIdRef = useRef<number | null>(null);

  const flushQueuedWidth = useCallback(() => {
    rafIdRef.current = null;
    if (queuedWidthRef.current == null) return;

    const queuedWidth = queuedWidthRef.current;
    queuedWidthRef.current = null;
    liveSidebarWidthRef.current = queuedWidth;
    setLiveSidebarWidth(queuedWidth);
  }, []);

  const endResize = useCallback((commitWidth: boolean) => {
    const dragState = dragStateRef.current;
    const resizeHandleEl = resizeHandleRef.current;
    if (!dragState) return;

    if (resizeHandleEl?.hasPointerCapture(dragState.pointerId)) {
      resizeHandleEl.releasePointerCapture(dragState.pointerId);
    }

    if (rafIdRef.current != null) {
      cancelAnimationFrame(rafIdRef.current);
      flushQueuedWidth();
    }

    const finalWidth = liveSidebarWidthRef.current;
    if (commitWidth && finalWidth !== sidebarWidth) {
      onSidebarWidthChange(finalWidth);
    }

    dragStateRef.current = null;
    setIsResizing(false);

    if (prevBodyCursorRef.current !== null) {
      document.body.style.cursor = prevBodyCursorRef.current;
      prevBodyCursorRef.current = null;
    }

    if (prevBodyUserSelectRef.current !== null) {
      document.body.style.userSelect = prevBodyUserSelectRef.current;
      prevBodyUserSelectRef.current = null;
    }
  }, [flushQueuedWidth, onSidebarWidthChange, sidebarWidth]);

  const handleResizePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!sidebarOpen || event.button !== 0) return;

      event.preventDefault();

      const handle = event.currentTarget;
      resizeHandleRef.current = handle;

      prevBodyCursorRef.current = document.body.style.cursor;
      prevBodyUserSelectRef.current = document.body.style.userSelect;
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
      queuedWidthRef.current = nextWidth;
      if (rafIdRef.current == null) {
        rafIdRef.current = requestAnimationFrame(flushQueuedWidth);
      }
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
  }, [endResize, flushQueuedWidth]);

  useEffect(() => {
    if (!sidebarOpen) {
      endResize(true);
    }
  }, [endResize, sidebarOpen]);

  return (
    <div
      className="h-screen w-screen overflow-hidden text-white relative"
      style={{
        background: styleConfig.rootCornerRadiusPx > 0 ? "transparent" : "#0a0a0a",
        borderRadius: styleConfig.rootCornerRadiusPx > 0 ? `${styleConfig.rootCornerRadiusPx}px` : undefined,
      }}
    >
      {styleConfig.useWindowsGlassLayout && (
        <div className="absolute inset-0 app-backdrop backdrop-blur-[10px] pointer-events-none" />
      )}
      <div
        className={`relative z-10 h-full w-full flex flex-col ${
          styleConfig.useWindowsGlassLayout ? "" : "backdrop-blur-[10px] app-backdrop"
        }`}
      >
        <div className="flex items-center magi-drag">
          <div
            className="flex-shrink-0 flex items-center justify-end"
            style={{ width: styleConfig.headerGutterPx }}
          >
            <button
              onClick={onToggleSidebar}
              className="magi-no-drag w-7 h-7 rounded-[8px] text-white/45 hover:text-white hover:bg-white/[0.08] grid place-items-center"
              title={sidebarOpen ? "Collapse sidebar" : "Open sidebar"}
            >
              <SidebarToggleIcon size={15} variant={sidebarOpen ? "open" : "closed"} />
            </button>
          </div>
          <div
            className="flex-1 min-w-0"
            style={{
              paddingLeft: sidebarOpen ? liveSidebarWidth - styleConfig.headerGutterPx : undefined,
              transition: isResizing ? "none" : "padding-left 180ms ease",
            }}
          >
            {topBar}
          </div>
        </div>
        <div className="flex-1 min-h-0 flex">
          <div
            className="relative h-full flex-shrink-0 overflow-hidden"
            style={{
              width: sidebarOpen ? liveSidebarWidth : 0,
              transition: isResizing ? "none" : "width 180ms ease",
              willChange: isResizing ? "width" : undefined,
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
                className="magi-no-drag absolute top-0 right-0 h-full w-[8px] cursor-col-resize z-20"
                style={{ touchAction: "none" }}
                title="Resize sidebar"
              />
            )}
          </div>
          <div className={`flex-1 min-w-0 h-full pr-2 pb-2 flex flex-col ${sidebarOpen ? "" : "pl-2"}`}>
            <section
              data-main-overlay-root="true"
              className={`relative z-10 flex-1 min-h-0 flex flex-col rounded-[5px] overflow-hidden ${
                styleConfig.useWindowsGlassLayout ? "bg-[#181818]" : "bg-[#171717]"
              }`}
            >
              <div className="flex-1 min-h-0">{stream}</div>
              {composer}
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
