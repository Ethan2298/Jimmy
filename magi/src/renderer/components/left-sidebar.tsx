import { memo, useRef } from "react";
import {
  Library,
  MoreHorizontal,
  Pin,
  Search,
  Settings,
  SquarePen,
  X,
} from "lucide-react";
import { SidebarItemRow } from "./sidebar-item-row";
import type { ResolvedSidebarItem, SidebarItemRef } from "@/lib/sidebar-items";
import { sidebarItemRefEquals } from "@/lib/sidebar-items";
import { useScrollOverlay } from "@/lib/scroll-overlay";

interface LeftSidebarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onNewThread: () => void;
  onOpenSettings: () => void;
  pinnedItems: ResolvedSidebarItem[];
  recentItems: ResolvedSidebarItem[];
  activeItemRef: SidebarItemRef | null;
  onItemClick: (ref: SidebarItemRef) => void;
  onPinItem: (ref: SidebarItemRef) => void;
  onUnpinItem: (ref: SidebarItemRef) => void;
  onDeleteThread: (id: string) => void;
  onRenameThread: (id: string, title: string) => void;
  onOpenLibrary: () => void;
}

function isActive(ref: SidebarItemRef, activeRef: SidebarItemRef | null): boolean {
  return activeRef !== null && sidebarItemRefEquals(ref, activeRef);
}

function filterByQuery(items: ResolvedSidebarItem[], query: string): ResolvedSidebarItem[] {
  if (!query) return items;
  const lower = query.toLowerCase();
  return items.filter((item) => item.name.toLowerCase().includes(lower));
}

function LeftSidebarImpl({
  searchQuery,
  onSearchChange,
  onNewThread,
  onOpenSettings,
  pinnedItems,
  recentItems,
  activeItemRef,
  onItemClick,
  onPinItem,
  onUnpinItem,
  onDeleteThread,
  onRenameThread,
  onOpenLibrary,
}: LeftSidebarProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const sidebarScrollOverlay = useScrollOverlay(scrollRef);

  const filteredPinned = filterByQuery(pinnedItems, searchQuery);
  const filteredRecent = filterByQuery(recentItems, searchQuery);
  const hasResults = filteredPinned.length > 0 || filteredRecent.length > 0;

  return (
    <aside className="h-full relative flex-shrink-0 bg-transparent">
      <div className="relative z-10 h-full flex flex-col">
        <div className="pt-[10px]" />

        <div className="px-3 space-y-1">
          <button
            onClick={onNewThread}
            className="magi-no-drag w-full h-[28px] rounded-[10px] text-[14px] text-[#C5CACF] hover:text-white hover:bg-white/[0.04] flex items-center gap-2 pl-2.5 pr-2.5"
          >
            <SquarePen size={14} className="shrink-0 text-white" />
            <span>New thread</span>
          </button>
          <div className="relative">
            <Search size={13} className="absolute left-2 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search..."
              className="magi-no-drag w-full h-[28px] rounded-[10px] bg-white/[0.04] border border-white/[0.06] pl-7 pr-7 text-[13px] text-white/80 placeholder:text-white/25 outline-none focus:border-white/[0.12]"
            />
            {searchQuery && (
              <button
                onClick={() => onSearchChange("")}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 rounded text-white/30 hover:text-white/60"
              >
                <X size={12} />
              </button>
            )}
          </div>
        </div>

        <div className="relative flex-1 min-h-0">
          <div ref={scrollRef} className="sidebar-scroll h-full overflow-y-auto px-3">
            <div className="py-4 space-y-4">
              {searchQuery && !hasResults && (
                <div className="px-2.5 py-6 text-[13px] text-white/40">No matches</div>
              )}

              {filteredPinned.length > 0 && (
                <section>
                  <div className="h-[28px] px-2 flex items-center gap-1.5 text-[13px] tracking-[0.02em] text-[#7D848B]">
                    <Pin size={12} />
                    <span>Pinned</span>
                  </div>
                  <div className="space-y-1">
                    {filteredPinned.map((item) => (
                      <SidebarItemRow
                        key={`${item.ref.type}-${item.ref.id}`}
                        item={item}
                        active={isActive(item.ref, activeItemRef)}
                        activeItemRef={activeItemRef}
                        onItemClick={onItemClick}
                        onPinItem={onPinItem}
                        onUnpinItem={onUnpinItem}
                        onDeleteThread={onDeleteThread}
                        onRenameThread={onRenameThread}
                      />
                    ))}
                  </div>
                </section>
              )}

              {filteredRecent.length > 0 && (
                <section>
                  <div className="h-[28px] px-2 flex items-center gap-1.5 text-[13px] tracking-[0.02em] text-[#7D848B]">
                    <span>Recent</span>
                  </div>
                  <div className="space-y-1">
                    {filteredRecent.map((item) => (
                      <SidebarItemRow
                        key={`${item.ref.type}-${item.ref.id}`}
                        item={item}
                        active={isActive(item.ref, activeItemRef)}
                        activeItemRef={activeItemRef}
                        onItemClick={onItemClick}
                        onPinItem={onPinItem}
                        onUnpinItem={onUnpinItem}
                        onDeleteThread={onDeleteThread}
                        onRenameThread={onRenameThread}
                      />
                    ))}
                  </div>
                </section>
              )}

              {!searchQuery && filteredPinned.length === 0 && filteredRecent.length === 0 && (
                <div className="px-2.5 py-6 text-[13px] text-white/40">
                  Start a thread or open a doc
                </div>
              )}

              {!searchQuery && (
                <button
                  onClick={onOpenLibrary}
                  className="magi-no-drag w-full h-[28px] rounded-[10px] text-[14px] text-[#C5CACF] hover:text-white hover:bg-white/[0.04] flex items-center gap-1.5 px-2 transition-[background-color,color] duration-75 ease-out"
                >
                  <Library size={13} className="shrink-0 text-white" />
                  <span>Library</span>
                </button>
              )}
            </div>
          </div>
          {sidebarScrollOverlay.hasOverflow && (
            <div className="pointer-events-none absolute top-0 right-[4px] h-full w-[7px]">
              <div
                className={`scroll-fade-thumb ${sidebarScrollOverlay.visible ? "is-visible" : ""}`}
                style={{
                  height: `${sidebarScrollOverlay.thumbHeight}px`,
                  transform: `translateY(${sidebarScrollOverlay.thumbTop}px)`,
                }}
              />
            </div>
          )}
        </div>

        <div className="h-[40px] px-2.5 pt-2.5 pb-3 flex items-center">
          <button
            onClick={onOpenSettings}
            className="magi-no-drag h-[28px] text-[14px] text-[#D4D8DC] hover:text-white flex items-center gap-1.5"
          >
            <Settings size={14} className="text-white" />
            <span>Settings</span>
            <MoreHorizontal size={12} className="text-white" />
          </button>
        </div>
      </div>
    </aside>
  );
}

export const LeftSidebar = memo(LeftSidebarImpl);
