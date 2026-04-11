import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { desktopCapturer, app } from "electron";
import { initActivityDb, closeActivityDb, getActivityDb } from "../db";
import { initSession, _resetSession } from "../session";

vi.mock("fs", () => {
  return {
    default: {
      existsSync: vi.fn(() => true),
      mkdirSync: vi.fn(),
      writeFileSync: vi.fn(),
    },
    existsSync: vi.fn(() => true),
    mkdirSync: vi.fn(),
    writeFileSync: vi.fn(),
  };
});

import { startScreenshots, stopScreenshots } from "../screenshots";

function mockSource(width = 1920, height = 1080) {
  const image = {
    isEmpty: vi.fn(() => false),
    toJPEG: vi.fn(() => Buffer.from("fake-jpeg")),
    getSize: vi.fn(() => ({ width, height })),
  };
  vi.mocked(desktopCapturer.getSources).mockResolvedValue([
    { thumbnail: image, id: "screen:0", name: "Screen 1", display_id: "0", appIcon: null as never },
  ]);
  return image;
}

describe("screenshots", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    _resetSession();
    initSession();
    initActivityDb(":memory:");
    vi.mocked(app.getPath).mockReturnValue("/tmp");
    vi.mocked(desktopCapturer.getSources).mockResolvedValue([]);
  });

  afterEach(() => {
    stopScreenshots();
    closeActivityDb();
    vi.useRealTimers();
  });

  function getEvents() {
    return getActivityDb()!
      .prepare("SELECT kind, data FROM events ORDER BY rowid")
      .all() as { kind: string; data: string }[];
  }

  it("immediate capture on start + 30s interval", async () => {
    mockSource();
    startScreenshots();

    // Immediate capture is async — flush microtasks
    await vi.advanceTimersByTimeAsync(0);
    expect(getEvents()).toHaveLength(1);

    // After 30s, another capture
    await vi.advanceTimersByTimeAsync(30_000);
    expect(getEvents()).toHaveLength(2);
  });

  it("inserts event with relative path, width, height", async () => {
    mockSource(1920, 1080);
    startScreenshots();
    await vi.advanceTimersByTimeAsync(0);

    const events = getEvents();
    expect(events).toHaveLength(1);
    expect(events[0].kind).toBe("screenshot");
    const data = JSON.parse(events[0].data);
    expect(data.path).toMatch(/screenshots\//);
    expect(data.width).toBe(1920);
    expect(data.height).toBe(1080);
  });

  it("skips when no sources", async () => {
    vi.mocked(desktopCapturer.getSources).mockResolvedValue([]);
    startScreenshots();
    await vi.advanceTimersByTimeAsync(0);

    expect(getEvents()).toHaveLength(0);
  });

  it("skips when empty image", async () => {
    const image = {
      isEmpty: vi.fn(() => true),
      toJPEG: vi.fn(() => Buffer.from("")),
      getSize: vi.fn(() => ({ width: 0, height: 0 })),
    };
    vi.mocked(desktopCapturer.getSources).mockResolvedValue([
      { thumbnail: image, id: "screen:0", name: "Screen 1", display_id: "0", appIcon: null as never },
    ]);
    startScreenshots();
    await vi.advanceTimersByTimeAsync(0);

    expect(getEvents()).toHaveLength(0);
  });

  it("handles errors gracefully", async () => {
    vi.mocked(desktopCapturer.getSources).mockRejectedValue(new Error("no permission"));
    startScreenshots();

    // Should not throw
    await vi.advanceTimersByTimeAsync(0);
    expect(getEvents()).toHaveLength(0);
  });
});
