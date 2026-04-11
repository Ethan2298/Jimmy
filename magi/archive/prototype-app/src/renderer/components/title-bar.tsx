import { Minus, Square, X } from "lucide-react";
import { useSidebar } from "./ui/sidebar";

function IconLeftPanel({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 14 10" fill="none" className={className}>
      <rect x="0.5" y="0.5" width="13" height="9" rx="1.5" stroke="currentColor" strokeWidth="1" />
      <rect x="0.5" y="0.5" width="6.5" height="9" rx="1.5" fill="currentColor" />
    </svg>
  );
}

export function TitleBar() {
  const { toggle } = useSidebar();

  if (window.api?.platform === "darwin") return null;

  return (
    <div className="titlebar-drag fixed top-0 left-0 right-0 h-8 z-50 flex items-center justify-between bg-sidebar">
      <button
        onClick={toggle}
        className="titlebar-no-drag h-8 w-10 flex items-center justify-center text-muted-foreground/40 hover:text-foreground hover:bg-accent transition-colors cursor-pointer"
      >
        <IconLeftPanel className="h-4 w-4" />
      </button>
      <div className="flex">
        <button
          className="titlebar-no-drag h-8 w-11 flex items-center justify-center text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          onClick={() => window.api?.windowMinimize()}
        >
          <Minus className="size-3.5" />
        </button>
        <button
          className="titlebar-no-drag h-8 w-11 flex items-center justify-center text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          onClick={() => window.api?.windowMaximize()}
        >
          <Square className="size-3" />
        </button>
        <button
          className="titlebar-no-drag h-8 w-11 flex items-center justify-center text-muted-foreground hover:bg-red-500 hover:text-white transition-colors"
          onClick={() => window.api?.windowClose()}
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}
