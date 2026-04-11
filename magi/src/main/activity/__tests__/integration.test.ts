import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { clipboard, powerMonitor, desktopCapturer, app } from "electron";
import { uIOhook } from "uiohook-napi";
import { initSession, _resetSession } from "../session";
import { initActivityDb, closeActivityDb, getActivityDb, insertEvent } from "../db";
import { startKeyboardWatcher, stopKeyboardWatcher } from "../keyboard";
import { startIdleWatcher, stopIdleWatcher } from "../idle";
import { startClipboardWatcher, stopClipboardWatcher } from "../clipboard";

// Mock fs and child_process so window-watcher and screenshots don't hit real FS
vi.mock("fs", () => ({
  default: {
    existsSync: vi.fn(() => true),
    mkdirSync: vi.fn(),
    writeFileSync: vi.fn(),
  },
  existsSync: vi.fn(() => true),
  mkdirSync: vi.fn(),
  writeFileSync: vi.fn(),
}));

vi.mock("child_process", () => ({
  spawn: vi.fn(() => {
    const { EventEmitter } = require("events");
    const stdout = new EventEmitter();
    const stderr = new EventEmitter();
    return Object.assign(new EventEmitter(), { stdout, stderr, kill: vi.fn(), pid: 1 });
  }),
}));

describe("activity tracker integration", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    _resetSession();
    initSession();
    initActivityDb(":memory:");

    vi.mocked(clipboard.readText).mockReturnValue("");
    vi.mocked(powerMonitor.getSystemIdleTime).mockReturnValue(0);
    vi.mocked(desktopCapturer.getSources).mockResolvedValue([]);
    vi.mocked(app.getPath).mockReturnValue("/tmp");
  });

  afterEach(() => {
    stopKeyboardWatcher();
    stopIdleWatcher();
    stopClipboardWatcher();
    closeActivityDb();
    vi.useRealTimers();
  });

  function getEvents() {
    return getActivityDb()!
      .prepare("SELECT kind, data FROM events ORDER BY rowid")
      .all() as { kind: string; data: string }[];
  }

  it("start → events → stop: full lifecycle", async () => {
    await startKeyboardWatcher();
    startIdleWatcher();
    startClipboardWatcher();

    // Keyboard event
    uIOhook._emit("keydown", {});
    expect(getEvents().some((e) => e.kind === "typing_start")).toBe(true);

    // Clipboard change
    vi.mocked(clipboard.readText).mockReturnValue("new clipboard");
    vi.advanceTimersByTime(5000);
    expect(getEvents().some((e) => e.kind === "clipboard")).toBe(true);

    // Idle event
    vi.mocked(powerMonitor.getSystemIdleTime).mockReturnValue(200);
    vi.advanceTimersByTime(10_000);
    expect(getEvents().some((e) => e.kind === "idle_start")).toBe(true);

    // Stop everything
    stopKeyboardWatcher();
    stopIdleWatcher();
    stopClipboardWatcher();

    // Typing end should be flushed
    expect(getEvents().some((e) => e.kind === "typing_end")).toBe(true);
  });

  it("keyboard flush on shutdown: typing_end flushed when stopped mid-session", async () => {
    await startKeyboardWatcher();

    uIOhook._emit("keydown", {});
    uIOhook._emit("keydown", {});
    uIOhook._emit("keydown", {});

    // Stop mid-typing — no 5s gap yet
    stopKeyboardWatcher();

    const events = getEvents();
    const typingEnd = events.find((e) => e.kind === "typing_end");
    expect(typingEnd).toBeDefined();
    expect(JSON.parse(typingEnd!.data).key_count).toBe(3);
  });

  it("no dangling timers: after stop, advancing timers produces no new events", async () => {
    await startKeyboardWatcher();
    startIdleWatcher();
    startClipboardWatcher();

    uIOhook._emit("keydown", {});

    stopKeyboardWatcher();
    stopIdleWatcher();
    stopClipboardWatcher();

    const countAfterStop = getEvents().length;

    // Advance timers significantly
    vi.advanceTimersByTime(60_000);

    expect(getEvents().length).toBe(countAfterStop);
  });

  it("DB closed after stop: insertEvent throws", async () => {
    await startKeyboardWatcher();
    stopKeyboardWatcher();
    closeActivityDb();

    expect(() => insertEvent("clipboard", { text: "x", length: 1 })).toThrow();
  });
});
