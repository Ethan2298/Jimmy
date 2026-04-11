import type { WindowOptions } from "../types";

/**
 * macOS traffic-light geometry (must stay in sync with renderer shell config).
 *
 *   button bounding-box       = 14 × 14 px
 *   centre-to-centre spacing  = 20 px  →  edge gap = 6 px
 *
 *   x = 12   →  right edge of zoom button = 12 + 3·14 + 2·6 = 66 px
 *   y = 16   →  vertically centres 14 px buttons in the 46 px header
 *               (46 / 2) − (14 / 2) = 16
 */
const TRAFFIC_LIGHT_POSITION = { x: 12, y: 16 };

export function getMacWindowOptions(): WindowOptions {
  return {
    frame: true,
    titleBarStyle: "hiddenInset",
    trafficLightPosition: TRAFFIC_LIGHT_POSITION,
    transparent: true,
    vibrancy: "hud",
    visualEffectState: "active",
    backgroundColor: "#00000000",
  };
}
