export type WorkspaceItemType = "folder" | "doc" | "project";
export type WorkspaceProjectKind = "dummy";

export interface WorkspaceItemSnapshot {
  id: string;
  type: WorkspaceItemType;
  name: string;
  parentId: string | null;
  sortOrder: number;
  collapsed?: boolean;
  projectKind?: WorkspaceProjectKind;
}

export type WorkspaceMainView =
  | { type: "chat" }
  | {
      type: "workspace-item";
      itemId: string;
    };

export interface WorkspaceSnapshot {
  items: Record<string, WorkspaceItemSnapshot>;
  docContentById: Record<string, string>;
  rootIds: string[];
  selectedId: string | null;
  editingId: string | null;
  mainView: WorkspaceMainView;
}

export type WorkspaceLoadResult =
  | { ok: true; snapshot: WorkspaceSnapshot | null }
  | { ok: false; error: string };

export type WorkspaceSaveResult =
  | { ok: true }
  | { ok: false; error: string };

export interface WorkspaceSaveDocInput {
  docId: string;
  markdown: string;
}

export interface WorkspaceSaveUiInput {
  selectedId: string | null;
  mainView: WorkspaceMainView;
}

export interface WorkspaceSortOrderPair {
  id: string;
  sortOrder: number;
}

export interface WorkspaceToggleCollapsedInput {
  id: string;
  collapsed: boolean;
}

export interface WorkspaceRenameItemInput {
  id: string;
  name: string;
}

export interface WorkspaceAddItemInput {
  id: string;
  type: WorkspaceItemType;
  name: string;
  parentId: string | null;
  sortOrder: number;
  collapsed?: boolean;
  projectKind?: WorkspaceProjectKind;
  docContent?: string;
  uncollapseParentId?: string | null;
}

export interface WorkspaceDeleteItemInput {
  id: string;
  siblingReorders: WorkspaceSortOrderPair[];
}

export interface WorkspaceMoveItemInput {
  id: string;
  newParentId: string | null;
  siblingReorders: WorkspaceSortOrderPair[];
}
