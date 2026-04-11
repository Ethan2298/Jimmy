import { spawn, ChildProcess } from "child_process";
import { app } from "electron";
import path from "path";
import { insertEvent } from "./db";
import type { WindowFocusData, AppSwitchData } from "./types";

let child: ChildProcess | null = null;

export function startWindowWatcher(): void {
  if (child) return;

  if (process.platform !== "win32") {
    console.log("[activity] Window watcher skipped (not Windows)");
    return;
  }

  const scriptPath = app.isPackaged
    ? path.join(process.resourcesPath, "window-watcher.ps1")
    : path.join(__dirname, "../../native/window-watcher.ps1");

  child = spawn("powershell.exe", ["-ExecutionPolicy", "Bypass", "-File", scriptPath], {
    stdio: ["ignore", "pipe", "pipe"],
  });

  let buffer = "";

  child.stdout!.on("data", (chunk: Buffer) => {
    buffer += chunk.toString();
    const lines = buffer.split("\n");
    buffer = lines.pop()!; // keep incomplete line in buffer

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      try {
        const event = JSON.parse(trimmed);
        if (event.type === "window_focus") {
          const data: WindowFocusData = {
            app: event.app,
            title: event.title,
            pid: event.pid,
          };
          insertEvent("window_focus", data);
        } else if (event.type === "app_switch") {
          const data: AppSwitchData = {
            from_app: event.from_app,
            from_title: event.from_title,
            to_app: event.to_app,
            to_title: event.to_title,
            duration_ms: event.duration_ms,
          };
          insertEvent("app_switch", data);
        }
      } catch {
        // Skip malformed lines
      }
    }
  });

  child.stderr!.on("data", (chunk: Buffer) => {
    console.log("[activity] window-watcher:", chunk.toString().trim());
  });

  child.on("exit", (code) => {
    console.log(`[activity] window-watcher exited with code ${code}`);
    child = null;
  });

  console.log("[activity] Window watcher started");
}

export function stopWindowWatcher(): void {
  if (child) {
    child.kill();
    child = null;
    console.log("[activity] Window watcher stopped");
  }
}
