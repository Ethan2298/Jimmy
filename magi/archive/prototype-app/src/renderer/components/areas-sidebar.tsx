import { useState, useRef, useEffect } from "react";
import { Settings, Plus, Trash2, MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Area } from "../App";
import { IconPicker, OutcomeIcon } from "./icon-picker";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "./ui/dropdown-menu";
import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarMenuItem,
  useSidebar,
} from "./ui/sidebar";

function IconLeftPanel({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 14 10" fill="none" className={className}>
      <rect x="0.5" y="0.5" width="13" height="9" rx="1.5" stroke="currentColor" strokeWidth="1" />
      <rect x="0.5" y="0.5" width="6.5" height="9" rx="1.5" fill="currentColor" />
    </svg>
  );
}

type Page = "home" | "goal" | "settings";

export function AreasSidebar({
  activePage,
  activeAreaId,
  areas,
  onNavigate,
  onSelectArea,
  onAddArea,
  onUpdateArea,
  onDeleteArea,
}: {
  activePage: Page;
  activeAreaId: string | null;
  areas: Area[];
  onNavigate: (page: Page) => void;
  onSelectArea: (id: string) => void;
  onAddArea: (title: string) => void;
  onUpdateArea: (id: string, partial: Partial<Area>) => void;
  onDeleteArea: (id: string) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const { collapsed, toggle } = useSidebar();
  const isWindows = window.api?.platform !== "darwin";

  useEffect(() => {
    if (adding) inputRef.current?.focus();
  }, [adding]);

  function submitNew() {
    const title = newTitle.trim();
    if (!title) {
      setAdding(false);
      setNewTitle("");
      return;
    }
    onAddArea(title);
    setNewTitle("");
    setAdding(false);
  }

  return (
    <>
      {/* Floating sidebar toggle (macOS only — on Windows it's in the title bar) */}
      {!isWindows && (
        <div
          className={cn(
            "fixed z-[100] transition-all duration-200 titlebar-no-drag",
            collapsed ? "top-[10px] left-[72px]" : "top-[10px] left-[141px]"
          )}
        >
          <button
            onClick={toggle}
            className="rounded-md p-1.5 text-muted-foreground/40 hover:text-foreground hover:bg-accent transition-colors cursor-pointer"
          >
            <IconLeftPanel className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <Sidebar width="w-48">
        <SidebarHeader />

        <SidebarContent>
          <SidebarGroup>
            {areas.map((area) => (
              <div key={area.id} className="group relative flex items-center">
                <SidebarMenuItem
                  active={activeAreaId === area.id}
                  noHover
                  onClick={() => onSelectArea(area.id)}
                  className="flex-1 pr-8 group-hover:bg-sidebar-accent group-hover:text-sidebar-accent-foreground"
                >
                  <IconPicker
                    icon={area.icon}
                    iconColor={area.iconColor}
                    onChangeIcon={(icon) => onUpdateArea(area.id, { icon })}
                    onChangeColor={(iconColor) => onUpdateArea(area.id, { iconColor })}
                  >
                    <div
                      className="rounded-sm p-1 transition-colors"
                      style={{ backgroundColor: `${area.iconColor || "#8a8f98"}20` }}
                    >
                      <OutcomeIcon icon={area.icon} iconColor={area.iconColor} size={12} />
                    </div>
                  </IconPicker>
                  <span className="truncate">{area.title}</span>
                </SidebarMenuItem>
                {areas.length > 1 && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        onClick={(e) => e.stopPropagation()}
                        className={cn(
                          "absolute right-1 p-1 rounded-md z-10",
                          "opacity-0 group-hover:opacity-100 data-[state=open]:opacity-100",
                          "text-muted-foreground hover:text-foreground",
                          "transition-all cursor-pointer"
                        )}
                      >
                        <MoreHorizontal className="h-3.5 w-3.5" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" side="right">
                      <DropdownMenuItem
                        destructive
                        onClick={() => onDeleteArea(area.id)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            ))}
            {adding ? (
              <div className="px-2 py-0.5">
                <input
                  ref={inputRef}
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") submitNew();
                    if (e.key === "Escape") {
                      setAdding(false);
                      setNewTitle("");
                    }
                  }}
                  onBlur={submitNew}
                  placeholder="Area name..."
                  className={cn(
                    "w-full bg-transparent text-sm text-sidebar-foreground",
                    "placeholder:text-muted-foreground/40",
                    "border-b border-border pb-1 focus:outline-none"
                  )}
                />
              </div>
            ) : (
              <SidebarMenuItem onClick={() => setAdding(true)}>
                <Plus className="w-3.5 h-3.5" />
                <span>New Area</span>
              </SidebarMenuItem>
            )}
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter>
          <SidebarMenuItem
            active={activePage === "settings"}
            onClick={() => onNavigate("settings")}
          >
            <Settings className="w-3.5 h-3.5" />
            <span>Settings</span>
          </SidebarMenuItem>
        </SidebarFooter>
      </Sidebar>
    </>
  );
}
