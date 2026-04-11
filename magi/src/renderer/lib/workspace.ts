export type WorkspaceItemType = "folder" | "doc" | "project";
export type WorkspaceProjectKind = "dummy";

export interface WorkspaceItem {
  id: string;
  type: WorkspaceItemType;
  name: string;
  parentId: string | null;
  sortOrder: number;
  collapsed?: boolean;
  projectKind?: WorkspaceProjectKind;
  lastAccessedAt?: string;
}

export interface WorkspaceState {
  items: Record<string, WorkspaceItem>;
  docContentById: Record<string, string>;
  rootIds: string[];
  selectedId: string | null;
  editingId: string | null;
}

export interface MoveWorkspaceItemInput {
  itemId: string;
  targetParentId: string | null;
  targetIndex: number;
}

function makeId(): string {
  return crypto.randomUUID();
}

function defaultSeededDocContent(name: string): string {
  switch (name) {
    case "Launch Brief":
      return [
        "# Launch Brief",
        "",
        "## Objective",
        "- Clarify launch outcomes",
        "- Align scope across teams",
        "",
        "## Open Questions",
        "- What is in scope for v1?",
      ].join("\n");
    case "Weekly Plan":
      return [
        "# Weekly Plan",
        "",
        "## Priorities",
        "- Finalize onboarding flow",
        "- Validate workspace navigation",
        "",
        "## Risks",
        "- QA bandwidth this week",
      ].join("\n");
    case "Roadmap Notes":
      return [
        "# Roadmap Notes",
        "",
        "## Q2 Themes",
        "- Editor foundations",
        "- Reliability hardening",
      ].join("\n");
    default:
      return "";
  }
}

function defaultName(type: WorkspaceItemType): string {
  switch (type) {
    case "folder":
      return "Untitled Folder";
    case "doc":
      return "Untitled Doc";
    case "project":
      return "Untitled";
  }
}

function compareWorkspaceItems(a: WorkspaceItem, b: WorkspaceItem): number {
  if (a.sortOrder !== b.sortOrder) {
    return a.sortOrder - b.sortOrder;
  }
  return a.id.localeCompare(b.id);
}

function deriveDocContentById(
  items: Record<string, WorkspaceItem>,
  source?: Record<string, unknown>,
  fallbackToSeed = false
): Record<string, string> {
  const docContentById: Record<string, string> = {};

  for (const item of Object.values(items)) {
    if (item.type !== "doc") continue;
    const existing = source?.[item.id];
    if (typeof existing === "string") {
      docContentById[item.id] = existing;
      continue;
    }
    docContentById[item.id] = fallbackToSeed ? defaultSeededDocContent(item.name) : "";
  }

  return docContentById;
}

function normalizeParentId(state: WorkspaceState, parentId: string | null): string | null {
  if (!parentId) return null;
  const parent = state.items[parentId];
  if (!parent || parent.type !== "folder") return null;
  return parentId;
}

function clampIndex(index: number, length: number): number {
  if (!Number.isFinite(index)) return 0;
  return Math.max(0, Math.min(Math.floor(index), length));
}

function assignSiblingSortOrders(
  items: Record<string, WorkspaceItem>,
  parentId: string | null,
  siblingIds: string[]
): void {
  for (let i = 0; i < siblingIds.length; i++) {
    const id = siblingIds[i];
    const item = items[id];
    if (!item) continue;
    items[id] = {
      ...item,
      parentId,
      sortOrder: i,
    };
  }
}

function collectDescendantIds(
  items: Record<string, WorkspaceItem>,
  rootId: string
): Set<string> {
  const childrenOf = new Map<string, string[]>();
  for (const item of Object.values(items)) {
    if (item.parentId) {
      const siblings = childrenOf.get(item.parentId);
      if (siblings) {
        siblings.push(item.id);
      } else {
        childrenOf.set(item.parentId, [item.id]);
      }
    }
  }

  const ids = new Set<string>([rootId]);
  const stack = [rootId];
  while (stack.length > 0) {
    const current = stack.pop()!;
    const children = childrenOf.get(current);
    if (children) {
      for (const childId of children) {
        ids.add(childId);
        stack.push(childId);
      }
    }
  }
  return ids;
}

export function getWorkspaceChildIds(
  state: WorkspaceState,
  parentId: string | null
): string[] {
  if (parentId === null) {
    return state.rootIds.filter((id) => !!state.items[id]);
  }

  return Object.values(state.items)
    .filter((item) => item.parentId === parentId)
    .sort(compareWorkspaceItems)
    .map((item) => item.id);
}

export function createDummyWorkspaceState(): WorkspaceState {
  const personalId = makeId();
  const projectsId = makeId();
  const outcomeFolderId = makeId();
  const dummyProjectId = makeId();
  const dummyDocId = makeId();
  const weeklyPlanId = makeId();
  const personalNotesId = makeId();
  const notesId = makeId();
  const roadmapNotesId = makeId();
  const sidebarDocId = makeId();
  const mockupNotesId = makeId();

  const items: Record<string, WorkspaceItem> = {};

  const seededItems: WorkspaceItem[] = [
    { id: personalId, type: "folder", name: "Personal", parentId: null, sortOrder: 0, collapsed: false },
    { id: weeklyPlanId, type: "doc", name: "Weekly Plan", parentId: personalId, sortOrder: 0 },
    { id: personalNotesId, type: "doc", name: "Tax Receipt Notes", parentId: personalId, sortOrder: 1 },
    { id: projectsId, type: "folder", name: "Projects", parentId: null, sortOrder: 1, collapsed: false },
    { id: outcomeFolderId, type: "folder", name: "Outcome AI", parentId: projectsId, sortOrder: 0, collapsed: false },
    {
      id: dummyProjectId,
      type: "project",
      projectKind: "dummy",
      name: "Launch",
      parentId: projectsId,
      sortOrder: 1,
    },
    { id: dummyDocId, type: "doc", name: "Launch Brief", parentId: projectsId, sortOrder: 2 },
    { id: sidebarDocId, type: "doc", name: "Sidebar Notes", parentId: outcomeFolderId, sortOrder: 0 },
    { id: mockupNotesId, type: "doc", name: "Sidebar Mockup Notes", parentId: outcomeFolderId, sortOrder: 1 },
    { id: notesId, type: "doc", name: "Quick Notes", parentId: null, sortOrder: 2 },
    { id: roadmapNotesId, type: "doc", name: "Roadmap Notes", parentId: null, sortOrder: 3 },
  ];

  for (const item of seededItems) {
    items[item.id] = item;
  }

  return {
    items,
    docContentById: deriveDocContentById(items, undefined, true),
    rootIds: [personalId, projectsId, notesId, roadmapNotesId],
    selectedId: null,
    editingId: null,
  };
}

export function touchWorkspaceItem(
  state: WorkspaceState,
  id: string,
  now = new Date().toISOString()
): WorkspaceState {
  const item = state.items[id];
  if (!item) return state;
  return {
    ...state,
    items: {
      ...state.items,
      [id]: { ...item, lastAccessedAt: now },
    },
  };
}

export function selectWorkspaceItem(
  state: WorkspaceState,
  id: string | null
): WorkspaceState {
  if (id === state.selectedId) return state;
  if (id !== null && !state.items[id]) return state;
  return {
    ...state,
    selectedId: id,
  };
}

export function toggleWorkspaceFolder(
  state: WorkspaceState,
  id: string
): WorkspaceState {
  const item = state.items[id];
  if (!item || item.type !== "folder") return state;
  return {
    ...state,
    items: {
      ...state.items,
      [id]: {
        ...item,
        collapsed: !(item.collapsed ?? false),
      },
    },
  };
}

export function addWorkspaceItem(
  state: WorkspaceState,
  input: { type: WorkspaceItemType; parentId?: string | null; name?: string }
): WorkspaceState {
  const id = makeId();
  const parentId = normalizeParentId(state, input.parentId ?? null);
  const resolvedName = input.name?.trim() || defaultName(input.type);
  const sortOrder = parentId
    ? getWorkspaceChildIds(state, parentId).length
    : state.rootIds.filter((rootId) => !!state.items[rootId]).length;
  const newItem: WorkspaceItem = {
    id,
    type: input.type,
    name: resolvedName,
    parentId,
    sortOrder,
    collapsed: input.type === "folder" ? false : undefined,
    projectKind: input.type === "project" ? "dummy" : undefined,
  };

  const items = {
    ...state.items,
    [id]: newItem,
  };

  if (parentId && items[parentId]?.type === "folder" && items[parentId].collapsed) {
    items[parentId] = {
      ...items[parentId],
      collapsed: false,
    };
  }

  return {
    ...state,
    items,
    docContentById:
      input.type === "doc"
        ? {
            ...state.docContentById,
            [id]: "",
          }
        : state.docContentById,
    rootIds: parentId ? state.rootIds : [...state.rootIds, id],
    selectedId: id,
    editingId: id,
  };
}

export function renameWorkspaceItem(
  state: WorkspaceState,
  id: string,
  nextName: string
): WorkspaceState {
  const item = state.items[id];
  if (!item) return state;
  const trimmed = nextName.trim();
  const resolvedName =
    item.type === "doc"
      ? trimmed
      : trimmed || defaultName(item.type);

  return {
    ...state,
    items: {
      ...state.items,
      [id]: {
        ...item,
        name: resolvedName,
      },
    },
    editingId: state.editingId === id ? null : state.editingId,
  };
}

export function updateWorkspaceDocContent(
  state: WorkspaceState,
  docId: string,
  markdown: string
): WorkspaceState {
  const item = state.items[docId];
  if (!item || item.type !== "doc") return state;
  if (state.docContentById[docId] === markdown) return state;

  return {
    ...state,
    docContentById: {
      ...state.docContentById,
      [docId]: markdown,
    },
  };
}

export function canMoveWorkspaceItem(
  state: WorkspaceState,
  input: MoveWorkspaceItemInput
): boolean {
  const item = state.items[input.itemId];
  if (!item) return false;
  const targetParentId = normalizeParentId(state, input.targetParentId ?? null);

  if (targetParentId !== input.targetParentId) {
    return false;
  }

  if (targetParentId === item.id) {
    return false;
  }

  if (!targetParentId) {
    return true;
  }

  const descendants = collectDescendantIds(state.items, item.id);
  return !descendants.has(targetParentId);
}

export function moveWorkspaceItem(
  state: WorkspaceState,
  input: MoveWorkspaceItemInput
): WorkspaceState {
  const item = state.items[input.itemId];
  if (!item) return state;

  const targetParentId = input.targetParentId ?? null;
  if (!canMoveWorkspaceItem(state, { ...input, targetParentId })) {
    return state;
  }

  const sourceParentId = item.parentId;
  const sourceSiblingIds = getWorkspaceChildIds(state, sourceParentId);
  const targetSiblingIds =
    sourceParentId === targetParentId
      ? sourceSiblingIds
      : getWorkspaceChildIds(state, targetParentId);

  const nextSourceSiblingIds = sourceSiblingIds.filter((id) => id !== item.id);
  const insertionBaseIds =
    sourceParentId === targetParentId ? nextSourceSiblingIds : targetSiblingIds;
  const insertionIndex = clampIndex(input.targetIndex, insertionBaseIds.length);
  const nextTargetSiblingIds = [...insertionBaseIds];
  nextTargetSiblingIds.splice(insertionIndex, 0, item.id);

  if (sourceParentId === targetParentId) {
    const unchanged =
      nextTargetSiblingIds.length === sourceSiblingIds.length &&
      nextTargetSiblingIds.every((id, index) => id === sourceSiblingIds[index]);
    if (unchanged) return state;
  }

  const items: Record<string, WorkspaceItem> = {
    ...state.items,
    [item.id]: {
      ...item,
      parentId: targetParentId,
    },
  };

  if (sourceParentId === targetParentId) {
    assignSiblingSortOrders(items, targetParentId, nextTargetSiblingIds);
  } else {
    assignSiblingSortOrders(items, sourceParentId, nextSourceSiblingIds);
    assignSiblingSortOrders(items, targetParentId, nextTargetSiblingIds);
  }

  const rootIds =
    sourceParentId === null || targetParentId === null
      ? sourceParentId === targetParentId
        ? nextTargetSiblingIds
        : targetParentId === null
          ? nextTargetSiblingIds
          : nextSourceSiblingIds
      : state.rootIds;

  return {
    ...state,
    items,
    rootIds,
  };
}

export function deleteWorkspaceItem(
  state: WorkspaceState,
  id: string
): WorkspaceState {
  const target = state.items[id];
  if (!target) return state;
  const toDelete = collectDescendantIds(state.items, id);
  const items: Record<string, WorkspaceItem> = {};

  for (const [itemId, item] of Object.entries(state.items)) {
    if (!toDelete.has(itemId)) {
      items[itemId] = item;
    }
  }

  const rootIds = state.rootIds.filter((rootId) => !toDelete.has(rootId));
  if (target.parentId === null) {
    assignSiblingSortOrders(items, null, rootIds);
  } else {
    assignSiblingSortOrders(items, target.parentId, getWorkspaceChildIds({ ...state, items, rootIds }, target.parentId));
  }

  return {
    ...state,
    items,
    docContentById: deriveDocContentById(items, state.docContentById),
    rootIds,
    selectedId: state.selectedId && toDelete.has(state.selectedId) ? null : state.selectedId,
    editingId: state.editingId && toDelete.has(state.editingId) ? null : state.editingId,
  };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function asWorkspaceItem(value: unknown): WorkspaceItem | null {
  const rec = asRecord(value);
  if (!rec) return null;
  if (typeof rec.id !== "string") return null;
  if (rec.type !== "folder" && rec.type !== "doc" && rec.type !== "project") return null;
  if (typeof rec.name !== "string") return null;
  if (rec.parentId !== null && typeof rec.parentId !== "string") return null;
  if (typeof rec.sortOrder !== "number" || !Number.isFinite(rec.sortOrder)) return null;

  const item: WorkspaceItem = {
    id: rec.id,
    type: rec.type,
    name: rec.name,
    parentId: rec.parentId,
    sortOrder: rec.sortOrder,
  };

  if (typeof rec.lastAccessedAt === "string" && rec.lastAccessedAt) {
    item.lastAccessedAt = rec.lastAccessedAt;
  }

  if (typeof rec.collapsed === "boolean" && rec.type === "folder") {
    item.collapsed = rec.collapsed;
  }

  if (rec.type === "project") {
    item.projectKind = "dummy";
    if (item.name === "Dummy Launch Project" || item.name === "Dummy Launch") {
      item.name = "Launch";
    } else if (item.name === "Untitled Project") {
      item.name = "Untitled";
    }
  }

  return item;
}

export function normalizeWorkspaceState(input: unknown): WorkspaceState {
  const rec = asRecord(input);
  if (!rec) return createDummyWorkspaceState();

  const rawItems = asRecord(rec.items);
  if (!rawItems) return createDummyWorkspaceState();
  const rawDocContentById = asRecord(rec.docContentById);

  const items: Record<string, WorkspaceItem> = {};
  for (const value of Object.values(rawItems)) {
    const item = asWorkspaceItem(value);
    if (!item) continue;
    items[item.id] = item;
  }

  if (Object.keys(items).length === 0) {
    return createDummyWorkspaceState();
  }

  const rawRootIds = Array.isArray(rec.rootIds) ? rec.rootIds : [];
  const rootIds = rawRootIds
    .filter((id): id is string => typeof id === "string" && !!items[id] && items[id].parentId === null);

  const fallbackRootIds = Object.values(items)
    .filter((item) => item.parentId === null)
    .sort(compareWorkspaceItems)
    .map((item) => item.id);

  const selectedId =
    typeof rec.selectedId === "string" && items[rec.selectedId] ? rec.selectedId : null;
  const editingId =
    typeof rec.editingId === "string" && items[rec.editingId] ? rec.editingId : null;

  return {
    items,
    docContentById: deriveDocContentById(items, rawDocContentById ?? undefined),
    rootIds: rootIds.length > 0 ? rootIds : fallbackRootIds,
    selectedId,
    editingId,
  };
}
