import { useState, useRef, useEffect, useLayoutEffect, useMemo, useCallback, memo } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { icons, type LucideIcon } from "lucide-react";
import { Search } from "lucide-react";

export const DEFAULT_ICON = "target";
export const DEFAULT_ICON_COLOR = "#8a8f98";

// --- Color conversions (HSV <-> Hex) ---

function hexToHsv(hex: string): [number, number, number] {
  const m = hex.match(/^#?([0-9a-f]{6})$/i);
  if (!m) return [0, 0, 0.5];
  const r = parseInt(m[1].slice(0, 2), 16) / 255;
  const g = parseInt(m[1].slice(2, 4), 16) / 255;
  const b = parseInt(m[1].slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d + 6) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
  }
  return [h, max === 0 ? 0 : d / max, max];
}

function hsvToHex(h: number, s: number, v: number): string {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let r = 0, g = 0, b = 0;
  if (h < 60) { r = c; g = x; }
  else if (h < 120) { r = x; g = c; }
  else if (h < 180) { g = c; b = x; }
  else if (h < 240) { g = x; b = c; }
  else if (h < 300) { r = x; b = c; }
  else { r = c; b = x; }
  const toHex = (n: number) => Math.round((n + m) * 255).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

// --- Icon name helpers ---

function kebabToPascal(str: string): string {
  return str.split("-").map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join("");
}

function resolveIcon(name: string): LucideIcon | undefined {
  if (icons[name as keyof typeof icons]) return icons[name as keyof typeof icons];
  return icons[kebabToPascal(name) as keyof typeof icons];
}

const iconEntries = Object.entries(icons) as [string, LucideIcon][];

// --- OutcomeIcon (public) ---

export function OutcomeIcon({ icon, iconColor, size = 16, className }: {
  icon?: string; iconColor?: string; size?: number; className?: string;
}) {
  const IconComponent = resolveIcon(icon || DEFAULT_ICON) || icons.Target;
  return <IconComponent className={className} style={{ color: iconColor || DEFAULT_ICON_COLOR }} size={size} />;
}

// --- Inline HSV color picker ---

function InlineColorPicker({ color, onChange }: { color: string; onChange: (hex: string) => void }) {
  const [hsv, setHsv] = useState<[number, number, number]>(() => hexToHsv(color));
  const svRef = useRef<HTMLDivElement>(null);
  const hueRef = useRef<HTMLDivElement>(null);
  const onChangeRef = useRef(onChange);
  const lastEmitted = useRef(color);
  const hsvRef = useRef(hsv);

  onChangeRef.current = onChange;
  hsvRef.current = hsv;

  // Sync from external color changes only (not our own emissions)
  useEffect(() => {
    if (color !== lastEmitted.current) {
      const next = hexToHsv(color);
      setHsv(next);
      hsvRef.current = next;
    }
    lastEmitted.current = color;
  }, [color]);

  const emit = useCallback((next: [number, number, number]) => {
    setHsv(next);
    hsvRef.current = next;
    const hex = hsvToHex(...next);
    lastEmitted.current = hex;
    onChangeRef.current(hex);
  }, []);

  const handleSV = useCallback((e: MouseEvent) => {
    const rect = svRef.current!.getBoundingClientRect();
    const s = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const v = Math.max(0, Math.min(1, 1 - (e.clientY - rect.top) / rect.height));
    emit([hsvRef.current[0], s, v]);
  }, [emit]);

  const handleHue = useCallback((e: MouseEvent) => {
    const rect = hueRef.current!.getBoundingClientRect();
    const h = Math.max(0, Math.min(360, ((e.clientX - rect.left) / rect.width) * 360));
    emit([h, hsvRef.current[1], hsvRef.current[2]]);
  }, [emit]);

  const startDrag = useCallback((handler: (e: MouseEvent) => void) => (e: React.MouseEvent) => {
    e.preventDefault();
    handler(e.nativeEvent);
    const onMove = (ev: MouseEvent) => { ev.preventDefault(); handler(ev); };
    const onUp = () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, []);

  const hueColor = hsvToHex(hsv[0], 1, 1);

  return (
    <div className="space-y-2">
      {/* Saturation-Value area */}
      <div
        ref={svRef}
        className="relative w-full h-[120px] rounded-md cursor-crosshair border border-border"
        style={{ background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, ${hueColor})` }}
        onMouseDown={startDrag(handleSV)}
      >
        <div
          className="absolute w-3.5 h-3.5 rounded-full border-2 border-white shadow-[0_0_2px_rgba(0,0,0,0.6)] -translate-x-1/2 -translate-y-1/2 pointer-events-none"
          style={{ left: `${hsv[1] * 100}%`, top: `${(1 - hsv[2]) * 100}%` }}
        />
      </div>
      {/* Hue strip */}
      <div
        ref={hueRef}
        className="relative w-full h-3 rounded-full cursor-pointer"
        style={{ background: "linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)" }}
        onMouseDown={startDrag(handleHue)}
      >
        <div
          className="absolute w-3.5 h-3.5 rounded-full border-2 border-white shadow-[0_0_2px_rgba(0,0,0,0.6)] -translate-x-1/2 -translate-y-1/2 pointer-events-none top-1/2"
          style={{ left: `${(hsv[0] / 360) * 100}%` }}
        />
      </div>
    </div>
  );
}

// --- Virtualized icon grid (memoized — color applied via CSS inheritance) ---

const ICON_SIZE = 35;
const COLS = 8;
const ROW_HEIGHT = ICON_SIZE + 2;
const GRID_HEIGHT = 280;
const BUFFER = 3;

const IconGrid = memo(function IconGrid({ entries, currentIconPascal, onSelect }: {
  entries: [string, LucideIcon][];
  currentIconPascal: string;
  onSelect: (name: string) => void;
}) {
  const [scrollTop, setScrollTop] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const prevLen = useRef(entries.length);

  // Reset scroll when filtered list changes
  useEffect(() => {
    if (entries.length !== prevLen.current) {
      scrollRef.current?.scrollTo(0, 0);
      setScrollTop(0);
      prevLen.current = entries.length;
    }
  }, [entries.length]);

  const totalRows = Math.ceil(entries.length / COLS);
  const totalHeight = totalRows * ROW_HEIGHT;
  const startRow = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - BUFFER);
  const endRow = Math.min(totalRows, Math.ceil((scrollTop + GRID_HEIGHT) / ROW_HEIGHT) + BUFFER);
  const visible = entries.slice(startRow * COLS, Math.min(entries.length, endRow * COLS));

  if (entries.length === 0) {
    return <div className="text-sm text-muted-foreground text-center py-4">No icons found</div>;
  }

  return (
    <div
      ref={scrollRef}
      className="overflow-y-auto overflow-x-hidden"
      style={{ maxHeight: GRID_HEIGHT }}
      onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
    >
      <div style={{ height: totalHeight, position: "relative" }}>
        <div
          className="grid grid-cols-8 gap-0.5 absolute w-full"
          style={{ top: startRow * ROW_HEIGHT }}
        >
          {visible.map(([name, Icon]) => (
            <button
              key={name}
              onClick={() => onSelect(name)}
              className={cn(
                "w-[35px] h-[35px] rounded-md flex items-center justify-center transition-colors cursor-pointer",
                currentIconPascal === name ? "bg-accent" : "hover:bg-accent/60"
              )}
              title={name}
            >
              <Icon size={16} />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
});

// --- IconPicker (public) ---

export function IconPicker({ icon, iconColor, onChangeIcon, onChangeColor, children }: {
  icon?: string; iconColor?: string;
  onChangeIcon: (icon: string) => void;
  onChangeColor: (color: string) => void;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const triggerRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  useLayoutEffect(() => {
    if (open && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setPos({ top: rect.bottom + 4, left: rect.left });
    }
  }, [open]);

  useEffect(() => {
    if (open) requestAnimationFrame(() => searchRef.current?.focus());
    else setSearch("");
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handle = (e: MouseEvent) => {
      if (
        triggerRef.current && !triggerRef.current.contains(e.target as Node) &&
        popoverRef.current && !popoverRef.current.contains(e.target as Node)
      ) setOpen(false);
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  const currentColor = iconColor || DEFAULT_ICON_COLOR;

  const currentIconPascal = useMemo(() => {
    const name = icon || DEFAULT_ICON;
    if (icons[name as keyof typeof icons]) return name;
    return kebabToPascal(name);
  }, [icon]);

  const filtered = useMemo(() => {
    if (!search) return iconEntries;
    const q = search.toLowerCase();
    return iconEntries.filter(([name]) => name.toLowerCase().includes(q));
  }, [search]);

  const handleSelect = useCallback((name: string) => {
    onChangeIcon(name);
    setOpen(false);
  }, [onChangeIcon]);

  return (
    <div ref={triggerRef}>
      <div onClick={(e) => { e.stopPropagation(); setOpen(!open); }} className="cursor-pointer">
        {children}
      </div>
      {open && createPortal(
        <div ref={popoverRef} className="fixed z-[100] w-[320px] rounded-lg border border-border bg-muted/95 backdrop-blur-sm shadow-lg p-3" style={{ top: pos.top, left: pos.left }}>
          {/* Inline color picker */}
          <InlineColorPicker color={currentColor} onChange={onChangeColor} />

          {/* Search */}
          <div className="relative mt-3 mb-3">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <input
              ref={searchRef}
              type="text"
              placeholder="Search icons..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-8 rounded-md border border-border bg-background pl-8 pr-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-ring"
            />
          </div>

          {/* Icon grid — color applied via CSS inheritance, grid is memoized */}
          <div style={{ color: currentColor }}>
            <IconGrid entries={filtered} currentIconPascal={currentIconPascal} onSelect={handleSelect} />
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
