import { describe, expect, it } from "vitest";
import {
  addWorkspaceItem,
  canMoveWorkspaceItem,
  createDummyWorkspaceState,
  deleteWorkspaceItem,
  getWorkspaceChildIds,
  moveWorkspaceItem,
  normalizeWorkspaceState,
  renameWorkspaceItem,
  selectWorkspaceItem,
  toggleWorkspaceFolder,
  updateWorkspaceDocContent,
} from "../workspace";

describe("workspace state", () => {
  it("creates a valid seeded dummy state", () => {
    const state = createDummyWorkspaceState();
    expect(state.rootIds.length).toBeGreaterThanOrEqual(2);
    expect(new Set(state.rootIds).size).toBe(state.rootIds.length);
    expect(state.rootIds.every((id) => !!state.items[id])).toBe(true);
    expect(Object.values(state.items).some((item) => item.type === "project")).toBe(true);
    const docIds = Object.values(state.items)
      .filter((item) => item.type === "doc")
      .map((item) => item.id);
    expect(Object.keys(state.docContentById).sort()).toEqual(docIds.sort());
  });

  it("adds items at root and inside folders", () => {
    const base = createDummyWorkspaceState();
    const withRootDoc = addWorkspaceItem(base, { type: "doc", parentId: null });
    const rootDocId = withRootDoc.editingId;
    expect(rootDocId).toBeTruthy();
    expect(withRootDoc.items[rootDocId!].parentId).toBeNull();
    expect(withRootDoc.rootIds).toContain(rootDocId!);
    expect(withRootDoc.docContentById[rootDocId!]).toBe("");

    const folderId = Object.values(withRootDoc.items).find((item) => item.type === "folder")!.id;
    const withNestedDoc = addWorkspaceItem(withRootDoc, { type: "doc", parentId: folderId });
    const nestedDocId = withNestedDoc.editingId;
    expect(nestedDocId).toBeTruthy();
    expect(withNestedDoc.items[nestedDocId!].parentId).toBe(folderId);

    const withProject = addWorkspaceItem(withNestedDoc, { type: "project", parentId: folderId });
    const projectId = withProject.editingId;
    expect(projectId).toBeTruthy();
    expect(withProject.items[projectId!].type).toBe("project");
    expect(withProject.items[projectId!].projectKind).toBe("dummy");
    expect(withProject.docContentById[projectId!]).toBeUndefined();
  });

  it("renames items and applies fallback labels for empty names", () => {
    const base = createDummyWorkspaceState();
    const withDoc = addWorkspaceItem(base, { type: "doc" });
    const docId = withDoc.editingId!;
    const renamedDoc = renameWorkspaceItem(withDoc, docId, "Roadmap Notes");
    expect(renamedDoc.items[docId].name).toBe("Roadmap Notes");
    const emptiedDoc = renameWorkspaceItem(renamedDoc, docId, "   ");
    expect(emptiedDoc.items[docId].name).toBe("");

    const withFolder = addWorkspaceItem(emptiedDoc, { type: "folder" });
    const folderId = withFolder.editingId!;
    const fallbackRenamed = renameWorkspaceItem(withFolder, folderId, "   ");
    expect(fallbackRenamed.items[folderId].name).toBe("Untitled Folder");
    expect(fallbackRenamed.editingId).toBeNull();

    const withProject = addWorkspaceItem(fallbackRenamed, { type: "project" });
    const projectId = withProject.editingId!;
    const renamedProject = renameWorkspaceItem(withProject, projectId, "   ");
    expect(renamedProject.items[projectId].name).toBe("Untitled");
  });

  it("deletes a folder and cascades to descendants", () => {
    const base = createDummyWorkspaceState();
    const folderId = Object.values(base.items).find(
      (item) => item.type === "folder" && getWorkspaceChildIds(base, item.id).length > 0
    )!.id;
    const descendantId = getWorkspaceChildIds(base, folderId)[0];
    const selected = selectWorkspaceItem(base, descendantId);
    const next = deleteWorkspaceItem(selected, folderId);

    expect(next.items[folderId]).toBeUndefined();
    expect(next.items[descendantId]).toBeUndefined();
    expect(next.docContentById[descendantId]).toBeUndefined();
    expect(next.selectedId).toBeNull();
  });

  it("updates doc content for docs only", () => {
    const base = createDummyWorkspaceState();
    const docId = Object.values(base.items).find((item) => item.type === "doc")!.id;
    const projectId = Object.values(base.items).find((item) => item.type === "project")!.id;

    const updated = updateWorkspaceDocContent(base, docId, "# Hello");
    expect(updated.docContentById[docId]).toBe("# Hello");

    const unchangedProject = updateWorkspaceDocContent(updated, projectId, "# Should Ignore");
    expect(unchangedProject).toBe(updated);
  });

  it("toggles folders only", () => {
    const base = createDummyWorkspaceState();
    const folderId = Object.values(base.items).find((item) => item.type === "folder")!.id;
    const docId = Object.values(base.items).find((item) => item.type === "doc")!.id;

    const toggled = toggleWorkspaceFolder(base, folderId);
    expect(toggled.items[folderId].collapsed).toBe(!(base.items[folderId].collapsed ?? false));

    const docToggle = toggleWorkspaceFolder(base, docId);
    expect(docToggle).toBe(base);
  });

  it("updates selection when items are selected and removed", () => {
    const base = createDummyWorkspaceState();
    const targetId = base.rootIds[0];
    const selected = selectWorkspaceItem(base, targetId);
    expect(selected.selectedId).toBe(targetId);

    const deleted = deleteWorkspaceItem(selected, targetId);
    expect(deleted.selectedId).toBeNull();
  });

  it("reorders root items with move", () => {
    const base = createDummyWorkspaceState();
    const firstRoot = base.rootIds[0];
    const lastRoot = base.rootIds[base.rootIds.length - 1];

    const moved = moveWorkspaceItem(base, {
      itemId: lastRoot,
      targetParentId: null,
      targetIndex: 0,
    });

    expect(moved.rootIds[0]).toBe(lastRoot);
    expect(moved.rootIds[1]).toBe(firstRoot);
  });

  it("moves a root doc into a folder at a specific index", () => {
    const base = createDummyWorkspaceState();
    const quickNotes = Object.values(base.items).find((item) => item.name === "Quick Notes")!;
    const projectsFolder = Object.values(base.items).find((item) => item.name === "Projects")!;
    const targetChildren = getWorkspaceChildIds(base, projectsFolder.id);

    const moved = moveWorkspaceItem(base, {
      itemId: quickNotes.id,
      targetParentId: projectsFolder.id,
      targetIndex: targetChildren.length,
    });

    expect(moved.items[quickNotes.id].parentId).toBe(projectsFolder.id);
    expect(moved.rootIds).not.toContain(quickNotes.id);
    expect(getWorkspaceChildIds(moved, projectsFolder.id).at(-1)).toBe(quickNotes.id);
  });

  it("blocks invalid cycle moves", () => {
    const base = createDummyWorkspaceState();
    const projectsFolder = Object.values(base.items).find((item) => item.name === "Projects")!;
    const outcomeFolder = Object.values(base.items).find((item) => item.name === "Outcome AI")!;

    expect(
      canMoveWorkspaceItem(base, {
        itemId: projectsFolder.id,
        targetParentId: outcomeFolder.id,
        targetIndex: 0,
      })
    ).toBe(false);

    const next = moveWorkspaceItem(base, {
      itemId: projectsFolder.id,
      targetParentId: outcomeFolder.id,
      targetIndex: 0,
    });

    expect(next).toBe(base);
  });

  it("normalizes legacy state by backfilling doc content", () => {
    const normalized = normalizeWorkspaceState({
      items: {
        folderA: { id: "folderA", type: "folder", name: "Folder", parentId: null, sortOrder: 0 },
        docA: { id: "docA", type: "doc", name: "Doc A", parentId: null, sortOrder: 1 },
        projectA: { id: "projectA", type: "project", name: "Proj", parentId: null, sortOrder: 2 },
      },
      rootIds: ["folderA", "docA", "projectA"],
      selectedId: "docA",
      editingId: null,
    });

    expect(normalized.docContentById).toEqual({ docA: "" });
  });

  it("normalizes doc content map and ignores invalid entries", () => {
    const normalized = normalizeWorkspaceState({
      items: {
        docA: { id: "docA", type: "doc", name: "Doc A", parentId: null, sortOrder: 0 },
        docB: { id: "docB", type: "doc", name: "Doc B", parentId: null, sortOrder: 1 },
        projectA: { id: "projectA", type: "project", name: "Proj", parentId: null, sortOrder: 2 },
      },
      docContentById: {
        docA: "# Existing",
        docB: 42,
        projectA: "not used",
        ghostDoc: "orphan",
      },
      rootIds: ["docA", "docB", "projectA"],
      selectedId: null,
      editingId: null,
    });

    expect(normalized.docContentById).toEqual({
      docA: "# Existing",
      docB: "",
    });
  });
});
