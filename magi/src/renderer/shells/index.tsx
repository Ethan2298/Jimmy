import type { ComponentType } from "react";
import type { Platform } from "../../shared/platform";
import { LinuxShell } from "./linux-shell";
import { MacShell } from "./mac-shell";
import { WinShell } from "./win-shell";
import type { PlatformShellProps } from "./types";

export function resolveShellComponent(platform: Platform): ComponentType<PlatformShellProps> {
  switch (platform) {
    case "darwin":
      return MacShell;
    case "win32":
      return WinShell;
    case "linux":
    default:
      return LinuxShell;
  }
}

interface PlatformShellRendererProps extends PlatformShellProps {
  platform: Platform;
}

export function PlatformShell({ platform, ...props }: PlatformShellRendererProps) {
  const ShellComponent = resolveShellComponent(platform);
  return <ShellComponent {...props} />;
}

export { getShellProps } from "./config";
export type { ShellStyleConfig, PlatformShellProps } from "./types";
