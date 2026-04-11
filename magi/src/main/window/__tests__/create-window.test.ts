import { describe, expect, it } from "vitest";
import { getWindowOptions } from "../create-window";

describe("getWindowOptions", () => {
  it("keeps darwin free of Windows-only options", () => {
    const options = getWindowOptions("darwin");

    expect(options.titleBarStyle).toBe("hiddenInset");
    expect(options.backgroundMaterial).toBeUndefined();
    expect(options.titleBarOverlay).toBeUndefined();
    expect(options.roundedCorners).toBeUndefined();
  });

  it("keeps win32 free of mac-only options", () => {
    const options = getWindowOptions("win32", "10.0.22621");

    expect(options.frame).toBe(false);
    expect(options.titleBarOverlay).toBeDefined();
    expect(options.backgroundMaterial).toBe("acrylic");
    expect(options.titleBarStyle).toBeUndefined();
    expect(options.vibrancy).toBeUndefined();
    expect(options.visualEffectState).toBeUndefined();
  });

  it("falls back to linux defaults", () => {
    const options = getWindowOptions("linux");

    expect(options.frame).toBe(true);
    expect(options.backgroundColor).toBe("#0a0a0a");
    expect(options.titleBarOverlay).toBeUndefined();
    expect(options.backgroundMaterial).toBeUndefined();
  });
});
