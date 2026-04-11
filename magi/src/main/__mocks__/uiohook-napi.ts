import { vi } from "vitest";

type Listener = (...args: unknown[]) => void;

const listeners = new Map<string, Set<Listener>>();

export const uIOhook = {
  on: vi.fn((event: string, cb: Listener) => {
    if (!listeners.has(event)) listeners.set(event, new Set());
    listeners.get(event)!.add(cb);
  }),
  off: vi.fn((event: string, cb: Listener) => {
    listeners.get(event)?.delete(cb);
  }),
  start: vi.fn(),
  stop: vi.fn(),
  _emit(event: string, data?: unknown) {
    listeners.get(event)?.forEach((cb) => cb(data));
  },
  _listeners: listeners,
};
