import type { Platform } from "../../shared/platform";
import type { ShellStyleConfig } from "./types";

/**
 * macOS traffic-light geometry (mirrors main/window/platforms/mac.ts).
 *
 *   left edge (trafficLightPosition.x) = 12 px
 *   button bounding-box                 = 14 × 14 px
 *   centre-to-centre spacing            = 20 px  →  edge gap = 6 px
 *   right edge of zoom button           = 12 + 3·14 + 2·6 = 66 px
 */
const TRAFFIC_LIGHT_RIGHT_EDGE = 66;
const TRAFFIC_LIGHT_TOGGLE_GAP = 8;
const TOGGLE_BUTTON_SIZE = 28; // w-7

const MAC_HEADER_GUTTER =
  TRAFFIC_LIGHT_RIGHT_EDGE + TRAFFIC_LIGHT_TOGGLE_GAP + TOGGLE_BUTTON_SIZE; // 100

const SHELL_CONFIG: Record<Platform, ShellStyleConfig> = {
  darwin: {
    useWindowsGlassLayout: false,
    applyActiveInactiveTint: false,
    rootCornerRadiusPx: 12,
    headerGutterPx: MAC_HEADER_GUTTER,
    showWindowControls: false,
  },
  win32: {
    useWindowsGlassLayout: true,
    applyActiveInactiveTint: true,
    rootCornerRadiusPx: 12,
    headerGutterPx: 52,
    showWindowControls: true,
  },
  linux: {
    useWindowsGlassLayout: false,
    applyActiveInactiveTint: false,
    rootCornerRadiusPx: 0,
    headerGutterPx: 52,
    showWindowControls: true,
  },
};

export function getShellProps(platform: Platform): ShellStyleConfig {
  return SHELL_CONFIG[platform];
}
