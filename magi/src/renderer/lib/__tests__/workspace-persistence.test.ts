import { describe, expect, it } from "vitest";
import {
  addWorkspaceItem,
  createDummyWorkspaceState,
  deleteWorkspaceItem,
  moveWorkspaceItem,
  toggleWorkspaceFolder,
  renameWorkspaceItem,
  type WorkspaceState,
} from "../workspace";
import { CHAT_MAIN_VIEW } from "../workspace-navigation";
import {
  buildWorkspaceSnapshot,
  diffSortOrders,
  resolveWorkspaceBootstrap,
} from "../workspace-persistence";

describe("workspace persistence bootstrap", () => {
  it("migrates valid legacy localStorage state when DB snapshot is empty", () => {
    const base = createDummyWorkspaceState();
    const docId = Object.values(base.items).find((item) => item.type === "doc")!.id;
    const legacyWorkspace = {
      ...base,
      docContentById: {
        ...base.docContentById,
        [docId]: "# Migrated note",
      },
      selectedId: docId,
    };
    const legacyMainView = { type: "workspace-item", itemId: docId };

    const result = resolveWorkspaceBootstrap({
      dbSnapshot: null,
      legacyWorkspaceRaw: JSON.stringify(legacyWorkspace),
      legacyMainViewRaw: JSON.stringify(legacyMainView),
    });

    expect(result.shouldSeedDb).toBe(true);
    expect(result.shouldClearLegacy).toBe(true);
    expect(result.workspaceState.docContentById[docId]).toBe("# Migrated note");
    expect(result.mainView).toEqual({ type: "workspace-item", itemId: docId });
  });

  it("falls back to defaults for malformed legacy state", () => {
    const result = resolveWorkspaceBootstrap({
      dbSnapshot: null,
      legacyWorkspaceRaw: "{not json}",
      legacyMainViewRaw: "{also bad}",
    });

    expect(result.shouldSeedDb).toBe(true);
    expect(result.shouldClearLegacy).toBe(false);
    expect(Object.keys(result.workspaceState.items).length).toBeGreaterThan(0);
    expect(result.mainView).toEqual(CHAT_MAIN_VIEW);
  });

  it("does not mark migration successful for structurally invalid legacy JSON", () => {
    const result = resolveWorkspaceBootstrap({
      dbSnapshot: null,
      legacyWorkspaceRaw: JSON.stringify({ foo: "bar" }),
      legacyMainViewRaw: JSON.stringify({ type: "workspace-item", itemId: "missing" }),
    });

    expect(result.shouldSeedDb).toBe(true);
    expect(result.shouldClearLegacy).toBe(false);
    expect(result.mainView).toEqual(CHAT_MAIN_VIEW);
  });

  it("uses DB snapshot and ignores legacy state when DB is populated", () => {
    const base = createDummyWorkspaceState();
    const docId = Object.values(base.items).find((item) => item.type === "doc")!.id;
    const dbSnapshot = buildWorkspaceSnapshot(base, { type: "workspace-item", itemId: docId });

    const result = resolveWorkspaceBootstrap({
      dbSnapshot,
      legacyWorkspaceRaw: JSON.stringify({ nonsense: true }),
      legacyMainViewRaw: JSON.stringify(CHAT_MAIN_VIEW),
    });

    expect(result.shouldSeedDb).toBe(false);
    expect(result.shouldClearLegacy).toBe(false);
    expect(result.mainView).toEqual({ type: "workspace-item", itemId: docId });
  });
});

describe("diffSortOrders", () => {
  function makeState(items: WorkspaceState["items"], rootIds?: string[]): WorkspaceState {
    return {
      items,
      docContentById: {},
      rootIds: rootIds ?? Object.values(items).filter((i) => !i.parentId).map((i) => i.id),
      selectedId: null,
      editingId: null,
    };
  }

  it("returns empty array when nothing changed", () => {
    const state = createDummyWorkspaceState();
    expect(diffSortOrders(state, state)).toEqual([]);
  });

  it("returns empty array for toggle (no sortOrder changes)", () => {
    const base = createDummyWorkspaceState();
    const folderId = Object.values(base.items).find((i) => i.type === "folder")!.id;
    const next = toggleWorkspaceFolder(base, folderId);
    expect(diffSortOrders(base, next)).toEqual([]);
  });

  it("returns empty array for rename (no sortOrder changes)", () => {
    const base = createDummyWorkspaceState();
    const docId = Object.values(base.items).find((i) => i.type === "doc")!.id;
    const next = renameWorkspaceItem(base, docId, "New Name");
    expect(diffSortOrders(base, next)).toEqual([]);
  });

  it("detects sibling reorders after delete", () => {
    const prev = makeState({
      a: { id: "a", type: "doc", name: "A", parentId: null, sortOrder: 0 },
      b: { id: "b", type: "doc", name: "B", parentId: null, sortOrder: 1 },
      c: { id: "c", type: "doc", name: "C", parentId: null, sortOrder: 2 },
    }, ["a", "b", "c"]);

    const next = deleteWorkspaceItem(prev, "a");
    const diff = diffSortOrders(prev, next);

    expect(diff).toContainEqual({ id: "b", sortOrder: 0 });
    expect(diff).toContainEqual({ id: "c", sortOrder: 1 });
    expect(diff.find((d) => d.id === "a")).toBeUndefined();
  });

  it("returns empty when deleting last item (no reorder needed)", () => {
    const prev = makeState({
      a: { id: "a", type: "doc", name: "A", parentId: null, sortOrder: 0 },
      b: { id: "b", type: "doc", name: "B", parentId: null, sortOrder: 1 },
    }, ["a", "b"]);

    const next = deleteWorkspaceItem(prev, "b");
    const diff = diffSortOrders(prev, next);

    expect(diff).toEqual([]);
  });

  it("detects sort order changes after move into folder", () => {
    const prev = makeState({
      f: { id: "f", type: "folder", name: "F", parentId: null, sortOrder: 0, collapsed: false },
      a: { id: "a", type: "doc", name: "A", parentId: null, sortOrder: 1 },
      b: { id: "b", type: "doc", name: "B", parentId: null, sortOrder: 2 },
    }, ["f", "a", "b"]);

    const next = moveWorkspaceItem(prev, { itemId: "b", targetParentId: "f", targetIndex: 0 });
    const diff = diffSortOrders(prev, next);

    // b moved from root (sortOrder 2) into folder f (sortOrder 0)
    expect(diff).toContainEqual({ id: "b", sortOrder: 0 });
    // a stays at sortOrder 1, f stays at 0 — neither changed
    expect(diff.find((d) => d.id === "a")).toBeUndefined();
    expect(diff.find((d) => d.id === "f")).toBeUndefined();
  });

  it("detects reorders when moving within same parent", () => {
    const prev = makeState({
      a: { id: "a", type: "doc", name: "A", parentId: null, sortOrder: 0 },
      b: { id: "b", type: "doc", name: "B", parentId: null, sortOrder: 1 },
      c: { id: "c", type: "doc", name: "C", parentId: null, sortOrder: 2 },
    }, ["a", "b", "c"]);

    // Move "a" to index 2 (after "c")
    const next = moveWorkspaceItem(prev, { itemId: "a", targetParentId: null, targetIndex: 2 });
    const diff = diffSortOrders(prev, next);

    // b: 1→0, c: 2→1, a: 0→2
    expect(diff).toContainEqual({ id: "b", sortOrder: 0 });
    expect(diff).toContainEqual({ id: "c", sortOrder: 1 });
    expect(diff).toContainEqual({ id: "a", sortOrder: 2 });
  });

  it("skips new items not present in prev", () => {
    const prev = makeState({
      a: { id: "a", type: "doc", name: "A", parentId: null, sortOrder: 0 },
    });

    const next = addWorkspaceItem(prev, { type: "doc" });
    const diff = diffSortOrders(prev, next);

    expect(diff).toEqual([]);
  });
});
