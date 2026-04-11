import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { clipboard } from "electron";
import { initActivityDb, closeActivityDb, getActivityDb } from "../db";
import { initSession, _resetSession } from "../session";
import { startClipboardWatcher, stopClipboardWatcher } from "../clipboard";

describe("clipboard watcher", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    _resetSession();
    initSession();
    initActivityDb(":memory:");
    vi.mocked(clipboard.readText).mockReturnValue("");
  });

  afterEach(() => {
    stopClipboardWatcher();
    closeActivityDb();
    vi.useRealTimers();
  });

  function getEvents() {
    return getActivityDb()!
      .prepare("SELECT kind, data FROM events ORDER BY rowid")
      .all() as { kind: string; data: string }[];
  }

  it("initial read captured but not logged", () => {
    vi.mocked(clipboard.readText).mockReturnValue("initial text");
    startClipboardWatcher();

    // No events yet — initial state is just captured, not logged
    const events = getEvents();
    expect(events).toHaveLength(0);
  });

  it("change detected → event with text and length", () => {
    vi.mocked(clipboard.readText).mockReturnValue("");
    startClipboardWatcher();

    vi.mocked(clipboard.readText).mockReturnValue("hello world");
    vi.advanceTimersByTime(5000);

    const events = getEvents();
    expect(events).toHaveLength(1);
    expect(events[0].kind).toBe("clipboard");
    const data = JSON.parse(events[0].data);
    expect(data.text).toBe("hello world");
    expect(data.length).toBe(11);
  });

  it("deduplication (same text = no repeat events)", () => {
    vi.mocked(clipboard.readText).mockReturnValue("");
    startClipboardWatcher();

    vi.mocked(clipboard.readText).mockReturnValue("same text");
    vi.advanceTimersByTime(5000);
    vi.advanceTimersByTime(5000);
    vi.advanceTimersByTime(5000);

    const events = getEvents();
    expect(events).toHaveLength(1);
  });

  it("truncation at 10k chars (stores original length)", () => {
    vi.mocked(clipboard.readText).mockReturnValue("");
    startClipboardWatcher();

    const longText = "x".repeat(15_000);
    vi.mocked(clipboard.readText).mockReturnValue(longText);
    vi.advanceTimersByTime(5000);

    const events = getEvents();
    const data = JSON.parse(events[0].data);
    expect(data.text.length).toBe(10_000);
    expect(data.length).toBe(15_000);
  });

  it("silent error handling", () => {
    vi.mocked(clipboard.readText).mockReturnValue("");
    startClipboardWatcher();

    vi.mocked(clipboard.readText).mockImplementation(() => {
      throw new Error("clipboard access denied");
    });

    // Should not throw
    vi.advanceTimersByTime(5000);

    const events = getEvents();
    expect(events).toHaveLength(0);
  });
});
