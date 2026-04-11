import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { uIOhook } from "uiohook-napi";
import { initActivityDb, closeActivityDb, getActivityDb } from "../db";
import { initSession, _resetSession } from "../session";
import { startKeyboardWatcher, stopKeyboardWatcher } from "../keyboard";

describe("keyboard watcher", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    _resetSession();
    initSession();
    initActivityDb(":memory:");
  });

  afterEach(() => {
    stopKeyboardWatcher();
    closeActivityDb();
    vi.useRealTimers();
  });

  function getEvents() {
    return getActivityDb()!
      .prepare("SELECT kind, data FROM events ORDER BY rowid")
      .all() as { kind: string; data: string }[];
  }

  it("first keydown fires typing_start, subsequent keys don't", async () => {
    await startKeyboardWatcher();

    uIOhook._emit("keydown", {});
    uIOhook._emit("keydown", {});
    uIOhook._emit("keydown", {});

    const events = getEvents();
    const starts = events.filter((e) => e.kind === "typing_start");
    expect(starts).toHaveLength(1);
  });

  it("typing_end fires after 5s silence with correct key_count and duration_ms", async () => {
    await startKeyboardWatcher();

    const startTime = Date.now();
    uIOhook._emit("keydown", {});
    uIOhook._emit("keydown", {});
    uIOhook._emit("keydown", {});

    vi.advanceTimersByTime(5000);

    const events = getEvents();
    const end = events.find((e) => e.kind === "typing_end");
    expect(end).toBeDefined();

    const data = JSON.parse(end!.data);
    expect(data.key_count).toBe(3);
    expect(data.duration_ms).toBeGreaterThanOrEqual(0);
  });

  it("continued typing resets the 5s gap timer", async () => {
    await startKeyboardWatcher();

    uIOhook._emit("keydown", {});
    vi.advanceTimersByTime(3000);

    // Type again before 5s — should reset timer
    uIOhook._emit("keydown", {});
    vi.advanceTimersByTime(3000);

    // Still within 5s of last key, no typing_end yet
    let events = getEvents();
    expect(events.filter((e) => e.kind === "typing_end")).toHaveLength(0);

    // Now let the full 5s elapse
    vi.advanceTimersByTime(2000);
    events = getEvents();
    expect(events.filter((e) => e.kind === "typing_end")).toHaveLength(1);

    const data = JSON.parse(events.find((e) => e.kind === "typing_end")!.data);
    expect(data.key_count).toBe(2);
  });

  it("stopKeyboardWatcher flushes in-progress session", async () => {
    await startKeyboardWatcher();

    uIOhook._emit("keydown", {});
    uIOhook._emit("keydown", {});

    stopKeyboardWatcher();

    const events = getEvents();
    expect(events.filter((e) => e.kind === "typing_end")).toHaveLength(1);
    const data = JSON.parse(events.find((e) => e.kind === "typing_end")!.data);
    expect(data.key_count).toBe(2);
  });

  it("idempotent start/stop", async () => {
    await startKeyboardWatcher();
    await startKeyboardWatcher(); // no-op

    stopKeyboardWatcher();
    stopKeyboardWatcher(); // no-op

    // No errors thrown
  });
});
