"use client";

import { useEffect, useState, type RefObject } from "react";

type ScrollOverlayState = {
  hasOverflow: boolean;
  visible: boolean;
  thumbTop: number;
  thumbHeight: number;
};

const MIN_THUMB_HEIGHT = 24;

export function useScrollOverlay(ref: RefObject<HTMLElement | null>, idleMs = 1100): ScrollOverlayState {
  const [state, setState] = useState<ScrollOverlayState>({
    hasOverflow: false,
    visible: false,
    thumbTop: 0,
    thumbHeight: 0,
  });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let timeoutId: number | null = null;

    const updateMetrics = (show = false) => {
      const { scrollTop, scrollHeight, clientHeight } = el;
      const hasOverflow = scrollHeight - clientHeight > 1;
      if (!hasOverflow) {
        setState({ hasOverflow: false, visible: false, thumbTop: 0, thumbHeight: 0 });
        return;
      }
      const thumbHeight = Math.max(
        Math.round((clientHeight / scrollHeight) * clientHeight),
        MIN_THUMB_HEIGHT
      );
      const maxThumbTop = Math.max(clientHeight - thumbHeight, 0);
      const maxScrollTop = Math.max(scrollHeight - clientHeight, 1);
      const thumbTop = Math.round((scrollTop / maxScrollTop) * maxThumbTop);
      setState((prev) => ({
        hasOverflow: true,
        visible: show ? true : prev.visible,
        thumbTop,
        thumbHeight,
      }));
    };

    const activate = () => {
      updateMetrics(true);
      if (timeoutId !== null) window.clearTimeout(timeoutId);
      timeoutId = window.setTimeout(() => {
        setState((prev) => ({ ...prev, visible: false }));
        timeoutId = null;
      }, idleMs);
    };

    const handleResize = () => updateMetrics(false);
    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(el);

    el.addEventListener("scroll", activate, { passive: true });
    el.addEventListener("wheel", activate, { passive: true });
    window.addEventListener("resize", handleResize);
    updateMetrics(false);

    return () => {
      el.removeEventListener("scroll", activate);
      el.removeEventListener("wheel", activate);
      window.removeEventListener("resize", handleResize);
      resizeObserver.disconnect();
      if (timeoutId !== null) window.clearTimeout(timeoutId);
    };
  }, [idleMs, ref]);

  return state;
}
