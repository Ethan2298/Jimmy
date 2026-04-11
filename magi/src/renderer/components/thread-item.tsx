import { memo, useCallback, useEffect, useRef, useState } from "react";
import { MessageCircle, Pencil, Trash2, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ThreadItemProps {
  id: string;
  title: string;
  age: string;
  active?: boolean;
  highlighted?: boolean;
  onSelectThread: (id: string) => void;
  onDeleteThread: (id: string) => void;
  onRenameThread: (id: string, title: string) => void;
}

function ThreadItemImpl({
  id,
  title,
  age,
  active = false,
  highlighted = false,
  onSelectThread,
  onDeleteThread,
  onRenameThread,
}: ThreadItemProps) {
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(title);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleClick = useCallback(() => {
    if (!isRenaming) onSelectThread(id);
  }, [id, isRenaming, onSelectThread]);

  const handleStartRename = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setRenameValue(title);
    setIsRenaming(true);
  }, [title]);

  const handleConfirmRename = useCallback(() => {
    const trimmed = renameValue.trim();
    if (trimmed && trimmed !== title) {
      onRenameThread(id, trimmed);
    }
    setIsRenaming(false);
  }, [id, renameValue, title, onRenameThread]);

  const handleCancelRename = useCallback(() => {
    setIsRenaming(false);
    setRenameValue(title);
  }, [title]);

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
    onDeleteThread(id);
  }, [id, onDeleteThread]);

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
        <MessageCircle size={13} className="shrink-0 text-white" />
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
        "group/thread magi-no-drag w-full h-[28px] rounded-[10px]",
        "flex items-center gap-1.5 px-2 text-left transition-[background-color,color] duration-75 ease-out",
        "text-[#C5CACF] hover:bg-white/[0.04] hover:text-white",
        active && "bg-white/[0.06] text-white",
        !active && highlighted && "bg-white/[0.04] text-white"
      )}
      style={{
        contentVisibility: "auto",
        containIntrinsicSize: "28px",
      }}
      data-highlighted={highlighted}
      title={title}
    >
      <MessageCircle size={13} className="shrink-0 text-white" />
      <span className="flex-1 text-[14px] truncate">{title}</span>

      {/* Age badge - hidden on hover when action icons show */}
      <span className="text-[14px] text-[#8F959B] w-[36px] text-right shrink-0 group-hover/thread:hidden">
        {age}
      </span>

      {/* Action icons - visible on hover */}
      <div className="hidden group-hover/thread:flex items-center gap-0.5 shrink-0">
        <span
          role="button"
          onClick={handleStartRename}
          className="w-5 h-5 rounded-md grid place-items-center text-white/50 hover:text-white hover:bg-white/[0.08]"
          title="Rename"
        >
          <Pencil size={12} />
        </span>
        <span
          role="button"
          onClick={handleDelete}
          className="w-5 h-5 rounded-md grid place-items-center text-white/50 hover:text-red-400 hover:bg-white/[0.08]"
          title="Delete"
        >
          <Trash2 size={12} />
        </span>
      </div>
    </button>
  );
}

export const ThreadItem = memo(ThreadItemImpl);
