import { app } from "electron";
import path from "path";
import { initSession } from "./session";
import { initActivityDb, closeActivityDb } from "./db";
import { startWindowWatcher, stopWindowWatcher } from "./window-watcher";

import { startClipboardWatcher, stopClipboardWatcher } from "./clipboard";
import { startIdleWatcher, stopIdleWatcher } from "./idle";
import { startKeyboardWatcher, stopKeyboardWatcher } from "./keyboard";

export async function startActivityTracker(): Promise<void> {
  const dataDir = app.getPath("userData");
  const dbPath = path.join(dataDir, "activity.db");

  initSession();
  initActivityDb(dbPath);

  startWindowWatcher();
  startClipboardWatcher();
  startIdleWatcher();
  await startKeyboardWatcher();

  console.log("[activity] All trackers started");
}

export function stopActivityTracker(): void {
  stopWindowWatcher();
  stopClipboardWatcher();
  stopIdleWatcher();
  stopKeyboardWatcher();
  closeActivityDb();

  console.log("[activity] All trackers stopped");
}
