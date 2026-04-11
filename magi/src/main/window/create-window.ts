import { BrowserWindow } from "electron";
import type { Platform } from "../../shared/platform";
import { getLinuxWindowOptions } from "./platforms/linux";
import { getMacWindowOptions } from "./platforms/mac";
import { getWindowsWindowOptions } from "./platforms/win";
import type { CreateWindowDeps, WindowBaseOptionsDeps, WindowOptions } from "./types";

function getBaseWindowOptions(deps: WindowBaseOptionsDeps): WindowOptions {
  return {
    width: deps.width,
    height: deps.height,
    x: deps.x,
    y: deps.y,
    resizable: true,
    minWidth: 900,
    minHeight: 560,
    hasShadow: true,
    fullscreenable: true,
    webPreferences: {
      preload: deps.preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  };
}

export function getWindowOptions(platform: Platform, systemVersion = "0.0.0"): WindowOptions {
  switch (platform) {
    case "darwin":
      return getMacWindowOptions();
    case "win32":
      return getWindowsWindowOptions(systemVersion);
    case "linux":
    default:
      return getLinuxWindowOptions();
  }
}

export function createWindowForPlatform(platform: Platform, deps: CreateWindowDeps): BrowserWindow {
  const win = new BrowserWindow({
    ...getBaseWindowOptions(deps),
    ...getWindowOptions(platform, deps.systemVersion),
  });

  if (deps.rendererUrl) {
    void win.loadURL(deps.rendererUrl);
  } else {
    void win.loadFile(deps.rendererFilePath);
  }

  return win;
}
