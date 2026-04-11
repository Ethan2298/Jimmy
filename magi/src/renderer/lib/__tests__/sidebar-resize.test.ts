import { describe, expect, it } from "vitest";
import {
  clampSidebarWidth,
  DEFAULT_WIDTH,
  MAX_WIDTH,
  MIN_WIDTH,
  parseStoredSidebarWidth,
} from "../sidebar-resize";

describe("sidebar-resize", () => {
  it("clamps width below minimum", () => {
    expect(clampSidebarWidth(MIN_WIDTH - 50)).toBe(MIN_WIDTH);
  });

  it("clamps width above maximum", () => {
    expect(clampSidebarWidth(MAX_WIDTH + 50)).toBe(MAX_WIDTH);
  });

  it("keeps width in range unchanged", () => {
    expect(clampSidebarWidth(316)).toBe(316);
  });

  it("returns default width for null storage value", () => {
    expect(parseStoredSidebarWidth(null)).toBe(DEFAULT_WIDTH);
  });

  it("returns default width for invalid or non-finite values", () => {
    expect(parseStoredSidebarWidth("abc")).toBe(DEFAULT_WIDTH);
    expect(parseStoredSidebarWidth("Infinity")).toBe(DEFAULT_WIDTH);
    expect(parseStoredSidebarWidth("NaN")).toBe(DEFAULT_WIDTH);
  });

  it("parses and clamps stored widths", () => {
    expect(parseStoredSidebarWidth("260")).toBe(260);
    expect(parseStoredSidebarWidth(String(MIN_WIDTH - 1))).toBe(MIN_WIDTH);
    expect(parseStoredSidebarWidth(String(MAX_WIDTH + 1))).toBe(MAX_WIDTH);
  });
});
