import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent as ReactDragEvent,
} from "react";
import {
  ChevronRight,
  FileText,
  Folder,
  FolderOpen,
  FolderPlus,
  ListChecks,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  canMoveWorkspaceItem,
  getWorkspaceChildIds,
  type WorkspaceItem,
  type WorkspaceItemType,
  type WorkspaceState,
} from "@/lib/workspace";

type DropIntent = "before" | "inside" | "after";

interface WorkspaceDropTarget {
  itemId: string;
  intent: DropIntent;
}

interface WorkspaceTreeProps {
  state: WorkspaceState;
  onSelect: (id: string) => void;
  onToggleFolder: (id: string) => void;
  onAddItem: (type: WorkspaceItemType, parentId?: string | null) => void;
  onRename: (id: string, nextName: string) => void;
  onDelete: (id: string) => void;
  onMove: (id: string, targetParentId: string | null, targetIndex: number) => void;
}

interface WorkspaceTreeRowProps {
  items: Record<string, WorkspaceItem>;
  selectedId: string | null;
  editingId: string | null;
  item: WorkspaceItem;
  depth: number;
  onSelect: (id: string) => void;
  onToggleFolder: (id: string) => void;
  onAddItem: (type: WorkspaceItemType, parentId?: string | null) => void;
  onRename: (id: string, nextName: string) => void;
  onDelete: (id: string) => void;
  draggingId: string | null;
  dropTarget: WorkspaceDropTarget | null;
  onDragStart: (event: ReactDragEvent<HTMLDivElement>, id: string) => void;
  onDragEnd: () => void;
  onDragOver: (event: ReactDragEvent<HTMLDivElement>, id: string) => void;
  onDrop: (event: ReactDragEvent<HTMLDivElement>) => void;
}

function deriveDropIntent(
  event: ReactDragEvent<HTMLDivElement>,
  isFolder: boolean
): DropIntent {
  const rect = event.currentTarget.getBoundingClientRect();
  const offsetY = event.clientY - rect.top;
  const edgeThreshold = Math.min(8, rect.height * 0.25);

  if (offsetY <= edgeThreshold) {
    return "before";
  }

  if (offsetY >= rect.height - edgeThreshold) {
    return "after";
  }

  if (isFolder) {
    return "inside";
  }

  return offsetY < rect.height / 2 ? "before" : "after";
}

function resolveDropDestination(
  state: WorkspaceState,
  draggingId: string,
  overId: string,
  intent: DropIntent
): { targetParentId: string | null; targetIndex: number } | null {
  const overItem = state.items[overId];
  if (!overItem) return null;

  if (intent === "inside") {
    if (overItem.type !== "folder" || overItem.id === draggingId) return null;
    const targetChildren = getWorkspaceChildIds(state, overItem.id).filter((id) => id !== draggingId);
    return {
      targetParentId: overItem.id,
      targetIndex: targetChildren.length,
    };
  }

  const targetParentId = overItem.parentId;
  const siblingIds = getWorkspaceChildIds(state, targetParentId).filter((id) => id !== draggingId);
  const overIndex = siblingIds.indexOf(overItem.id);
  if (overIndex < 0) return null;

  return {
    targetParentId,
    targetIndex: intent === "before" ? overIndex : overIndex + 1,
  };
}

function areRowPropsEqual(prev: WorkspaceTreeRowProps, next: WorkspaceTreeRowProps): boolean {
  if ((prev.selectedId === prev.item.id) !== (next.selectedId === next.item.id)) return false;
  if ((prev.editingId === prev.item.id) !== (next.editingId === next.item.id)) return false;
  return (
    prev.items === next.items &&
    prev.item === next.item &&
    prev.depth === next.depth &&
    prev.draggingId === next.draggingId &&
    prev.dropTarget === next.dropTarget &&
    prev.onSelect === next.onSelect &&
    prev.onToggleFolder === next.onToggleFolder &&
    prev.onAddItem === next.onAddItem &&
    prev.onRename === next.onRename &&
    prev.onDelete === next.onDelete &&
    prev.onDragStart === next.onDragStart &&
    prev.onDragEnd === next.onDragEnd &&
    prev.onDragOver === next.onDragOver &&
    prev.onDrop === next.onDrop
  );
}

const WorkspaceTreeRow = memo(function WorkspaceTreeRow({
  items,
  selectedId,
  editingId,
  item,
  depth,
  onSelect,
  onToggleFolder,
  onAddItem,
  onRename,
  onDelete,
  draggingId,
  dropTarget,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
}: WorkspaceTreeRowProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [draftName, setDraftName] = useState(item.name);
  const isFolder = item.type === "folder";
  const isCollapsed = item.collapsed ?? false;
  const isSelected = selectedId === item.id;
  const isEditing = editingId === item.id;
  const isDragging = draggingId === item.id;
  const childIds = useMemo(
    () => getWorkspaceChildIds({ items, rootIds: [], docContentById: {}, selectedId: null, editingId: null }, item.id),
    [items, item.id]
  );
  const isDropTarget = dropTarget?.itemId === item.id;
  const showDropBefore = isDropTarget && dropTarget?.intent === "before";
  const showDropAfter = isDropTarget && dropTarget?.intent === "after";
  const showDropInside = isDropTarget && dropTarget?.intent === "inside";
  const indicatorInset = 8 + depth * 14;

  useEffect(() => {
    if (!isEditing) return;
    setDraftName(item.name);
    window.requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
  }, [isEditing, item.name]);

  return (
    <>
      <div className="relative">
        {showDropBefore && (
          <div
            className="pointer-events-none absolute h-[2px] rounded-full bg-[#5E6AD2] z-20"
            style={{ left: indicatorInset, right: 8, top: -1 }}
          />
        )}
        {showDropAfter && (
          <div
            className="pointer-events-none absolute h-[2px] rounded-full bg-[#5E6AD2] z-20"
            style={{ left: indicatorInset, right: 8, bottom: -1 }}
          />
        )}
        <div
          draggable={!isEditing}
          className={cn(
            "group magi-no-drag h-[28px] rounded-[10px] flex items-center gap-1.5 px-2",
            "text-[#C5CACF] hover:bg-white/[0.04] hover:text-white",
            isSelected && "bg-white/[0.06] text-white",
            isDragging && "opacity-45",
            showDropInside && "bg-white/[0.08] ring-1 ring-[#5E6AD2]/70"
          )}
          style={{ paddingLeft: indicatorInset }}
          onClick={() => onSelect(item.id)}
          onDragStart={(event) => onDragStart(event, item.id)}
          onDragEnd={onDragEnd}
          onDragOver={(event) => onDragOver(event, item.id)}
          onDrop={onDrop}
        >
          {isFolder ? (
            <button
              className="magi-no-drag w-4 h-4 rounded grid place-items-center text-white"
              onClick={(event) => {
                event.stopPropagation();
                onToggleFolder(item.id);
              }}
              title={isCollapsed ? "Expand folder" : "Collapse folder"}
            >
              <ChevronRight
                size={13}
                className={cn("transition-transform duration-100", !isCollapsed && "rotate-90")}
              />
            </button>
          ) : (
            <span className="w-4 h-4 shrink-0" />
          )}

          {item.type === "folder" ? (
            isCollapsed ? (
              <Folder size={13} className="shrink-0 text-white" />
            ) : (
              <FolderOpen size={13} className="shrink-0 text-white" />
            )
          ) : item.type === "project" ? (
            <ListChecks size={13} className="shrink-0 text-white" />
          ) : (
            <FileText size={13} className="shrink-0 text-white" />
          )}

          {isEditing ? (
            <input
              ref={inputRef}
              value={draftName}
              onChange={(event) => setDraftName(event.target.value)}
              onBlur={() => onRename(item.id, draftName)}
              onClick={(event) => event.stopPropagation()}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  onRename(item.id, draftName);
                  return;
                }
                if (event.key === "Escape") {
                  event.preventDefault();
                  onRename(item.id, item.name);
                }
              }}
              className="magi-no-drag flex-1 min-w-0 h-5 rounded bg-white/[0.08] px-1.5 text-[14px] text-white outline-none border border-white/[0.18]"
            />
          ) : (
            <span className="flex-1 min-w-0 truncate text-[14px]">{item.name}</span>
          )}

          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            {isFolder && (
              <>
                <button
                  className="magi-no-drag w-5 h-5 rounded grid place-items-center text-white hover:bg-white/[0.08]"
                  title="Add folder"
                  onClick={(event) => {
                    event.stopPropagation();
                    onAddItem("folder", item.id);
                  }}
                >
                  <FolderPlus size={12} />
                </button>
                <button
                  className="magi-no-drag w-5 h-5 rounded grid place-items-center text-white hover:bg-white/[0.08]"
                  title="Add doc"
                  onClick={(event) => {
                    event.stopPropagation();
                    onAddItem("doc", item.id);
                  }}
                >
                  <FileText size={12} />
                </button>
                <button
                  className="magi-no-drag w-5 h-5 rounded grid place-items-center text-white hover:bg-white/[0.08]"
                  title="Add project"
                  onClick={(event) => {
                    event.stopPropagation();
                    onAddItem("project", item.id);
                  }}
                >
                  <ListChecks size={12} />
                </button>
              </>
            )}
            <button
              className="magi-no-drag w-5 h-5 rounded grid place-items-center text-white hover:text-red-300 hover:bg-red-500/20"
              title="Delete item"
              onClick={(event) => {
                event.stopPropagation();
                onDelete(item.id);
              }}
            >
              <Trash2 size={12} />
            </button>
          </div>
        </div>
      </div>

      {isFolder && !isCollapsed && childIds.length > 0 && (
        <div className="space-y-1">
          {childIds.map((childId) => {
            const child = items[childId];
            if (!child) return null;
            return (
              <WorkspaceTreeRow
                key={child.id}
                items={items}
                selectedId={selectedId}
                editingId={editingId}
                item={child}
                depth={depth + 1}
                onSelect={onSelect}
                onToggleFolder={onToggleFolder}
                onAddItem={onAddItem}
                onRename={onRename}
                onDelete={onDelete}
                draggingId={draggingId}
                dropTarget={dropTarget}
                onDragStart={onDragStart}
                onDragEnd={onDragEnd}
                onDragOver={onDragOver}
                onDrop={onDrop}
              />
            );
          })}
        </div>
      )}
    </>
  );
}, areRowPropsEqual);

function WorkspaceTreeImpl({
  state,
  onSelect,
  onToggleFolder,
  onAddItem,
  onRename,
  onDelete,
  onMove,
}: WorkspaceTreeProps) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<WorkspaceDropTarget | null>(null);
  const expandTimerRef = useRef<number | null>(null);
  const expandTargetRef = useRef<string | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  const clearPendingExpand = useCallback(() => {
    if (expandTimerRef.current !== null) {
      window.clearTimeout(expandTimerRef.current);
      expandTimerRef.current = null;
    }
    expandTargetRef.current = null;
  }, []);

  const scheduleFolderExpand = useCallback(
    (folderId: string) => {
      const folder = stateRef.current.items[folderId];
      if (!folder || folder.type !== "folder" || !(folder.collapsed ?? false)) {
        clearPendingExpand();
        return;
      }

      if (expandTargetRef.current === folderId && expandTimerRef.current !== null) {
        return;
      }

      clearPendingExpand();
      expandTargetRef.current = folderId;
      expandTimerRef.current = window.setTimeout(() => {
        const nextFolderId = expandTargetRef.current;
        clearPendingExpand();
        if (nextFolderId) {
          onToggleFolder(nextFolderId);
        }
      }, 450);
    },
    [clearPendingExpand, onToggleFolder]
  );

  useEffect(() => {
    return () => {
      clearPendingExpand();
    };
  }, [clearPendingExpand]);

  const handleDragStart = useCallback(
    (event: ReactDragEvent<HTMLDivElement>, id: string) => {
      if (stateRef.current.editingId === id) {
        event.preventDefault();
        return;
      }

      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", id);
      setDraggingId(id);
      setDropTarget(null);
    },
    []
  );

  const handleDragEnd = useCallback(() => {
    clearPendingExpand();
    setDropTarget(null);
    setDraggingId(null);
  }, [clearPendingExpand]);

  const handleDragOver = useCallback(
    (event: ReactDragEvent<HTMLDivElement>, overId: string) => {
      if (!draggingId) return;

      const currentState = stateRef.current;
      const overItem = currentState.items[overId];
      if (!overItem) return;

      event.preventDefault();
      event.dataTransfer.dropEffect = "move";

      const intent = deriveDropIntent(event, overItem.type === "folder");
      const destination = resolveDropDestination(currentState, draggingId, overId, intent);
      if (!destination) {
        clearPendingExpand();
        setDropTarget(null);
        return;
      }

      if (
        !canMoveWorkspaceItem(currentState, {
          itemId: draggingId,
          targetParentId: destination.targetParentId,
          targetIndex: destination.targetIndex,
        })
      ) {
        clearPendingExpand();
        setDropTarget(null);
        return;
      }

      setDropTarget((current) => {
        if (current?.itemId === overId && current.intent === intent) {
          return current;
        }
        return { itemId: overId, intent };
      });

      if (intent === "inside" && overItem.type === "folder") {
        scheduleFolderExpand(overItem.id);
      } else {
        clearPendingExpand();
      }
    },
    [clearPendingExpand, draggingId, scheduleFolderExpand]
  );

  const handleDrop = useCallback(
    (event: ReactDragEvent<HTMLDivElement>) => {
      if (!draggingId || !dropTarget) {
        handleDragEnd();
        return;
      }
      event.preventDefault();

      const currentState = stateRef.current;
      const { itemId, intent } = dropTarget;
      const destination = resolveDropDestination(currentState, draggingId, itemId, intent);
      if (
        destination &&
        canMoveWorkspaceItem(currentState, {
          itemId: draggingId,
          targetParentId: destination.targetParentId,
          targetIndex: destination.targetIndex,
        })
      ) {
        onMove(draggingId, destination.targetParentId, destination.targetIndex);
      }

      handleDragEnd();
    },
    [draggingId, dropTarget, handleDragEnd, onMove]
  );

  return (
    <div
      className="space-y-1"
      onDragOver={(e) => {
        if (draggingId && e.target === e.currentTarget) {
          e.preventDefault();
          setDropTarget(null);
          clearPendingExpand();
        }
      }}
      onDragLeave={(e) => {
        if (draggingId && e.target === e.currentTarget) {
          setDropTarget(null);
          clearPendingExpand();
        }
      }}
    >
      {state.rootIds
        .map((id) => state.items[id])
        .filter((item): item is WorkspaceItem => !!item)
        .map((item) => (
          <WorkspaceTreeRow
            key={item.id}
            items={state.items}
            selectedId={state.selectedId}
            editingId={state.editingId}
            item={item}
            depth={0}
            onSelect={onSelect}
            onToggleFolder={onToggleFolder}
            onAddItem={onAddItem}
            onRename={onRename}
            onDelete={onDelete}
            draggingId={draggingId}
            dropTarget={dropTarget}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
          />
        ))}
    </div>
  );
}

export const WorkspaceTree = memo(WorkspaceTreeImpl);
