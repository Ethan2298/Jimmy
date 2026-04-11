import { clipboard } from "electron";
import { insertEvent } from "./db";

let interval: ReturnType<typeof setInterval> | null = null;
let lastText = "";

const POLL_INTERVAL_MS = 5_000;
const MAX_TEXT_LENGTH = 10_000;

function checkClipboard(): void {
  try {
    const text = clipboard.readText();
    if (!text || text === lastText) return;

    lastText = text;
    const truncated = text.length > MAX_TEXT_LENGTH ? text.slice(0, MAX_TEXT_LENGTH) : text;

    insertEvent("clipboard", {
      text: truncated,
      length: text.length,
    });
  } catch {
    // Clipboard access can fail, silently continue
  }
}

export function startClipboardWatcher(): void {
  // Capture initial clipboard state without logging it
  try {
    lastText = clipboard.readText();
  } catch {
    // ignore
  }
  interval = setInterval(checkClipboard, POLL_INTERVAL_MS);
  console.log("[activity] Clipboard watcher started (5s interval)");
}

export function stopClipboardWatcher(): void {
  if (interval) {
    clearInterval(interval);
    interval = null;
    console.log("[activity] Clipboard watcher stopped");
  }
}
