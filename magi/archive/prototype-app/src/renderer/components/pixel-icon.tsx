import { cn } from "@/lib/utils";
import { useState, useEffect, useCallback, useRef, useMemo } from "react";

// --- Palette ---
// Define colors with short keys for grid strings
export const SUNSET = {
  O: "#E8863A", // bright orange
  o: "#D47530", // deep orange
  r: "#C4652A", // burnt orange
  m: "#9B7A5A", // mid tone
  b: "#5B8FB9", // soft blue
  B: "#4481D8", // bright blue
  d: "#3A6BA8", // deep blue
  w: "#F5EDDA", // warm white
  k: "#191919", // dark
} as const;

export type Palette = Record<string, string>;

// --- Grid parser ---
// Each row is a string, each char maps to a palette color. "." = empty pixel.
// Example: ". . O . ." → 5 cells, only center is orange
function parseGrid(rows: string[], palette: Palette): (string | null)[][] {
  return rows.map((row) =>
    row.split(" ").map((ch) => (ch === "." ? null : palette[ch] ?? null))
  );
}

// --- Shapes ---
export const SHAPES = {
  diamond: [
    ". . O . .",
    ". O o O .",
    "b o m o b",
    ". b B b .",
    ". . b . .",
  ],
  spark: [
    ". . O . .",
    ". . o . .",
    "O o m o B",
    ". . b . .",
    ". . B . .",
  ],
  wave: [
    "O o . . .",
    "o m b . .",
    ". m m b .",
    ". . b m o",
    ". . . o O",
  ],
  block: [
    "O O o o r",
    "O o o r m",
    "o o m b b",
    "o m b b B",
    "m b b B B",
  ],
  eye: [
    ". O O O .",
    "O o . o O",
    "O . B . O",
    "O o . o O",
    ". O O O .",
  ],
  corner: [
    "O O O O O",
    "O o o o .",
    "O o m . .",
    "O o . . .",
    "O . . . .",
  ],
} as const;

// Thinking: builds the diamond row by row
const THINK_ROWS = SHAPES.diamond;

// --- Glow filter ---
function GlowFilter({ id, color = "#E8863A", intensity = 4 }: { id: string; color?: string; intensity?: number }) {
  return (
    <defs>
      <filter id={id} x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur in="SourceGraphic" stdDeviation={intensity} result="blur" />
        <feFlood floodColor={color} floodOpacity="0.4" result="color" />
        <feComposite in="color" in2="blur" operator="in" result="glow" />
        <feMerge>
          <feMergeNode in="glow" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>
  );
}

// --- Renderer ---
function renderGrid(
  grid: (string | null)[][],
  size: number,
  gap: number,
  pixelRadius: number
) {
  const rows = grid.length;
  const cols = Math.max(...grid.map((r) => r.length));
  const cellW = (size - gap * (cols - 1)) / cols;
  const cellH = (size - gap * (rows - 1)) / rows;
  const pixels: React.ReactElement[] = [];

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < grid[y].length; x++) {
      const color = grid[y][x];
      if (!color) continue;
      pixels.push(
        <rect
          key={`${x}-${y}`}
          x={x * (cellW + gap)}
          y={y * (cellH + gap)}
          width={cellW}
          height={cellH}
          rx={pixelRadius}
          fill={color}
        />
      );
    }
  }
  return pixels;
}

// --- Components ---

interface PixelRendererProps {
  grid: string[];
  palette?: Palette;
  size?: number;
  gap?: number;
  pixelRadius?: number;
  glow?: boolean;
  glowColor?: string;
  glowIntensity?: number;
  className?: string;
}

/** Generic pixel grid renderer. Pass any grid strings + palette. */
export function PixelRenderer({
  grid,
  palette = SUNSET,
  size = 20,
  gap = 1.5,
  pixelRadius = 0,
  glow = false,
  glowColor = "#E8863A",
  glowIntensity = 4,
  className,
}: PixelRendererProps) {
  const parsed = parseGrid(grid, palette);
  const filterId = "pixel-glow";
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={cn(className)}
    >
      {glow && <GlowFilter id={filterId} color={glowColor} intensity={glowIntensity} />}
      <g filter={glow ? `url(#${filterId})` : undefined}>
        {renderGrid(parsed, size, gap, pixelRadius)}
      </g>
    </svg>
  );
}

interface PixelAIIconProps {
  shape?: keyof typeof SHAPES;
  size?: number;
  gap?: number;
  pixelRadius?: number;
  className?: string;
}

/** Pre-built AI icon using named shapes. */
export function PixelAIIcon({
  shape = "diamond",
  size = 20,
  gap = 1.5,
  pixelRadius = 0,
  className,
}: PixelAIIconProps) {
  return (
    <PixelRenderer
      grid={SHAPES[shape]}
      size={size}
      gap={gap}
      pixelRadius={pixelRadius}
      className={className}
    />
  );
}

interface PixelAIIconSparkleProps extends PixelAIIconProps {
  /** Min ms between sparkles */
  minInterval?: number;
  /** Max ms between sparkles */
  maxInterval?: number;
  glow?: boolean;
  glowColor?: string;
  glowIntensity?: number;
}

/** AI icon that occasionally sparkles a random pixel. */
export function PixelAIIconSparkle({
  shape = "diamond",
  size = 20,
  gap = 1.5,
  pixelRadius = 0,
  minInterval = 3000,
  maxInterval = 8000,
  glow = false,
  glowColor = "#E8863A",
  glowIntensity = 4,
  className,
}: PixelAIIconSparkleProps) {
  const rows = SHAPES[shape];
  const parsed = parseGrid(rows, SUNSET);
  const filterId = "sparkle-glow";

  // Find all filled pixel positions
  const filledRef = useRef<[number, number][]>([]);
  if (filledRef.current.length === 0) {
    for (let y = 0; y < parsed.length; y++) {
      for (let x = 0; x < parsed[y].length; x++) {
        if (parsed[y][x]) filledRef.current.push([y, x]);
      }
    }
  }

  const [sparkle, setSparkle] = useState<{ y: number; x: number } | null>(null);

  const triggerSparkle = useCallback(() => {
    const filled = filledRef.current;
    const [y, x] = filled[Math.floor(Math.random() * filled.length)];
    setSparkle({ y, x });
    setTimeout(() => setSparkle(null), 600);
  }, []);

  useEffect(() => {
    function scheduleNext() {
      const delay = minInterval + Math.random() * (maxInterval - minInterval);
      return setTimeout(() => {
        triggerSparkle();
        timerRef.current = scheduleNext();
      }, delay);
    }
    const timerRef = { current: scheduleNext() };
    return () => clearTimeout(timerRef.current);
  }, [triggerSparkle, minInterval, maxInterval]);

  const cols = Math.max(...parsed.map((r) => r.length));
  const cellW = (size - gap * (cols - 1)) / cols;
  const cellH = (size - gap * (parsed.length - 1)) / parsed.length;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={cn(className)}
    >
      {glow && <GlowFilter id={filterId} color={glowColor} intensity={glowIntensity} />}
      <g filter={glow ? `url(#${filterId})` : undefined}>
        {renderGrid(parsed, size, gap, pixelRadius)}
        {sparkle && (
          <rect
            x={sparkle.x * (cellW + gap)}
            y={sparkle.y * (cellH + gap)}
            width={cellW}
            height={cellH}
            rx={pixelRadius}
            fill="#FFFFFF"
          >
            <animate
              attributeName="opacity"
              values="0;0.9;0"
              dur="0.6s"
              fill="freeze"
            />
          </rect>
        )}
      </g>
    </svg>
  );
}

interface PixelAIIconLiveProps {
  /** When true, morphs through shapes. When false, idles with sparkle. */
  active?: boolean;
  size?: number;
  gap?: number;
  pixelRadius?: number;
  glow?: boolean;
  glowColor?: string;
  glowIntensity?: number;
  className?: string;
}

const MORPH_SEQUENCE: (keyof typeof SHAPES)[] = ["diamond", "spark", "wave", "eye", "corner", "block"];

/** Live agent icon — morphs shapes when active, sparkles when idle. */
export function PixelAIIconLive({
  active = false,
  size = 20,
  gap = 1.5,
  pixelRadius = 0,
  glow = false,
  glowColor = "#E8863A",
  glowIntensity = 4,
  className,
}: PixelAIIconLiveProps) {
  const [shapeIndex, setShapeIndex] = useState(0);

  // Cycle through shapes when active
  useEffect(() => {
    if (!active) {
      setShapeIndex(0);
      return;
    }
    const interval = setInterval(() => {
      setShapeIndex((i) => (i + 1) % MORPH_SEQUENCE.length);
    }, 1000);
    return () => clearInterval(interval);
  }, [active]);

  // Sparkle when idle
  const [sparkle, setSparkle] = useState<{ y: number; x: number } | null>(null);

  useEffect(() => {
    if (active) {
      setSparkle(null);
      return;
    }
    const diamondParsed = parseGrid(SHAPES.diamond, SUNSET);
    const filled: [number, number][] = [];
    for (let y = 0; y < diamondParsed.length; y++) {
      for (let x = 0; x < diamondParsed[y].length; x++) {
        if (diamondParsed[y][x]) filled.push([y, x]);
      }
    }

    function scheduleNext(): ReturnType<typeof setTimeout> {
      const delay = 3000 + Math.random() * 5000;
      return setTimeout(() => {
        const [sy, sx] = filled[Math.floor(Math.random() * filled.length)];
        setSparkle({ y: sy, x: sx });
        setTimeout(() => setSparkle(null), 600);
        timer = scheduleNext();
      }, delay);
    }
    let timer = scheduleNext();
    return () => clearTimeout(timer);
  }, [active]);

  const currentShape = MORPH_SEQUENCE[shapeIndex];
  const parsed = parseGrid(SHAPES[currentShape], SUNSET);
  const filterId = "live-glow";

  const cols = Math.max(...parsed.map((r) => r.length));
  const cellW = (size - gap * (cols - 1)) / cols;
  const cellH = (size - gap * (parsed.length - 1)) / parsed.length;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={cn(className)}
    >
      {glow && <GlowFilter id={filterId} color={glowColor} intensity={glowIntensity} />}
      <g filter={glow ? `url(#${filterId})` : undefined}>
        {renderGrid(parsed, size, gap, pixelRadius)}
        {!active && sparkle && (
          <rect
            x={sparkle.x * (cellW + gap)}
            y={sparkle.y * (cellH + gap)}
            width={cellW}
            height={cellH}
            rx={pixelRadius}
            fill="#FFFFFF"
          >
            <animate
              attributeName="opacity"
              values="0;0.9;0"
              dur="0.6s"
              fill="freeze"
            />
          </rect>
        )}
      </g>
    </svg>
  );
}

interface PixelThinkingProps {
  size?: number;
  gap?: number;
  pixelRadius?: number;
  className?: string;
}

/** Animated thinking indicator — builds diamond row by row. */
export function PixelThinking({
  size = 20,
  gap = 1.5,
  pixelRadius = 0,
  className,
}: PixelThinkingProps) {
  const frames = THINK_ROWS.map((_, i) => {
    const rows = THINK_ROWS.map((row, j) => (j <= i ? row : row.replace(/[^. ]/g, ".")));
    return parseGrid(rows, SUNSET);
  });

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={cn(className)}
    >
      {frames.map((frame, i) => (
        <g key={i} opacity={0}>
          {renderGrid(frame, size, gap, pixelRadius)}
          <animate
            attributeName="opacity"
            values={frames.map((_, j) => (j === i ? "1" : "0")).join(";")}
            dur={`${frames.length * 0.35}s`}
            repeatCount="indefinite"
          />
        </g>
      ))}
    </svg>
  );
}

// ============================================================
// LED Grid Icon — canvas-based 7x7 animated indicator
// ============================================================

const LED_GRID = 7;

// Pre-compute infinity lemniscate path on 7x7 grid
const INFINITY_PATH: { x: number; y: number }[] = (() => {
  const path: { x: number; y: number }[] = [];
  let lastKey: string | null = null;
  for (let i = 0; i < 800; i++) {
    const a = (i / 800) * Math.PI * 2;
    const s = Math.sin(a),
      c = Math.cos(a),
      d = 1 + s * s;
    const gx = Math.round(3 + 2.85 * c / d);
    const gy = Math.round(3 + 2.1 * s * c / d);
    const key = `${gx},${gy}`;
    if (key !== lastKey) {
      path.push({ x: gx, y: gy });
      lastKey = key;
    }
  }
  while (
    path.length > 1 &&
    path[path.length - 1].x === path[0].x &&
    path[path.length - 1].y === path[0].y
  ) {
    path.pop();
  }
  return path;
})();

type CellState = { brightness: number; r: number; g: number; b: number };

// Two-color palette matching thinking (blue) and streaming (red/orange)
const LED_BLUE = { r: 0, g: 97, b: 255 };    // #0061ff — thinking
const LED_RED  = { r: 255, g: 64, b: 19 };   // #ff4013 — streaming

// Map diamond palette chars to blue/red
const LED_COLOR_MAP: Record<string, typeof LED_BLUE> = {
  O: LED_RED, o: LED_RED, r: LED_RED, m: LED_RED, // warm → red
  b: LED_BLUE, B: LED_BLUE, d: LED_BLUE,          // cool → blue
};

// Pre-compute the 5x5 diamond on 7x7 grid (offset by 1,1 to center it)
const IDLE_DIAMOND: { x: number; y: number; r: number; g: number; b: number }[] = (() => {
  const cells: { x: number; y: number; r: number; g: number; b: number }[] = [];
  for (let y = 0; y < SHAPES.diamond.length; y++) {
    const chars = SHAPES.diamond[y].split(" ");
    for (let x = 0; x < chars.length; x++) {
      const ch = chars[x];
      const col = LED_COLOR_MAP[ch];
      if (!col) continue;
      cells.push({ x: x + 1, y: y + 1, r: col.r, g: col.g, b: col.b });
    }
  }
  return cells;
})();

function computeIdleCells(t: number): Map<string, CellState> {
  const cells = new Map<string, CellState>();

  // Breathe animation — diamond expands and contracts from center
  const phase = (Math.sin(t * 0.4) + 1) / 2;
  const radius = 0.5 + phase * 3.2;

  for (let gy = 0; gy < LED_GRID; gy++) {
    for (let gx = 0; gx < LED_GRID; gx++) {
      const dist = Math.abs(gx - 3) + Math.abs(gy - 3);
      if (dist > radius + 0.5) continue;
      const edge = radius - dist;
      const br = Math.min(1, Math.max(0, edge + 0.5)) * (0.4 + 0.6 * (1 - dist / 4.2));
      if (br > 0.02) {
        // Use blue for lower half (dist from center via y), red for upper
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
  // Bounce — speed 2.2, glow 1.8, trail 5, color #ffd232
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
  // Ghost trail
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
  cells: Map<string, CellState>,
  isDark: boolean
) {
  ctx.clearRect(0, 0, canvasSize, canvasSize);

  const gapRatio = 0.18;
  const cellSize = canvasSize / (LED_GRID + (LED_GRID - 1) * gapRatio);
  const gap = cellSize * gapRatio;
  const total = LED_GRID * cellSize + (LED_GRID - 1) * gap;
  const off = (canvasSize - total) / 2;
  const rad = cellSize * 0.28;

  if (isDark) {
    // Glow pass — dark mode only
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

        if (isDark) {
          const cr = Math.round(state.r * (0.3 + 0.7 * br));
          const cg = Math.round(state.g * (0.3 + 0.7 * br));
          const cb = Math.round(state.b * (0.3 + 0.7 * br));
          ctx.fillStyle = `rgb(${cr},${cg},${cb})`;
        } else {
          // Light mode: full color, brightness via alpha
          ctx.fillStyle = `rgba(${state.r},${state.g},${state.b},${0.3 + br * 0.7})`;
        }
        ctx.fill();

        // Hot center highlight — dark mode only
        if (isDark && br > 0.4) {
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

/** Canvas-based 7x7 LED icon — idle (diamond), thinking (infinity), streaming (wave). */
export function PixelLEDIcon({ mode, size = 20, className }: PixelLEDIconProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const timeRef = useRef(0);
  const lastFrameRef = useRef(0);
  const modeRef = useRef(mode);
  const isDarkRef = useRef(true);

  // Reset animation time when switching to/from active modes
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

    // Detect theme
    isDarkRef.current = !document.documentElement.classList.contains("light");
    const observer = new MutationObserver(() => {
      isDarkRef.current = !document.documentElement.classList.contains("light");
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

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

      drawLEDFrame(ctx, size * dpr, cells, isDarkRef.current);
      rafRef.current = requestAnimationFrame(animate);
    }

    rafRef.current = requestAnimationFrame(animate);
    return () => {
      cancelAnimationFrame(rafRef.current);
      observer.disconnect();
    };
  }, [size]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: size, height: size }}
      className={cn(className)}
    />
  );
}
