import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../session", () => ({
  initSession: vi.fn(),
}));

vi.mock("../db", () => ({
  initActivityDb: vi.fn(),
  closeActivityDb: vi.fn(),
}));

vi.mock("../window-watcher", () => ({
  startWindowWatcher: vi.fn(),
  stopWindowWatcher: vi.fn(),
}));

vi.mock("../clipboard", () => ({
  startClipboardWatcher: vi.fn(),
  stopClipboardWatcher: vi.fn(),
}));

vi.mock("../idle", () => ({
  startIdleWatcher: vi.fn(),
  stopIdleWatcher: vi.fn(),
}));

vi.mock("../keyboard", () => ({
  startKeyboardWatcher: vi.fn(),
  stopKeyboardWatcher: vi.fn(),
}));

import { startActivityTracker, stopActivityTracker } from "../index";
import { initSession } from "../session";
import { initActivityDb, closeActivityDb } from "../db";
import { startWindowWatcher, stopWindowWatcher } from "../window-watcher";
import { startClipboardWatcher, stopClipboardWatcher } from "../clipboard";
import { startIdleWatcher, stopIdleWatcher } from "../idle";
import { startKeyboardWatcher, stopKeyboardWatcher } from "../keyboard";

describe("activity tracker orchestration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("startActivityTracker activates session, db, and all watchers", () => {
    startActivityTracker();

    expect(initSession).toHaveBeenCalled();
    expect(initActivityDb).toHaveBeenCalledWith(expect.stringContaining("activity.db"));
    expect(startWindowWatcher).toHaveBeenCalled();
    expect(startClipboardWatcher).toHaveBeenCalled();
    expect(startIdleWatcher).toHaveBeenCalled();
    expect(startKeyboardWatcher).toHaveBeenCalled();
  });

  it("stopActivityTracker stops all watchers and closes db", () => {
    stopActivityTracker();

    expect(stopWindowWatcher).toHaveBeenCalled();
    expect(stopClipboardWatcher).toHaveBeenCalled();
    expect(stopIdleWatcher).toHaveBeenCalled();
    expect(stopKeyboardWatcher).toHaveBeenCalled();
    expect(closeActivityDb).toHaveBeenCalled();
  });
});
