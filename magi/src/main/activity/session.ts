import { randomUUID } from "crypto";
import { hostname } from "os";

let sessionId: string | null = null;
let machineName: string | null = null;
let sessionStartMs = 0;

export function initSession(): void {
  sessionId = randomUUID();
  machineName = hostname();
  sessionStartMs = Date.now();
  console.log(`[activity] Session ${sessionId} on ${machineName}`);
}

export function getSessionId(): string {
  if (!sessionId) throw new Error("[activity] Session not initialized");
  return sessionId;
}

export function getMachine(): string {
  if (!machineName) throw new Error("[activity] Session not initialized");
  return machineName;
}

export function getSessionStartTime(): number {
  if (!sessionStartMs) throw new Error("[activity] Session not initialized");
  return sessionStartMs;
}

export function _resetSession(): void {
  sessionId = null;
  machineName = null;
  sessionStartMs = 0;
}
