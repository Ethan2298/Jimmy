"use client";

import { memo, useRef } from "react";
import { Search, Settings, SquarePen, X } from "lucide-react";
import { useScrollOverlay } from "@/lib/magi/scroll-overlay";
import { cn } from "@/lib/utils";
import { formatThreadAge, type ChatThread } from "@/lib/magi/chat-threads";

interface LeftSidebarProps {
  threads: ChatThread[];
  activeThreadId: string;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onNewThread: () => void;
  onSelectThread: (id: string) => void;
  onDeleteThread: (id: string) => void;
  onOpenSettings: () => void;
}

function LeftSidebarImpl({
  threads,
  activeThreadId,
  searchQuery,
  onSearchChange,
  onNewThread,
  onSelectThread,
  onDeleteThread,
  onOpenSettings,
}: LeftSidebarProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const sidebarScrollOverlay = useScrollOverlay(scrollRef);

  const filtered = searchQuery
    ? threads.filter((t) => t.title.toLowerCase().includes(searchQuery.toLowerCase()))
    : threads;

  return (
    <aside className="h-full relative flex-shrink-0 bg-transparent">
      <div className="relative z-10 h-full flex flex-col">
        <div className="pt-[10px]" />

        <div className="px-3 space-y-1">
          <button
            onClick={onNewThread}
            className="w-full h-[28px] rounded-[10px] text-[14px] text-[#C5CACF] hover:text-white hover:bg-white/[0.04] flex items-center gap-2 pl-2.5 pr-2.5"
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
              className="w-full h-[28px] rounded-[10px] bg-white/[0.04] border border-white/[0.06] pl-7 pr-7 text-[13px] text-white/80 placeholder:text-white/25 outline-none focus:border-white/[0.12]"
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
            <div className="py-4 space-y-0.5">
              {filtered.length === 0 && (
                <div className="px-2.5 py-6 text-[13px] text-white/40">
                  {searchQuery ? "No matches" : "Start a thread"}
                </div>
              )}
              {filtered.map((thread) => (
                <div
                  key={thread.id}
                  className={cn(
                    "group/item flex items-center gap-1 h-[32px] rounded-[10px] px-2.5 cursor-pointer text-[13px] transition-[background-color,color] duration-75 ease-out",
                    thread.id === activeThreadId
                      ? "bg-white/[0.08] text-white"
                      : "text-[#C5CACF] hover:bg-white/[0.04] hover:text-white"
                  )}
                  onClick={() => onSelectThread(thread.id)}
                >
                  <span className="flex-1 truncate">{thread.title}</span>
                  <span className="text-[11px] text-white/30 shrink-0">
                    {formatThreadAge(thread.updatedAt)}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteThread(thread.id);
                    }}
                    className="shrink-0 p-0.5 rounded text-white/0 group-hover/item:text-white/30 hover:!text-white/60"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
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
            className="h-[28px] text-[14px] text-[#D4D8DC] hover:text-white flex items-center gap-1.5"
          >
            <Settings size={14} className="text-white" />
            <span>Settings</span>
          </button>
        </div>
      </div>
    </aside>
  );
}

export const LeftSidebar = memo(LeftSidebarImpl);
