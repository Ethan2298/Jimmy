import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { powerMonitor } from "electron";
import { initActivityDb, closeActivityDb, getActivityDb } from "../db";
import { initSession, _resetSession } from "../session";
import { startIdleWatcher, stopIdleWatcher } from "../idle";

describe("idle watcher", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    _resetSession();
    initSession();
    initActivityDb(":memory:");
    vi.mocked(powerMonitor.getSystemIdleTime).mockReturnValue(0);
  });

  afterEach(() => {
    stopIdleWatcher();
    closeActivityDb();
    vi.useRealTimers();
  });

  function getEvents() {
    return getActivityDb()!
      .prepare("SELECT kind, data FROM events ORDER BY rowid")
      .all() as { kind: string; data: string }[];
  }

  it("idle_start when getSystemIdleTime >= 120s", () => {
    startIdleWatcher();

    vi.mocked(powerMonitor.getSystemIdleTime).mockReturnValue(120);
    vi.advanceTimersByTime(10_000); // trigger poll

    const events = getEvents();
    expect(events).toHaveLength(1);
    expect(events[0].kind).toBe("idle_start");
    expect(JSON.parse(events[0].data).idle_seconds).toBe(120);
  });

  it("no duplicate idle_start while already idle", () => {
    startIdleWatcher();

    vi.mocked(powerMonitor.getSystemIdleTime).mockReturnValue(120);
    vi.advanceTimersByTime(10_000);
    vi.advanceTimersByTime(10_000);
    vi.advanceTimersByTime(10_000);

    const events = getEvents();
    const starts = events.filter((e) => e.kind === "idle_start");
    expect(starts).toHaveLength(1);
  });

  it("idle_end when idle drops below threshold, with correct duration_ms", () => {
    startIdleWatcher();

    vi.mocked(powerMonitor.getSystemIdleTime).mockReturnValue(120);
    vi.advanceTimersByTime(10_000); // go idle

    vi.mocked(powerMonitor.getSystemIdleTime).mockReturnValue(0);
    vi.advanceTimersByTime(10_000); // come back

    const events = getEvents();
    expect(events).toHaveLength(2);
    expect(events[1].kind).toBe("idle_end");
    const data = JSON.parse(events[1].data);
    expect(data.duration_ms).toBeGreaterThan(0);
  });

  it("full cycle: active → idle → active → idle", () => {
    startIdleWatcher();

    // Active → idle
    vi.mocked(powerMonitor.getSystemIdleTime).mockReturnValue(200);
    vi.advanceTimersByTime(10_000);

    // Idle → active
    vi.mocked(powerMonitor.getSystemIdleTime).mockReturnValue(0);
    vi.advanceTimersByTime(10_000);

    // Active → idle again
    vi.mocked(powerMonitor.getSystemIdleTime).mockReturnValue(300);
    vi.advanceTimersByTime(10_000);

    const events = getEvents();
    const kinds = events.map((e) => e.kind);
    expect(kinds).toEqual(["idle_start", "idle_end", "idle_start"]);
  });
});
