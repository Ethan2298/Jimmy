import { SquarePen } from "lucide-react";

interface MagiBarProps {
  onNewChat: () => void;
}

export function MagiBar({ onNewChat }: MagiBarProps) {
  return (
    <div className="flex items-center h-11 select-none border-b border-white/10 bg-[#0a0a0b]">
      {/* Draggable region */}
      <div className="flex-1 h-full magi-drag" />

      {/* Controls — not draggable */}
      <div className="flex items-center magi-no-drag pr-1">
        <button
          onClick={onNewChat}
          className="p-2 text-muted-foreground hover:text-foreground hover:bg-white/[0.06] transition-colors"
          title="New Chat"
        >
          <SquarePen size={14} />
        </button>
      </div>
    </div>
  );
}
