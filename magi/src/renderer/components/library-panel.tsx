import { memo, useMemo, useState, useCallback, useRef } from "react";
import {
  FileText,
  FolderPlus,
  ListChecks,
  Search,
  X,
} from "lucide-react";
import { WorkspaceTree } from "./workspace-tree";
import { ThreadList } from "./thread-list";
import { cn } from "@/lib/utils";
import { groupThreadsByDate } from "@/lib/thread-groups";
import { useScrollOverlay } from "@/lib/scroll-overlay";
import type { ChatThread } from "@/lib/chat-threads";
import type { WorkspaceItemType, WorkspaceState } from "@/lib/workspace";

type LibraryFilter = "all" | "threads" | "docs" | "projects";

interface LibraryPanelProps {
  threads: ChatThread[];
  activeThreadId: string;
  workspaceState: WorkspaceState;
  onSelectThread: (id: string) => void;
  onDeleteThread: (id: string) => void;
  onRenameThread: (id: string, title: string) => void;
  onWorkspaceSelect: (id: string) => void;
  onWorkspaceToggleFolder: (id: string) => void;
  onWorkspaceAddItem: (type: WorkspaceItemType, parentId?: string | null) => void;
  onWorkspaceRename: (id: string, nextName: string) => void;
  onWorkspaceDelete: (id: string) => void;
  onWorkspaceMove: (id: string, targetParentId: string | null, targetIndex: number) => void;
}

const FILTER_OPTIONS: { value: LibraryFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "threads", label: "Threads" },
  { value: "docs", label: "Docs" },
  { value: "projects", label: "Projects" },
];

function LibraryPanelImpl({
  threads,
  activeThreadId,
  workspaceState,
  onSelectThread,
  onDeleteThread,
  onRenameThread,
  onWorkspaceSelect,
  onWorkspaceToggleFolder,
  onWorkspaceAddItem,
  onWorkspaceRename,
  onWorkspaceDelete,
  onWorkspaceMove,
}: LibraryPanelProps) {
  const [filter, setFilter] = useState<LibraryFilter>("all");
  const [search, setSearch] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const scrollOverlay = useScrollOverlay(scrollRef);

  const showWorkspace = filter === "all" || filter === "docs" || filter === "projects";
  const showThreads = filter === "all" || filter === "threads";

  const filteredThreads = useMemo(() => {
    if (!search) return threads;
    const lower = search.toLowerCase();
    return threads.filter((t) => t.title.toLowerCase().includes(lower));
  }, [threads, search]);

  const threadGroups = useMemo(
    () => (showThreads ? groupThreadsByDate(filteredThreads) : []),
    [showThreads, filteredThreads]
  );

  const handleAddFolder = useCallback(() => onWorkspaceAddItem("folder", null), [onWorkspaceAddItem]);
  const handleAddDoc = useCallback(() => onWorkspaceAddItem("doc", null), [onWorkspaceAddItem]);
  const handleAddProject = useCallback(() => onWorkspaceAddItem("project", null), [onWorkspaceAddItem]);

  return (
    <div className="relative h-full flex flex-col">
      {/* Header */}
      <div className="shrink-0 px-6 pt-4 pb-3 space-y-3">
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search library..."
              className="w-full h-[32px] rounded-[10px] bg-white/[0.04] border border-white/[0.06] pl-8 pr-8 text-[13px] text-white/80 placeholder:text-white/25 outline-none focus:border-white/[0.12]"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded text-white/30 hover:text-white/60"
              >
                <X size={12} />
              </button>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button
              className="w-7 h-7 rounded-md grid place-items-center text-white/50 hover:text-white hover:bg-white/[0.08]"
              title="Add folder"
              onClick={handleAddFolder}
            >
              <FolderPlus size={15} />
            </button>
            <button
              className="w-7 h-7 rounded-md grid place-items-center text-white/50 hover:text-white hover:bg-white/[0.08]"
              title="Add doc"
              onClick={handleAddDoc}
            >
              <FileText size={15} />
            </button>
            <button
              className="w-7 h-7 rounded-md grid place-items-center text-white/50 hover:text-white hover:bg-white/[0.08]"
              title="Add project"
              onClick={handleAddProject}
            >
              <ListChecks size={15} />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {FILTER_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setFilter(opt.value)}
              className={cn(
                "h-[26px] px-2.5 rounded-md text-[13px] transition-[background-color,color] duration-75",
                filter === opt.value
                  ? "bg-white/[0.08] text-white"
                  : "text-[#8F959B] hover:text-white hover:bg-white/[0.04]"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="relative flex-1 min-h-0">
        <div ref={scrollRef} className="main-chat-scroll h-full overflow-y-auto px-6 pb-8">
          {showWorkspace && (
            <section className="mb-6">
              {(filter === "all") && (
                <h3 className="text-[12px] font-medium text-[#7D848B] uppercase tracking-wider mb-2">Workspace</h3>
              )}
              <WorkspaceTree
                state={workspaceState}
                onSelect={onWorkspaceSelect}
                onToggleFolder={onWorkspaceToggleFolder}
                onAddItem={onWorkspaceAddItem}
                onRename={onWorkspaceRename}
                onDelete={onWorkspaceDelete}
                onMove={onWorkspaceMove}
              />
            </section>
          )}

          {showThreads && (
            <section>
              {filter === "all" && (
                <h3 className="text-[12px] font-medium text-[#7D848B] uppercase tracking-wider mb-2">Threads</h3>
              )}
              {threadGroups.length === 0 && (
                <div className="py-4 text-[13px] text-white/40">
                  {search ? "No matching threads" : "No threads yet"}
                </div>
              )}
              {threadGroups.map((group) => (
                <div key={group.label} className="mb-3">
                  <div className="h-[24px] px-2 flex items-center text-[12px] text-[#7D848B]">
                    {group.label}
                  </div>
                  <ThreadList
                    threads={group.threads}
                    activeThreadId={activeThreadId}
                    onSelectThread={onSelectThread}
                    onDeleteThread={onDeleteThread}
                    onRenameThread={onRenameThread}
                  />
                </div>
              ))}
            </section>
          )}
        </div>
        {scrollOverlay.hasOverflow && (
          <div className="pointer-events-none absolute top-0 right-[6px] h-full w-[7px]">
            <div
              className={`scroll-fade-thumb ${scrollOverlay.visible ? "is-visible" : ""}`}
              style={{
                height: `${scrollOverlay.thumbHeight}px`,
                transform: `translateY(${scrollOverlay.thumbTop}px)`,
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

export const LibraryPanel = memo(LibraryPanelImpl);
