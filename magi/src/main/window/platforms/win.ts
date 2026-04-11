import type { WindowOptions } from "../types";

export function supportsWindowsAcrylic(systemVersion: string): boolean {
  const build = Number.parseInt(systemVersion.split(".").at(-1) ?? "0", 10);
  return Number.isFinite(build) && build >= 22621;
}

export function getWindowsWindowOptions(systemVersion: string): WindowOptions {
  return {
    frame: false,
    titleBarOverlay: { color: "#0a0a0b", symbolColor: "#9ca3af", height: 46 },
    roundedCorners: true,
    backgroundMaterial: supportsWindowsAcrylic(systemVersion) ? "acrylic" : undefined,
    backgroundColor: "#00000000",
  };
}
