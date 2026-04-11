import { describe, expect, it } from "vitest";
import { CHAT_MAIN_VIEW } from "../workspace-navigation";
import { createDummyWorkspaceState } from "../workspace";
import { resolveUniversalHeader } from "../universal-header";

describe("universal header", () => {
  it("resolves thread header from active chat thread", () => {
    const header = resolveUniversalHeader({
      mainView: CHAT_MAIN_VIEW,
      activeThread: { title: "Sprint planning" },
      activeWorkspaceItem: null,
    });

    expect(header).toEqual({
      contentType: "thread",
      title: "Sprint planning",
    });
  });

  it("falls back to default thread title when no active thread exists", () => {
    const header = resolveUniversalHeader({
      mainView: CHAT_MAIN_VIEW,
      activeThread: null,
      activeWorkspaceItem: null,
    });

    expect(header).toEqual({
      contentType: "thread",
      title: "New thread",
    });
  });

  it("resolves project header when project view is active", () => {
    const workspace = createDummyWorkspaceState();
    const project = Object.values(workspace.items).find((item) => item.type === "project");
    expect(project).toBeTruthy();

    const header = resolveUniversalHeader({
      mainView: { type: "workspace-item", itemId: project!.id },
      activeThread: { title: "Ignored thread title" },
      activeWorkspaceItem: project!,
    });

    expect(header).toEqual({
      contentType: "project",
      title: project!.name,
    });
  });

  it("resolves doc header when doc view is active", () => {
    const workspace = createDummyWorkspaceState();
    const doc = Object.values(workspace.items).find((item) => item.type === "doc");
    expect(doc).toBeTruthy();

    const header = resolveUniversalHeader({
      mainView: { type: "workspace-item", itemId: doc!.id },
      activeThread: { title: "Ignored thread title" },
      activeWorkspaceItem: doc!,
    });

    expect(header).toEqual({
      contentType: "doc",
      title: doc!.name,
    });
  });

  it("falls back to thread header for invalid workspace selection", () => {
    const header = resolveUniversalHeader({
      mainView: { type: "workspace-item", itemId: "missing-item" },
      activeThread: null,
      activeWorkspaceItem: null,
    });

    expect(header).toEqual({
      contentType: "thread",
      title: "New thread",
    });
  });
});
