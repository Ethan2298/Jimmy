import { vi } from "vitest";

export const powerMonitor = {
  getSystemIdleTime: vi.fn(() => 0),
  on: vi.fn(),
  removeListener: vi.fn(),
};

export const clipboard = {
  readText: vi.fn(() => ""),
};

export const ipcMain = {
  handle: vi.fn(),
  on: vi.fn(),
};

export const app = {
  getPath: vi.fn(() => "/tmp"),
  getName: vi.fn(() => "test"),
};

export const BrowserWindow = vi.fn();

export const screen = {
  getPrimaryDisplay: vi.fn(() => ({
    workAreaSize: { width: 1920, height: 1080 },
  })),
};

export const desktopCapturer = {
  getSources: vi.fn(async () => []),
};

export const systemPreferences = {
  getMediaAccessStatus: vi.fn(() => "granted"),
};

export const globalShortcut = {
  register: vi.fn(),
  unregister: vi.fn(),
  unregisterAll: vi.fn(),
};
