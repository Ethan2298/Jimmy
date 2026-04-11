import type { ChatThread } from "./chat-threads";
import type { MainView } from "./workspace-navigation";
import type { WorkspaceItem } from "./workspace";

export type UniversalHeaderContentType = "thread" | "project" | "doc" | "library";

export interface UniversalHeaderState {
  contentType: UniversalHeaderContentType;
  title: string;
}

interface ResolveUniversalHeaderInput {
  mainView: MainView;
  activeThread?: Pick<ChatThread, "title"> | null;
  activeWorkspaceItem?: Pick<WorkspaceItem, "type" | "name"> | null;
}

export function resolveUniversalHeader({
  mainView,
  activeThread,
  activeWorkspaceItem,
}: ResolveUniversalHeaderInput): UniversalHeaderState {
  if (mainView.type === "library") {
    return { contentType: "library", title: "Library" };
  }

  if (mainView.type === "workspace-item" && activeWorkspaceItem) {
    if (activeWorkspaceItem.type === "project") {
      return {
        contentType: "project",
        title: activeWorkspaceItem.name,
      };
    }

    if (activeWorkspaceItem.type === "doc") {
      return {
        contentType: "doc",
        title: activeWorkspaceItem.name,
      };
    }
  }

  return {
    contentType: "thread",
    title: activeThread?.title ?? "New thread",
  };
}
