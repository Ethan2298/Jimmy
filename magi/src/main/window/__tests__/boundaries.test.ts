import { readdirSync, readFileSync } from "node:fs";
import { relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

function listSourceFiles(dir: string): string[] {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = resolve(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...listSourceFiles(fullPath));
      continue;
    }

    if (entry.isFile() && fullPath.endsWith(".ts")) {
      const rel = relative(resolve(process.cwd()), fullPath);
      if (!rel.includes("/__tests__/") && !rel.includes("/__mocks__/")) {
        files.push(rel);
      }
    }
  }

  return files;
}

describe("main platform boundaries", () => {
  const mainFiles = listSourceFiles(resolve(process.cwd(), "src/main"));

  it("keeps backgroundMaterial in Windows module only", () => {
    const matches = mainFiles.filter((file) =>
      readFileSync(resolve(process.cwd(), file), "utf8").includes("backgroundMaterial")
    );

    expect(matches).toEqual(["src/main/window/platforms/win.ts"]);
  });

  it("keeps titleBarOverlay in Windows module only", () => {
    const matches = mainFiles.filter((file) =>
      readFileSync(resolve(process.cwd(), file), "utf8").includes("titleBarOverlay")
    );

    expect(matches).toEqual(["src/main/window/platforms/win.ts"]);
  });
});
