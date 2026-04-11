import { describe, expect, it } from "vitest";
import { createDummyWorkspaceState, deleteWorkspaceItem } from "../workspace";
import {
  CHAT_MAIN_VIEW,
  normalizeMainView,
  resolveMainViewAfterWorkspaceSelection,
} from "../workspace-navigation";

describe("workspace navigation", () => {
  it("keeps chat view when selecting a folder", () => {
    const state = createDummyWorkspaceState();
    const folder = Object.values(state.items).find((item) => item.type === "folder");
    expect(folder).toBeTruthy();
    const next = resolveMainViewAfterWorkspaceSelection(CHAT_MAIN_VIEW, state, folder!.id);
    expect(next).toEqual(CHAT_MAIN_VIEW);
  });

  it("opens page view when selecting doc or project", () => {
    const state = createDummyWorkspaceState();
    const doc = Object.values(state.items).find((item) => item.type === "doc");
    const project = Object.values(state.items).find((item) => item.type === "project");
    expect(doc).toBeTruthy();
    expect(project).toBeTruthy();

    const fromDoc = resolveMainViewAfterWorkspaceSelection(CHAT_MAIN_VIEW, state, doc!.id);
    expect(fromDoc).toEqual({ type: "workspace-item", itemId: doc!.id });

    const fromProject = resolveMainViewAfterWorkspaceSelection(CHAT_MAIN_VIEW, state, project!.id);
    expect(fromProject).toEqual({ type: "workspace-item", itemId: project!.id });
  });

  it("falls back to chat when current page item is deleted", () => {
    const state = createDummyWorkspaceState();
    const doc = Object.values(state.items).find((item) => item.type === "doc");
    expect(doc).toBeTruthy();

    const nextState = deleteWorkspaceItem(state, doc!.id);
    const normalized = normalizeMainView({ type: "workspace-item", itemId: doc!.id }, nextState);
    expect(normalized).toEqual(CHAT_MAIN_VIEW);
  });

  it("falls back to chat for invalid persisted main views", () => {
    const state = createDummyWorkspaceState();
    expect(normalizeMainView({ type: "workspace-item", itemId: "missing" }, state)).toEqual(CHAT_MAIN_VIEW);
    expect(normalizeMainView({ type: "workspace-item" }, state)).toEqual(CHAT_MAIN_VIEW);
    expect(normalizeMainView({ type: "chat" }, state)).toEqual(CHAT_MAIN_VIEW);
    expect(normalizeMainView("workspace-item", state)).toEqual(CHAT_MAIN_VIEW);
  });
});
