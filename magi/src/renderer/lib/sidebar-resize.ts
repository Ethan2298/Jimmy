export const MIN_WIDTH = 220;
export const MAX_WIDTH = 480;
export const DEFAULT_WIDTH = 316;

export function clampSidebarWidth(width: number): number {
  return Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, width));
}

export function parseStoredSidebarWidth(raw: string | null): number {
  if (raw == null) return DEFAULT_WIDTH;

  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return DEFAULT_WIDTH;

  return clampSidebarWidth(parsed);
}
