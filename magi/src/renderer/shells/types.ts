import type { ReactNode } from "react";

export interface ShellStyleConfig {
  useWindowsGlassLayout: boolean;
  applyActiveInactiveTint: boolean;
  rootCornerRadiusPx: number;
  headerGutterPx: number;
  showWindowControls: boolean;
}

export interface PlatformShellProps {
  sidebarOpen: boolean;
  sidebarWidth: number;
  onSidebarWidthChange: (width: number) => void;
  onToggleSidebar: () => void;
  sidebar: ReactNode;
  topBar: ReactNode;
  stream: ReactNode;
  composer: ReactNode;
}
