import { useRef, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";

const api = (window as any).api;

interface CartoonEyesProps {
  size?: number;
  className?: string;
}

export function CartoonEyes({ size = 20, className }: CartoonEyesProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const leftPupilRef = useRef<HTMLDivElement>(null);
  const rightPupilRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);
  const cursorRef = useRef({ x: 0, y: 0 });

  const eyeH = size;
  const eyeW = size * 0.85;
  const gap = size * 0.1;
  const pupilD = size * 0.35;

  const updatePupil = useCallback(
    (pupilEl: HTMLDivElement, eyeEl: HTMLElement, winPos: { x: number; y: number }) => {
      const rect = eyeEl.getBoundingClientRect();
      // Convert eye center to screen coordinates
      const eyeCX = winPos.x + rect.left + eyeW / 2;
      const eyeCY = winPos.y + rect.top + eyeH / 2;

      const dx = cursorRef.current.x - eyeCX;
      const dy = cursorRef.current.y - eyeCY;
      const angle = Math.atan2(dy, dx);
      const dist = Math.sqrt(dx * dx + dy * dy);

      const maxTravelX = (eyeW - pupilD) / 2 * 0.75;
      const maxTravelY = (eyeH - pupilD) / 2 * 0.75;

      const t = Math.min(1, dist / 200);
      const offsetX = maxTravelX * Math.cos(angle) * t;
      const offsetY = maxTravelY * Math.sin(angle) * t;

      pupilEl.style.left = (eyeW - pupilD) / 2 + offsetX + "px";
      pupilEl.style.top = (eyeH - pupilD) / 2 + offsetY + "px";
    },
    [eyeW, eyeH, pupilD]
  );

  useEffect(() => {
    let alive = true;

    async function poll() {
      if (!alive) return;
      try {
        const pos = await api.getCursor();
        cursorRef.current = pos;
      } catch {
        // ignore
      }

      const container = containerRef.current;
      const lp = leftPupilRef.current;
      const rp = rightPupilRef.current;
      if (container && lp && rp) {
        const winPos = { x: window.screenX, y: window.screenY };
        const eyes = container.querySelectorAll<HTMLElement>("[data-eye]");
        if (eyes[0]) updatePupil(lp, eyes[0], winPos);
        if (eyes[1]) updatePupil(rp, eyes[1], winPos);
      }

      rafRef.current = requestAnimationFrame(() => poll());
    }

    poll();
    return () => {
      alive = false;
      cancelAnimationFrame(rafRef.current);
    };
  }, [updatePupil]);

  return (
    <div
      ref={containerRef}
      className={cn("inline-flex items-center", className)}
      style={{ gap }}
    >
      <div
        data-eye
        className="relative overflow-hidden rounded-[50%]"
        style={{ width: eyeW, height: eyeH, background: "#ffffff" }}
      >
        <div
          ref={leftPupilRef}
          className="absolute rounded-full"
          style={{
            width: pupilD,
            height: pupilD,
            background: "#000000",
            left: (eyeW - pupilD) / 2,
            top: (eyeH - pupilD) * 0.7,
          }}
        />
      </div>
      <div
        data-eye
        className="relative overflow-hidden rounded-[50%]"
        style={{ width: eyeW, height: eyeH, background: "#ffffff" }}
      >
        <div
          ref={rightPupilRef}
          className="absolute rounded-full"
          style={{
            width: pupilD,
            height: pupilD,
            background: "#000000",
            left: (eyeW - pupilD) / 2,
            top: (eyeH - pupilD) * 0.7,
          }}
        />
      </div>
    </div>
  );
}
