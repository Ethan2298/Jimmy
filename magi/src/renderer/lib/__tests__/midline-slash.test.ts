import { describe, expect, it } from "vitest";
import { CrepeFeature } from "@milkdown/crepe";

import {
  buildSlashCommandGroups,
  findMidlineSlashQuery,
  resolveSlashMenuRoot,
} from "../midline-slash";

describe("findMidlineSlashQuery", () => {
  it("detects a valid mid-line slash token", () => {
    const match = findMidlineSlashQuery("Hello /h2");
    expect(match).toEqual({
      slashIndex: 6,
      query: "h2",
      replaceFrom: 6,
      replaceTo: 9,
    });
  });

  it("supports start-line slash commands", () => {
    expect(findMidlineSlashQuery("/h2")).toEqual({
      slashIndex: 0,
      query: "h2",
      replaceFrom: 0,
      replaceTo: 3,
    });
  });

  it("supports slash commands on space-only lines", () => {
    expect(findMidlineSlashQuery("   /h2")).toEqual({
      slashIndex: 3,
      query: "h2",
      replaceFrom: 3,
      replaceTo: 6,
    });
  });

  it("ignores URL-like slashes", () => {
    expect(findMidlineSlashQuery("Visit https://example")).toBeNull();
  });

  it("closes when slash query contains whitespace", () => {
    expect(findMidlineSlashQuery("Hello /h2 world")).toBeNull();
  });

  it("uses the nearest valid slash token before cursor", () => {
    const match = findMidlineSlashQuery("Hello /h1 and /h2");
    expect(match?.query).toBe("h2");
    expect(match?.slashIndex).toBe(14);
  });

  it("rejects slash without a whitespace boundary", () => {
    expect(findMidlineSlashQuery("alpha/h2")).toBeNull();
  });
});

describe("buildSlashCommandGroups", () => {
  it("filters grouped commands by query", () => {
    const enabled = new Set<CrepeFeature>([
      CrepeFeature.ImageBlock,
      CrepeFeature.Table,
      CrepeFeature.Latex,
    ]);

    const groups = buildSlashCommandGroups("h2", enabled);
    expect(groups).toHaveLength(1);
    expect(groups[0].label).toBe("Text");
    expect(groups[0].commands.map((command) => command.id)).toEqual(["h2"]);
  });

  it("respects feature-gated advanced commands", () => {
    const withoutAdvancedFeatures = new Set<CrepeFeature>();
    const groups = buildSlashCommandGroups("", withoutAdvancedFeatures);

    const advanced = groups.find((group) => group.key === "advanced");
    expect(advanced?.commands.map((command) => command.id)).toEqual(["code"]);
  });
});

describe("resolveSlashMenuRoot", () => {
  it("returns nearest overlay root when present", () => {
    const overlayRoot = { nodeType: 1 } as HTMLElement;
    const parent = { nodeType: 1 } as HTMLElement;
    const viewDom = {
      closest: () => overlayRoot,
      parentElement: parent,
      ownerDocument: { body: { nodeType: 1 } as HTMLElement },
      nodeType: 1,
    } as unknown as HTMLElement;

    expect(resolveSlashMenuRoot(viewDom)).toBe(overlayRoot);
  });

  it("falls back to parent element when overlay root is missing", () => {
    const parent = { nodeType: 1 } as HTMLElement;
    const viewDom = {
      closest: () => null,
      parentElement: parent,
      ownerDocument: { body: { nodeType: 1 } as HTMLElement },
      nodeType: 1,
    } as unknown as HTMLElement;

    expect(resolveSlashMenuRoot(viewDom)).toBe(parent);
  });

  it("falls back safely when parent is missing", () => {
    const ownerBody = { nodeType: 1 } as HTMLElement;
    const viewDom = {
      closest: () => null,
      parentElement: null,
      ownerDocument: { body: ownerBody },
      nodeType: 1,
    } as unknown as HTMLElement;

    expect(resolveSlashMenuRoot(viewDom)).toBe(ownerBody);
  });
});
