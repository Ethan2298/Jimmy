import type { WorkspaceItem, WorkspaceState } from "./workspace";

export type MainView =
  | { type: "chat" }
  | { type: "workspace-item"; itemId: string }
  | { type: "library" };

export const CHAT_MAIN_VIEW: MainView = { type: "chat" };
export const LIBRARY_MAIN_VIEW: MainView = { type: "library" };

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

export function isWorkspaceRenderableItem(
  item: WorkspaceItem | null | undefined
): item is WorkspaceItem & { type: "doc" | "project" } {
  return item?.type === "doc" || item?.type === "project";
}

export function normalizeMainView(view: unknown, workspaceState: WorkspaceState): MainView {
  const rec = asRecord(view);
  if (!rec) return CHAT_MAIN_VIEW;

  if (rec.type === "library") return LIBRARY_MAIN_VIEW;

  if (rec.type !== "workspace-item" || typeof rec.itemId !== "string") {
    return CHAT_MAIN_VIEW;
  }

  const selected = workspaceState.items[rec.itemId];
  if (!isWorkspaceRenderableItem(selected)) {
    return CHAT_MAIN_VIEW;
  }

  return { type: "workspace-item", itemId: selected.id };
}

export function resolveMainViewAfterWorkspaceSelection(
  currentView: MainView,
  workspaceState: WorkspaceState,
  selectedId: string
): MainView {
  const selected = workspaceState.items[selectedId];
  if (!isWorkspaceRenderableItem(selected)) {
    return normalizeMainView(currentView, workspaceState);
  }
  if (currentView.type === "workspace-item" && currentView.itemId === selected.id) {
    return currentView;
  }
  return { type: "workspace-item", itemId: selected.id };
}
