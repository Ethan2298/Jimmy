import { describe, expect, it } from "vitest";
import { getShellProps } from "../config";
import { resolveShellComponent } from "..";
import { MacShell } from "../mac-shell";
import { WinShell } from "../win-shell";
import { LinuxShell } from "../linux-shell";

describe("shell config", () => {
  it("enables active/inactive tint on Windows only", () => {
    expect(getShellProps("win32").applyActiveInactiveTint).toBe(true);
    expect(getShellProps("darwin").applyActiveInactiveTint).toBe(false);
    expect(getShellProps("linux").applyActiveInactiveTint).toBe(false);
  });

  it("routes each platform to the correct shell component", () => {
    expect(resolveShellComponent("darwin")).toBe(MacShell);
    expect(resolveShellComponent("win32")).toBe(WinShell);
    expect(resolveShellComponent("linux")).toBe(LinuxShell);
  });

  it("keeps mac and linux off the Windows glass layout", () => {
    expect(getShellProps("win32").useWindowsGlassLayout).toBe(true);
    expect(getShellProps("darwin").useWindowsGlassLayout).toBe(false);
    expect(getShellProps("linux").useWindowsGlassLayout).toBe(false);
  });
});
