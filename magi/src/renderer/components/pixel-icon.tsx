import { cn } from "@/lib/utils";
import { useRef, useEffect } from "react";

const LED_GRID = 7;

const SHAPES = {
  diamond: [
    ". . O . .",
    ". O o O .",
    "b o m o b",
    ". b B b .",
    ". . b . .",
  ],
} as const;

const LED_BLUE = { r: 0, g: 97, b: 255 };
const LED_RED = { r: 255, g: 64, b: 19 };

type CellState = { brightness: number; r: number; g: number; b: number };

function computeIdleCells(t: number): Map<string, CellState> {
  const cells = new Map<string, CellState>();
  const phase = (Math.sin(t * 0.4) + 1) / 2;
  const radius = 0.5 + phase * 3.2;

  for (let gy = 0; gy < LED_GRID; gy++) {
    for (let gx = 0; gx < LED_GRID; gx++) {
      const dist = Math.abs(gx - 3) + Math.abs(gy - 3);
      if (dist > radius + 0.5) continue;
      const edge = radius - dist;
      const br = Math.min(1, Math.max(0, edge + 0.5)) * (0.4 + 0.6 * (1 - dist / 4.2));
      if (br > 0.02) {
        const useBlue = gy > 3 || (gy === 3 && gx !== 3);
        const col = useBlue ? LED_BLUE : LED_RED;
        cells.set(`${gx},${gy}`, { brightness: br, r: col.r, g: col.g, b: col.b });
      }
    }
  }
  return cells;
}

function computeThinkingCells(t: number): Map<string, CellState> {
  const cells = new Map<string, CellState>();
  const spd = 2.2;
  const fx = 3 + Math.sin(t * spd * 1.7) * 2.5;
  const fy = 3 + Math.sin(t * spd * 2.3) * 2.5;
  for (let gy = 0; gy < LED_GRID; gy++) {
    for (let gx = 0; gx < LED_GRID; gx++) {
      const dist = Math.sqrt((gx - fx) ** 2 + (gy - fy) ** 2);
      if (dist > 2.8) continue;
      const br = Math.max(0, 1 - dist / 1.8) * 0.95;
      if (br > 0.03) {
        cells.set(`${gx},${gy}`, { brightness: br, r: 91, g: 143, b: 185 });
      }
    }
  }
  for (let i = 1; i <= 3; i++) {
    const tt = t - i * 0.08 * 5;
    const gfx = 3 + Math.sin(tt * spd * 1.7) * 2.5;
    const gfy = 3 + Math.sin(tt * spd * 2.3) * 2.5;
    const gx = Math.round(gfx);
    const gy = Math.round(gfy);
    if (gx >= 0 && gx < LED_GRID && gy >= 0 && gy < LED_GRID) {
      const key = `${gx},${gy}`;
      const fade = 0.4 * (1 - i / 4);
      const existing = cells.get(key);
      if (!existing || existing.brightness < fade) {
        cells.set(key, { brightness: fade, r: 91, g: 143, b: 185 });
      }
    }
  }
  return cells;
}

function computeStreamingCells(t: number): Map<string, CellState> {
  const cells = new Map<string, CellState>();
  for (let gx = 0; gx < LED_GRID; gx++) {
    const fy = 3 + Math.sin(gx * 1.2 - t * 8) * 1.6;
    for (let gy = 0; gy < LED_GRID; gy++) {
      const dist = Math.abs(gy - fy);
      if (dist > 1.5) continue;
      const br = Math.max(0, 1 - dist * 0.5);
      if (br > 0.02) {
        cells.set(`${gx},${gy}`, { brightness: br, r: 255, g: 64, b: 19 });
      }
    }
  }
  return cells;
}

function drawLEDFrame(
  ctx: CanvasRenderingContext2D,
  canvasSize: number,
  cells: Map<string, CellState>
) {
  ctx.clearRect(0, 0, canvasSize, canvasSize);

  const gapRatio = 0.18;
  const cellSize = canvasSize / (LED_GRID + (LED_GRID - 1) * gapRatio);
  const gap = cellSize * gapRatio;
  const total = LED_GRID * cellSize + (LED_GRID - 1) * gap;
  const off = (canvasSize - total) / 2;
  const rad = cellSize * 0.28;

  // Glow pass
  for (let gy = 0; gy < LED_GRID; gy++) {
    for (let gx = 0; gx < LED_GRID; gx++) {
      const state = cells.get(`${gx},${gy}`);
      if (!state || state.brightness < 0.05) continue;

      const cx = off + gx * (cellSize + gap) + cellSize / 2;
      const cy = off + gy * (cellSize + gap) + cellSize / 2;
      const glowR = cellSize * 2.2;
      const alpha = state.brightness * 0.35;

      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, glowR);
      grad.addColorStop(0, `rgba(${state.r},${state.g},${state.b},${alpha})`);
      grad.addColorStop(0.5, `rgba(${state.r},${state.g},${state.b},${alpha * 0.3})`);
      grad.addColorStop(1, `rgba(${state.r},${state.g},${state.b},0)`);
      ctx.fillStyle = grad;
      ctx.fillRect(cx - glowR, cy - glowR, glowR * 2, glowR * 2);
    }
  }

  // Cell pass
  for (let gy = 0; gy < LED_GRID; gy++) {
    for (let gx = 0; gx < LED_GRID; gx++) {
      const px = off + gx * (cellSize + gap);
      const py = off + gy * (cellSize + gap);
      const state = cells.get(`${gx},${gy}`);
      const br = state ? state.brightness : 0;

      if (br > 0.03 && state) {
        ctx.beginPath();
        ctx.roundRect(px, py, cellSize, cellSize, rad);

        const cr = Math.round(state.r * (0.3 + 0.7 * br));
        const cg = Math.round(state.g * (0.3 + 0.7 * br));
        const cb = Math.round(state.b * (0.3 + 0.7 * br));
        ctx.fillStyle = `rgb(${cr},${cg},${cb})`;
        ctx.fill();

        if (br > 0.4) {
          const hx = px + cellSize / 2;
          const hy = py + cellSize / 2;
          const hGrad = ctx.createRadialGradient(hx, hy, 0, hx, hy, cellSize * 0.35);
          hGrad.addColorStop(0, `rgba(255,255,230,${br * 0.6})`);
          hGrad.addColorStop(1, `rgba(255,255,230,0)`);
          ctx.fillStyle = hGrad;
          ctx.beginPath();
          ctx.roundRect(px, py, cellSize, cellSize, rad);
          ctx.fill();
        }
      }
    }
  }
}

interface PixelLEDIconProps {
  mode: "idle" | "thinking" | "streaming";
  size?: number;
  className?: string;
}

export function PixelLEDIcon({ mode, size = 20, className }: PixelLEDIconProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const timeRef = useRef(0);
  const lastFrameRef = useRef(0);
  const modeRef = useRef(mode);

  if (modeRef.current !== mode) {
    const isActive = mode !== "idle";
    modeRef.current = mode;
    if (isActive) {
      timeRef.current = 0;
      lastFrameRef.current = 0;
    }
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    const ctx = canvas.getContext("2d")!;

    function animate(time: number) {
      if (!lastFrameRef.current) lastFrameRef.current = time;
      const dt = Math.min(time - lastFrameRef.current, 50) / 1000;
      lastFrameRef.current = time;
      timeRef.current += dt;

      const t = timeRef.current;
      const cells =
        modeRef.current === "thinking"
          ? computeThinkingCells(t)
          : modeRef.current === "streaming"
            ? computeStreamingCells(t)
            : computeIdleCells(t);

      drawLEDFrame(ctx, size * dpr, cells);
      rafRef.current = requestAnimationFrame(animate);
    }

    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [size]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: size, height: size }}
      className={cn(className)}
    />
  );
}
