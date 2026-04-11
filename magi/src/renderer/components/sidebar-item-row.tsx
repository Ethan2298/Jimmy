import { memo, useCallback, useEffect, useRef, useState } from "react";
import {
  Check,
  FileText,
  Folder,
  ListChecks,
  MessageCircle,
  Pencil,
  Pin,
  PinOff,
  Trash2,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ResolvedSidebarItem, SidebarItemRef, SidebarIcon } from "@/lib/sidebar-items";
import { sidebarItemRefEquals } from "@/lib/sidebar-items";

const ICON_MAP: Record<SidebarIcon, typeof MessageCircle> = {
  thread: MessageCircle,
  doc: FileText,
  folder: Folder,
  project: ListChecks,
};

interface SidebarItemRowProps {
  item: ResolvedSidebarItem;
  active: boolean;
  activeItemRef: SidebarItemRef | null;
  onItemClick: (ref: SidebarItemRef) => void;
  onPinItem: (ref: SidebarItemRef) => void;
  onUnpinItem: (ref: SidebarItemRef) => void;
  onDeleteThread?: (id: string) => void;
  onRenameThread?: (id: string, title: string) => void;
}

function formatAge(epochMs: number): string {
  if (epochMs === 0) return "";
  const diffMs = Date.now() - epochMs;
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return "now";
  if (diffMin < 60) return `${diffMin}m`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d`;
  const diffWk = Math.floor(diffDay / 7);
  if (diffWk < 5) return `${diffWk}w`;
  const diffMo = Math.floor(diffDay / 30);
  if (diffMo < 12) return `${diffMo}mo`;
  return `${Math.floor(diffDay / 365)}y`;
}

function SidebarItemRowImpl({
  item,
  active,
  onItemClick,
  onPinItem,
  onUnpinItem,
  onDeleteThread,
  onRenameThread,
}: SidebarItemRowProps) {
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(item.name);
  const inputRef = useRef<HTMLInputElement>(null);

  const isThread = item.ref.type === "thread";
  const Icon = ICON_MAP[item.icon];
  const age = formatAge(item.lastInteractedAt);

  const handleClick = useCallback(() => {
    if (!isRenaming) onItemClick(item.ref);
  }, [isRenaming, onItemClick, item.ref]);

  const handleStartRename = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setRenameValue(item.name);
    setIsRenaming(true);
  }, [item.name]);

  const handleConfirmRename = useCallback(() => {
    const trimmed = renameValue.trim();
    if (trimmed && trimmed !== item.name && onRenameThread && isThread) {
      onRenameThread(item.ref.id, trimmed);
    }
    setIsRenaming(false);
  }, [renameValue, item.name, item.ref.id, isThread, onRenameThread]);

  const handleCancelRename = useCallback(() => {
    setIsRenaming(false);
    setRenameValue(item.name);
  }, [item.name]);

  const handleRenameKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleConfirmRename();
    } else if (e.key === "Escape") {
      e.preventDefault();
      handleCancelRename();
    }
  }, [handleConfirmRename, handleCancelRename]);

  const handleDelete = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (isThread && onDeleteThread) onDeleteThread(item.ref.id);
  }, [isThread, onDeleteThread, item.ref.id]);

  const handleTogglePin = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (item.pinned) {
      onUnpinItem(item.ref);
    } else {
      onPinItem(item.ref);
    }
  }, [item.pinned, item.ref, onPinItem, onUnpinItem]);

  useEffect(() => {
    if (isRenaming && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isRenaming]);

  if (isRenaming) {
    return (
      <div
        className={cn(
          "magi-no-drag w-full h-[28px] rounded-[10px]",
          "flex items-center gap-1.5 px-2",
          "bg-white/[0.06]"
        )}
      >
        <Icon size={13} className="shrink-0 text-white" />
        <input
          ref={inputRef}
          value={renameValue}
          onChange={(e) => setRenameValue(e.target.value)}
          onKeyDown={handleRenameKeyDown}
          onBlur={handleConfirmRename}
          className="flex-1 min-w-0 text-[14px] text-white bg-transparent outline-none border-none"
        />
        <button
          onMouseDown={(e) => e.preventDefault()}
          onClick={(e) => { e.stopPropagation(); handleConfirmRename(); }}
          className="w-4 h-4 grid place-items-center text-white/60 hover:text-white"
          title="Confirm"
        >
          <Check size={12} />
        </button>
        <button
          onMouseDown={(e) => e.preventDefault()}
          onClick={(e) => { e.stopPropagation(); handleCancelRename(); }}
          className="w-4 h-4 grid place-items-center text-white/60 hover:text-white"
          title="Cancel"
        >
          <X size={12} />
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={handleClick}
      className={cn(
        "group/item magi-no-drag w-full h-[28px] rounded-[10px]",
        "flex items-center gap-1.5 px-2 text-left transition-[background-color,color] duration-75 ease-out",
        "text-[#C5CACF] hover:bg-white/[0.04] hover:text-white",
        active && "bg-white/[0.06] text-white"
      )}
      style={{
        contentVisibility: "auto",
        containIntrinsicSize: "28px",
      }}
      title={item.name}
    >
      <Icon size={13} className="shrink-0 text-white" />
      <span className="flex-1 text-[14px] truncate">{item.name}</span>

      {age && (
        <span className="text-[14px] text-[#8F959B] w-[36px] text-right shrink-0 group-hover/item:hidden">
          {age}
        </span>
      )}

      <div className="hidden group-hover/item:flex items-center gap-0.5 shrink-0">
        <span
          role="button"
          onClick={handleTogglePin}
          className="w-5 h-5 rounded-md grid place-items-center text-white/50 hover:text-white hover:bg-white/[0.08]"
          title={item.pinned ? "Unpin" : "Pin"}
        >
          {item.pinned ? <PinOff size={12} /> : <Pin size={12} />}
        </span>
        {isThread && onRenameThread && (
          <span
            role="button"
            onClick={handleStartRename}
            className="w-5 h-5 rounded-md grid place-items-center text-white/50 hover:text-white hover:bg-white/[0.08]"
            title="Rename"
          >
            <Pencil size={12} />
          </span>
        )}
        {isThread && onDeleteThread && (
          <span
            role="button"
            onClick={handleDelete}
            className="w-5 h-5 rounded-md grid place-items-center text-white/50 hover:text-red-400 hover:bg-white/[0.08]"
            title="Delete"
          >
            <Trash2 size={12} />
          </span>
        )}
      </div>
    </button>
  );
}

export const SidebarItemRow = memo(SidebarItemRowImpl);
