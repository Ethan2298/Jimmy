import { insertEvent } from "./db";

let uIOhook: typeof import("uiohook-napi").uIOhook | null = null;

let started = false;
let typing = false;
let keyCount = 0;
let sessionStartTime = 0;
let timeout: ReturnType<typeof setTimeout> | null = null;

/** Seconds of silence before a typing session ends */
const SESSION_GAP_MS = 5_000;

function onKeyDown(): void {
  if (!typing) {
    typing = true;
    keyCount = 0;
    sessionStartTime = Date.now();
    insertEvent("typing_start", {});
  }

  keyCount++;

  // Reset the inactivity timer
  if (timeout) clearTimeout(timeout);
  timeout = setTimeout(endSession, SESSION_GAP_MS);
}

function endSession(): void {
  if (!typing) return;
  const durationMs = Date.now() - sessionStartTime;
  insertEvent("typing_end", { key_count: keyCount, duration_ms: durationMs });
  typing = false;
  keyCount = 0;
  sessionStartTime = 0;
  timeout = null;
}

export async function startKeyboardWatcher(): Promise<void> {
  if (started) return;

  if (!uIOhook) {
    try {
      const mod = await import("uiohook-napi");
      uIOhook = mod.uIOhook;
    } catch {
      console.warn("[activity] uiohook-napi not available — keyboard watcher disabled");
      return;
    }
  }

  uIOhook.on("keydown", onKeyDown);
  uIOhook.start();
  started = true;
  console.log("[activity] Keyboard watcher started (session gap: 5s)");
}

export function stopKeyboardWatcher(): void {
  if (!started) return;

  // Flush any in-progress session
  if (timeout) clearTimeout(timeout);
  if (typing) endSession();

  uIOhook?.off("keydown", onKeyDown);
  uIOhook?.stop();
  started = false;
  console.log("[activity] Keyboard watcher stopped");
}
