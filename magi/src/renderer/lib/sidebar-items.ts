import type { ChatThread } from "./chat-threads";
import type { WorkspaceState } from "./workspace";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SidebarItemRef =
  | { type: "thread"; id: string }
  | { type: "workspace-item"; id: string };

export type SidebarIcon = "thread" | "doc" | "folder" | "project";

export interface ResolvedSidebarItem {
  ref: SidebarItemRef;
  name: string;
  icon: SidebarIcon;
  lastInteractedAt: number; // epoch ms
  pinned: boolean;
}

export interface PinnedState {
  items: SidebarItemRef[];
}

// ---------------------------------------------------------------------------
// Ref helpers
// ---------------------------------------------------------------------------

export function sidebarItemRefEquals(
  a: SidebarItemRef,
  b: SidebarItemRef
): boolean {
  return a.type === b.type && a.id === b.id;
}

function isPinned(ref: SidebarItemRef, pinnedRefs: SidebarItemRef[]): boolean {
  return pinnedRefs.some((p) => sidebarItemRefEquals(p, ref));
}

// ---------------------------------------------------------------------------
// Resolve helpers
// ---------------------------------------------------------------------------

function resolveThread(
  thread: ChatThread,
  pinned: boolean
): ResolvedSidebarItem {
  return {
    ref: { type: "thread", id: thread.id },
    name: thread.title,
    icon: "thread",
    lastInteractedAt: new Date(thread.updatedAt).getTime(),
    pinned,
  };
}

function resolveWorkspaceItem(
  id: string,
  ws: WorkspaceState,
  pinned: boolean
): ResolvedSidebarItem | null {
  const item = ws.items[id];
  if (!item) return null;
  return {
    ref: { type: "workspace-item", id },
    name: item.name,
    icon: item.type,
    lastInteractedAt: item.lastAccessedAt
      ? new Date(item.lastAccessedAt).getTime()
      : 0,
    pinned,
  };
}

// ---------------------------------------------------------------------------
// Compute sections
// ---------------------------------------------------------------------------

export function resolvePinnedItems(
  pinnedState: PinnedState,
  threads: ChatThread[],
  ws: WorkspaceState
): ResolvedSidebarItem[] {
  const threadMap = new Map(threads.map((t) => [t.id, t]));
  const result: ResolvedSidebarItem[] = [];

  for (const ref of pinnedState.items) {
    if (ref.type === "thread") {
      const thread = threadMap.get(ref.id);
      if (thread) result.push(resolveThread(thread, true));
    } else {
      const resolved = resolveWorkspaceItem(ref.id, ws, true);
      if (resolved) result.push(resolved);
    }
  }

  return result;
}

export function computeRecentItems(
  threads: ChatThread[],
  ws: WorkspaceState,
  pinnedRefs: SidebarItemRef[],
  limit = 15
): ResolvedSidebarItem[] {
  const items: ResolvedSidebarItem[] = [];

  for (const thread of threads) {
    const ref: SidebarItemRef = { type: "thread", id: thread.id };
    if (isPinned(ref, pinnedRefs)) continue;
    items.push(resolveThread(thread, false));
  }

  for (const item of Object.values(ws.items)) {
    if (item.type === "folder") continue; // folders don't appear in recent
    const ref: SidebarItemRef = { type: "workspace-item", id: item.id };
    if (isPinned(ref, pinnedRefs)) continue;
    const resolved = resolveWorkspaceItem(item.id, ws, false);
    if (resolved) items.push(resolved);
  }

  items.sort((a, b) => b.lastInteractedAt - a.lastInteractedAt);
  return items.slice(0, limit);
}

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

const PINNED_STORAGE_KEY = "outcome-ai:pinned-v1";

export function loadPinnedState(): PinnedState {
  try {
    const raw = localStorage.getItem(PINNED_STORAGE_KEY);
    if (!raw) return { items: [] };
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.items)) return { items: [] };
    const items = parsed.items.filter(
      (ref: unknown) =>
        ref &&
        typeof ref === "object" &&
        ("type" in (ref as Record<string, unknown>)) &&
        ("id" in (ref as Record<string, unknown>)) &&
        ((ref as Record<string, unknown>).type === "thread" ||
          (ref as Record<string, unknown>).type === "workspace-item") &&
        typeof (ref as Record<string, unknown>).id === "string"
    );
    return { items };
  } catch {
    return { items: [] };
  }
}

export function savePinnedState(state: PinnedState): void {
  localStorage.setItem(PINNED_STORAGE_KEY, JSON.stringify(state));
}
