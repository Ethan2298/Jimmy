import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("renderer platform boundaries", () => {
  it("scopes data-window-active styling to win32 selectors", () => {
    const css = readFileSync(resolve(process.cwd(), "src/renderer/app.css"), "utf8");
    const activeLines = css
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.includes("data-window-active"));

    expect(activeLines.length).toBeGreaterThan(0);
    expect(activeLines.every((line) => line.includes('data-platform="win32"'))).toBe(true);
  });

  it("keeps traffic-light spacing outside shared components", () => {
    const topBar = readFileSync(resolve(process.cwd(), "src/renderer/components/top-bar.tsx"), "utf8");
    const leftSidebar = readFileSync(
      resolve(process.cwd(), "src/renderer/components/left-sidebar.tsx"),
      "utf8"
    );

    expect(topBar).not.toContain("window.api.platform");
    expect(leftSidebar).not.toContain("window.api.platform");
  });
});
