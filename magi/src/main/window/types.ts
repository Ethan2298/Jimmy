import type { BrowserWindowConstructorOptions } from "electron";

export interface WindowBaseOptionsDeps {
  width: number;
  height: number;
  x: number;
  y: number;
  preloadPath: string;
}

export interface CreateWindowDeps extends WindowBaseOptionsDeps {
  rendererUrl?: string;
  rendererFilePath: string;
  systemVersion?: string;
}

export type WindowOptions = BrowserWindowConstructorOptions;
