import { app, BrowserWindow, globalShortcut, screen } from "electron";
import path from "path";
import "./ipc/chat";
import "./ipc/data";
import "./ipc/magi";
import "./ipc/workspace";
import "./ipc/activity";
import { initTaskDb, closeTaskDb } from "./db";
import { startActivityTracker, stopActivityTracker } from "./activity";
import { createWindowForPlatform } from "./window/create-window";
import { normalizePlatform } from "../shared/platform";

let win: BrowserWindow | null = null;
let taskDbReady = false;
let activityTrackerReady = false;

function createWindow() {
  const { width: screenWidth, height: screenHeight } =
    screen.getPrimaryDisplay().workAreaSize;

  const defaultWidth = Math.min(1440, screenWidth);
  const defaultHeight = Math.min(900, screenHeight);
  const platform = normalizePlatform(process.platform);

  win = createWindowForPlatform(platform, {
    width: defaultWidth,
    height: defaultHeight,
    x: Math.round((screenWidth - defaultWidth) / 2),
    y: Math.round((screenHeight - defaultHeight) / 2),
    preloadPath: path.join(__dirname, "../preload/index.js"),
    rendererUrl: process.env["ELECTRON_RENDERER_URL"],
    rendererFilePath: path.join(__dirname, "../renderer/index.html"),
    systemVersion: process.getSystemVersion(),
  });

  win.on("closed", () => {
    win = null;
  });
}

app.whenReady().then(async () => {
  // Initialize task management database
  const repoRoot = path.resolve(__dirname, "../..");
  const taskDbPath = path.join(repoRoot, "project-magi.db");
  try {
    initTaskDb(taskDbPath);
    taskDbReady = true;
  } catch (error) {
    console.error("[task-db] Failed to initialize:", error);
  }

  try {
    await startActivityTracker();
    activityTrackerReady = true;
  } catch (error) {
    console.error("[activity] Failed to start trackers:", error);
  }

  createWindow();

  // Global shortcut to show and focus the window
  globalShortcut.register("CommandOrControl+Shift+Space", () => {
    if (!win) {
      createWindow();
      return;
    }
    win.show();
    win.focus();
  });
});

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
  if (activityTrackerReady) {
    stopActivityTracker();
    activityTrackerReady = false;
  }
  if (taskDbReady) {
    closeTaskDb();
    taskDbReady = false;
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

// Export for IPC handlers
export function getMagiWindow(): BrowserWindow | null {
  return win;
}
