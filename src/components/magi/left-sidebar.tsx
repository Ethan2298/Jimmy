"use client";

import { memo, useRef } from "react";
import { Search, Settings, SquarePen, Sparkles, X } from "lucide-react";
import { useScrollOverlay } from "@/lib/magi/scroll-overlay";
import { cn } from "@/lib/utils";
import { formatThreadAge, type ChatThread } from "@/lib/magi/chat-threads";
import { getMessagePreview } from "@/lib/magi/ai";

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

  return (
    <aside className="relative h-full flex-shrink-0">
      <div className="relative z-10 flex h-full flex-col overflow-hidden rounded-[24px] border border-white/[0.08] bg-[#0d1014]/92 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-[radial-gradient(circle_at_top,rgba(161,202,255,0.12),transparent_72%)]" />

        <div className="relative px-4 pb-3 pt-4">
          <div className="flex items-center gap-3 px-1">
            <div className="grid h-10 w-10 place-items-center rounded-[14px] border border-white/[0.08] bg-white/[0.06] text-sm font-semibold text-white">
              J
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="truncate text-[14px] font-medium text-white">Jimmy Console</p>
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/15 bg-emerald-400/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.16em] text-emerald-200/80">
                  <Sparkles size={10} />
                  Local
                </span>
              </div>
              <p className="truncate text-[12px] text-white/42">Codex-style engineering workspace</p>
            </div>
          </div>
        </div>

        <div className="relative px-3 pb-3 space-y-2">
          <button
            onClick={onNewThread}
            className="flex h-10 w-full items-center gap-2 rounded-[14px] border border-white/[0.08] bg-white/[0.05] px-3 text-[14px] text-[#D6DBE1] transition-colors hover:border-white/[0.12] hover:bg-white/[0.08] hover:text-white"
          >
            <SquarePen size={14} className="shrink-0 text-white" />
            <span>New thread</span>
          </button>
          <div className="relative">
            <Search size={13} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search threads"
              className="h-10 w-full rounded-[14px] border border-white/[0.06] bg-black/20 pl-9 pr-8 text-[13px] text-white/80 outline-none placeholder:text-white/25 focus:border-white/[0.12]"
            />
            {searchQuery && (
              <button
                onClick={() => onSearchChange("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-white/30 hover:text-white/60"
              >
                <X size={12} />
              </button>
            )}
          </div>
        </div>

        <div className="relative flex-1 min-h-0">
          <div className="px-4 pb-2">
            <div className="flex items-center justify-between px-1">
              <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-white/32">Threads</p>
              <span className="text-[11px] text-white/28">{threads.length}</span>
            </div>
          </div>
          <div ref={scrollRef} className="sidebar-scroll h-full overflow-y-auto px-3">
            <div className="space-y-1 pb-4">
              {threads.length === 0 && (
                <div className="px-2.5 py-6 text-[13px] text-white/40">
                  {searchQuery ? "No matches" : "Start a thread"}
                </div>
              )}
              {threads.map((thread) => {
                const latestMessage = thread.messages.at(-1);
                const preview = latestMessage
                  ? getMessagePreview(latestMessage) || "No text in latest response"
                  : "No messages yet";

                return (
                  <div
                    key={thread.id}
                    className={cn(
                      "group/item cursor-pointer rounded-[16px] border px-3 py-2 transition-[background-color,border-color,color] duration-100 ease-out",
                      thread.id === activeThreadId
                        ? "border-white/[0.12] bg-white/[0.07] text-white"
                        : "border-transparent text-[#C5CACF] hover:border-white/[0.06] hover:bg-white/[0.04] hover:text-white"
                    )}
                    onClick={() => onSelectThread(thread.id)}
                  >
                    <div className="flex items-start gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-[13px] font-medium">{thread.title}</span>
                          <span className="shrink-0 text-[11px] text-white/30">
                            {formatThreadAge(thread.updatedAt)}
                          </span>
                        </div>
                        <p className="mt-1 text-[12px] leading-4 text-white/36">
                          <span
                            style={{
                              display: "-webkit-box",
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: "vertical",
                              overflow: "hidden",
                            }}
                          >
                            {preview}
                          </span>
                        </p>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteThread(thread.id);
                        }}
                        className="mt-0.5 shrink-0 rounded p-0.5 text-white/0 group-hover/item:text-white/30 hover:!text-white/60"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  </div>
                );
              })}
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

        <div className="flex items-center justify-between border-t border-white/[0.06] px-4 py-3">
          <button
            onClick={onOpenSettings}
            className="flex h-[32px] items-center gap-1.5 rounded-[10px] px-2 text-[13px] text-[#D4D8DC] hover:bg-white/[0.04] hover:text-white"
          >
            <Settings size={14} className="text-white" />
            <span>Settings</span>
          </button>
          <span className="text-[11px] text-white/28">Stored in browser</span>
        </div>
      </div>
    </aside>
  );
}

export const LeftSidebar = memo(LeftSidebarImpl);
