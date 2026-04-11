import { AppShell } from "../components/app-shell";
import { getShellProps } from "./config";
import type { PlatformShellProps } from "./types";

export function LinuxShell(props: PlatformShellProps) {
  return <AppShell {...props} styleConfig={getShellProps("linux")} />;
}
