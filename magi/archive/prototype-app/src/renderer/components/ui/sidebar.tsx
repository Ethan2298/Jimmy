import {
  createContext,
  useContext,
  useState,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";

type SidebarContextValue = {
  collapsed: boolean;
  toggle: () => void;
};

const SidebarContext = createContext<SidebarContextValue>({
  collapsed: false,
  toggle: () => {},
});

export function useSidebar() {
  return useContext(SidebarContext);
}

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <SidebarContext.Provider
      value={{ collapsed, toggle: () => setCollapsed((c) => !c) }}
    >
      {children}
    </SidebarContext.Provider>
  );
}

export function Sidebar({
  children,
  className,
  collapsed: collapsedProp,
  width,
}: {
  children: ReactNode;
  className?: string;
  collapsed?: boolean;
  width?: string;
}) {
  const ctx = useSidebar();
  const isCollapsed = collapsedProp ?? ctx.collapsed;
  const sidebarWidth = width ?? "w-64";
  return (
    <aside
      className={cn(
        "shrink-0 overflow-hidden bg-sidebar text-sidebar-foreground transition-[width] duration-200",
        isCollapsed ? "w-0" : sidebarWidth,
        className
      )}
    >
      <div className={cn("flex h-full flex-col", sidebarWidth)}>
        {children}
      </div>
    </aside>
  );
}

export function SidebarHeader({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-2 px-4 pt-10 pb-4", className)}>
      {children}
    </div>
  );
}

export function SidebarContent({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex-1 overflow-y-auto overflow-x-hidden px-2 py-2", className)}>
      {children}
    </div>
  );
}

export function SidebarFooter({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("border-t border-sidebar-border px-2 py-2", className)}>
      {children}
    </div>
  );
}

export function SidebarGroup({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn("space-y-0.5", className)}>{children}</div>;
}

export function SidebarGroupLabel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "px-2 text-xs font-normal text-muted-foreground/60",
        className
      )}
    >
      {children}
    </div>
  );
}

export function SidebarMenuItem({
  children,
  active,
  noHover,
  className,
  onClick,
}: {
  children: ReactNode;
  active?: boolean;
  noHover?: boolean;
  className?: string;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2 rounded-sm h-7 px-2 text-sm transition-colors titlebar-no-drag cursor-pointer",
        active
          ? "bg-sidebar-accent text-sidebar-accent-foreground"
          : noHover
            ? "text-muted-foreground"
            : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
        className
      )}
    >
      {children}
    </button>
  );
}
