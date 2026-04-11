import { ipcMain } from "electron";
import { queryRecentEvents, type RawActivityEvent } from "../activity/db";

function summarizeActivity(events: RawActivityEvent[]): string {
  if (events.length === 0) return "";

  const appDurations = new Map<string, number>();
  let typingSessions = 0;
  let idlePeriods = 0;
  let clipboardOps = 0;

  for (const event of events) {
    let data: Record<string, unknown>;
    try {
      data = JSON.parse(event.data) as Record<string, unknown>;
    } catch {
      continue;
    }

    switch (event.kind) {
      case "app_switch": {
        const app = String(data.from_app ?? "Unknown");
        const duration = Number(data.duration_ms ?? 0);
        appDurations.set(app, (appDurations.get(app) ?? 0) + duration);
        break;
      }
      case "window_focus": {
        const app = String(data.app ?? "Unknown");
        appDurations.set(app, (appDurations.get(app) ?? 0) + 0);
        break;
      }
      case "typing_end":
        typingSessions++;
        break;
      case "idle_start":
        idlePeriods++;
        break;
      case "clipboard":
        clipboardOps++;
        break;
    }
  }

  const parts: string[] = [];

  if (appDurations.size > 0) {
    const sorted = [...appDurations.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    const appParts = sorted.map(([app, ms]) => {
      const name = app.replace(/\.exe$/i, "");
      if (ms > 0) {
        const mins = Math.round(ms / 60_000);
        return mins > 0 ? `${name} (${mins} min)` : name;
      }
      return name;
    });
    parts.push(`Active in: ${appParts.join(", ")}`);
  }

  const extras: string[] = [];
  if (typingSessions > 0) extras.push(`${typingSessions} typing session${typingSessions > 1 ? "s" : ""}`);
  if (idlePeriods > 0) extras.push(`${idlePeriods} idle period${idlePeriods > 1 ? "s" : ""}`);
  if (clipboardOps > 0) extras.push(`${clipboardOps} clipboard op${clipboardOps > 1 ? "s" : ""}`);
  if (extras.length > 0) parts.push(extras.join(". "));

  return parts.join(". ") + (parts.length > 0 ? "." : "");
}

ipcMain.handle("activity:recent", (_event, payload: { sinceMinutes: number }) => {
  const sinceMs = Date.now() - payload.sinceMinutes * 60_000;
  const events = queryRecentEvents(sinceMs);
  return summarizeActivity(events);
});
