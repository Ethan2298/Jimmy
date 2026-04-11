import type { WorkspaceSnapshot, WorkspaceSortOrderPair } from "../../shared/workspace";
import {
  createDummyWorkspaceState,
  normalizeWorkspaceState,
  type WorkspaceState,
} from "./workspace";
import { CHAT_MAIN_VIEW, normalizeMainView, type MainView } from "./workspace-navigation";

export function diffSortOrders(
  prev: WorkspaceState,
  next: WorkspaceState
): WorkspaceSortOrderPair[] {
  const changed: WorkspaceSortOrderPair[] = [];
  for (const [id, nextItem] of Object.entries(next.items)) {
    const prevItem = prev.items[id];
    if (!prevItem) continue;
    if (prevItem.sortOrder !== nextItem.sortOrder) {
      changed.push({ id, sortOrder: nextItem.sortOrder });
    }
  }
  return changed;
}

export const LEGACY_WORKSPACE_STATE_STORAGE_KEY = "outcome-ai:workspace-state-v1";
export const LEGACY_MAIN_VIEW_STORAGE_KEY = "outcome-ai:main-view-v1";

export interface WorkspaceBootstrapInput {
  dbSnapshot: WorkspaceSnapshot | null;
  legacyWorkspaceRaw: string | null;
  legacyMainViewRaw: string | null;
}

export interface WorkspaceBootstrapResult {
  workspaceState: WorkspaceState;
  mainView: MainView;
  shouldSeedDb: boolean;
  shouldClearLegacy: boolean;
  snapshotForDb: WorkspaceSnapshot;
}

function tryParseJson(raw: string | null): unknown {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function buildWorkspaceSnapshot(
  workspaceState: WorkspaceState,
  mainView: MainView
): WorkspaceSnapshot {
  return {
    items: workspaceState.items,
    docContentById: workspaceState.docContentById,
    rootIds: workspaceState.rootIds,
    selectedId: workspaceState.selectedId,
    editingId: null,
    mainView,
  };
}

export function resolveWorkspaceBootstrap(input: WorkspaceBootstrapInput): WorkspaceBootstrapResult {
  if (input.dbSnapshot) {
    const workspaceState = normalizeWorkspaceState(input.dbSnapshot);
    const mainView = normalizeMainView(input.dbSnapshot.mainView, workspaceState);
    return {
      workspaceState,
      mainView,
      shouldSeedDb: false,
      shouldClearLegacy: false,
      snapshotForDb: buildWorkspaceSnapshot(workspaceState, mainView),
    };
  }

  const parsedWorkspace = tryParseJson(input.legacyWorkspaceRaw);
  const legacyStateWasValid =
    !!parsedWorkspace &&
    typeof parsedWorkspace === "object" &&
    parsedWorkspace !== null &&
    "items" in parsedWorkspace &&
    typeof (parsedWorkspace as Record<string, unknown>).items === "object";
  const workspaceState = legacyStateWasValid
    ? normalizeWorkspaceState(parsedWorkspace)
    : createDummyWorkspaceState();

  const parsedMainView = tryParseJson(input.legacyMainViewRaw);
  const mainView = normalizeMainView(parsedMainView ?? CHAT_MAIN_VIEW, workspaceState);

  return {
    workspaceState,
    mainView,
    shouldSeedDb: true,
    shouldClearLegacy: legacyStateWasValid,
    snapshotForDb: buildWorkspaceSnapshot(workspaceState, mainView),
  };
}
