import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { EventEmitter } from "events";
import { initActivityDb, closeActivityDb, getActivityDb } from "../db";
import { initSession, _resetSession } from "../session";

// Mock child_process before importing the module under test
vi.mock("child_process", () => {
  return {
    spawn: vi.fn(),
  };
});

import { spawn } from "child_process";
import { startWindowWatcher, stopWindowWatcher } from "../window-watcher";

function createMockChild() {
  const stdout = new EventEmitter();
  const stderr = new EventEmitter();
  const child = Object.assign(new EventEmitter(), {
    stdout,
    stderr,
    kill: vi.fn(),
    pid: 1234,
  });
  return child;
}

describe("window watcher", () => {
  const originalPlatform = process.platform;

  beforeEach(() => {
    _resetSession();
    initSession();
    initActivityDb(":memory:");
    Object.defineProperty(process, "platform", { value: "win32", writable: true });
    vi.mocked(spawn).mockReset();
  });

  afterEach(() => {
    stopWindowWatcher();
    closeActivityDb();
    Object.defineProperty(process, "platform", { value: originalPlatform, writable: true });
  });

  function getEvents() {
    return getActivityDb()!
      .prepare("SELECT kind, data FROM events ORDER BY rowid")
      .all() as { kind: string; data: string }[];
  }

  it("spawns with correct args and parses JSON stdout into events", () => {
    const child = createMockChild();
    vi.mocked(spawn).mockReturnValue(child as never);

    startWindowWatcher();

    expect(spawn).toHaveBeenCalledWith(
      "powershell.exe",
      expect.arrayContaining(["-ExecutionPolicy", "Bypass", "-File"]),
      expect.objectContaining({ stdio: ["ignore", "pipe", "pipe"] })
    );

    // Emit a window_focus event
    const event = JSON.stringify({ type: "window_focus", app: "Code", title: "test.ts", pid: 42 });
    child.stdout.emit("data", Buffer.from(event + "\n"));

    const events = getEvents();
    expect(events).toHaveLength(1);
    expect(events[0].kind).toBe("window_focus");
    const data = JSON.parse(events[0].data);
    expect(data.app).toBe("Code");
    expect(data.title).toBe("test.ts");
    expect(data.pid).toBe(42);
  });

  it("handles partial lines (buffering)", () => {
    const child = createMockChild();
    vi.mocked(spawn).mockReturnValue(child as never);

    startWindowWatcher();

    const full = JSON.stringify({ type: "window_focus", app: "Chrome", title: "Google", pid: 10 });
    // Send in two chunks
    child.stdout.emit("data", Buffer.from(full.slice(0, 10)));
    child.stdout.emit("data", Buffer.from(full.slice(10) + "\n"));

    const events = getEvents();
    expect(events).toHaveLength(1);
    expect(JSON.parse(events[0].data).app).toBe("Chrome");
  });

  it("handles malformed JSON", () => {
    const child = createMockChild();
    vi.mocked(spawn).mockReturnValue(child as never);

    startWindowWatcher();

    child.stdout.emit("data", Buffer.from("not valid json\n"));

    const events = getEvents();
    expect(events).toHaveLength(0);
  });

  it("stopWindowWatcher kills child process", () => {
    const child = createMockChild();
    vi.mocked(spawn).mockReturnValue(child as never);

    startWindowWatcher();
    stopWindowWatcher();

    expect(child.kill).toHaveBeenCalled();
  });

  it("skips on non-Windows", () => {
    Object.defineProperty(process, "platform", { value: "linux", writable: true });
    const child = createMockChild();
    vi.mocked(spawn).mockReturnValue(child as never);

    startWindowWatcher();

    expect(spawn).not.toHaveBeenCalled();
  });
});
