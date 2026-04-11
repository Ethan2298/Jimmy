import { describe, it, expect, beforeEach } from "vitest";
import { initSession, getSessionId, getMachine, getSessionStartTime, _resetSession } from "../session";

describe("session", () => {
  beforeEach(() => {
    _resetSession();
  });

  it("throws before initSession()", () => {
    expect(() => getSessionId()).toThrow("[activity] Session not initialized");
    expect(() => getMachine()).toThrow("[activity] Session not initialized");
    expect(() => getSessionStartTime()).toThrow("[activity] Session not initialized");
  });

  it("returns valid values after initSession()", () => {
    initSession();

    const id = getSessionId();
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);

    const machine = getMachine();
    expect(typeof machine).toBe("string");
    expect(machine.length).toBeGreaterThan(0);

    const start = getSessionStartTime();
    expect(start).toBeGreaterThan(0);
    expect(start).toBeLessThanOrEqual(Date.now());
  });

  it("_resetSession() clears state so getters throw again", () => {
    initSession();
    expect(() => getSessionId()).not.toThrow();

    _resetSession();
    expect(() => getSessionId()).toThrow("[activity] Session not initialized");
  });
});
