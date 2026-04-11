import { powerMonitor } from "electron";
import { insertEvent } from "./db";
import { getSessionStartTime } from "./session";

let interval: ReturnType<typeof setInterval> | null = null;
let isIdle = false;
let idleStartTime = 0;

const POLL_INTERVAL_MS = 10_000;
const IDLE_THRESHOLD_S = 120;

function checkIdle(): void {
  const idleSeconds = powerMonitor.getSystemIdleTime();

  if (!isIdle && idleSeconds >= IDLE_THRESHOLD_S) {
    isIdle = true;
    idleStartTime = Math.max(Date.now() - idleSeconds * 1000, getSessionStartTime());
    insertEvent("idle_start", { idle_seconds: idleSeconds });
  } else if (isIdle && idleSeconds < IDLE_THRESHOLD_S) {
    const durationMs = Date.now() - idleStartTime;
    isIdle = false;
    idleStartTime = 0;
    insertEvent("idle_end", { duration_ms: durationMs });
  }
}

export function startIdleWatcher(): void {
  interval = setInterval(checkIdle, POLL_INTERVAL_MS);
  console.log("[activity] Idle watcher started (10s poll, 2min threshold)");
}

export function stopIdleWatcher(): void {
  if (interval) {
    clearInterval(interval);
    interval = null;
  }
  isIdle = false;
  idleStartTime = 0;
  console.log("[activity] Idle watcher stopped");
}
