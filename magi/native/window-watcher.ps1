# Window Watcher — Long-running process that monitors the foreground window.
# Outputs JSON lines to stdout for consumption by Electron main process.
# Requires: Windows OS

$ErrorActionPreference = "Stop"

Add-Type @"
using System;
using System.Runtime.InteropServices;
using System.Text;

public class WindowApi {
    [DllImport("user32.dll")]
    public static extern IntPtr GetForegroundWindow();

    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    public static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);

    [DllImport("user32.dll")]
    public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);
}
"@

$lastApp = ""
$lastTitle = ""
$lastPid = 0
$lastSwitchTime = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()

# Switch to SilentlyContinue for the polling loop
$ErrorActionPreference = "SilentlyContinue"

# Write to stderr so Electron can see we started
[Console]::Error.WriteLine("window-watcher: listening")

while ($true) {
    try {
        $hwnd = [WindowApi]::GetForegroundWindow()

        if ($hwnd -ne [IntPtr]::Zero) {
            # Get window title
            $sb = New-Object System.Text.StringBuilder(512)
            [void][WindowApi]::GetWindowText($hwnd, $sb, 512)
            $title = $sb.ToString()

            # Get process ID and name
            # Note: avoid $pid — it's a read-only automatic variable in PowerShell
            $wpid = [uint32]0
            [void][WindowApi]::GetWindowThreadProcessId($hwnd, [ref]$wpid)

            $app = "Unknown"
            if ($wpid -gt 0) {
                $proc = Get-Process -Id $wpid -ErrorAction SilentlyContinue
                if ($proc) {
                    $app = $proc.ProcessName
                }
            }

            $now = Get-Date -Format "o"
            $nowMs = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()

            # Only emit events when the window actually changes
            if ($app -ne $lastApp -or $title -ne $lastTitle) {
                $focusJson = @{
                    type = "window_focus"
                    app = $app
                    title = $title
                    pid = [int]$wpid
                    timestamp = $now
                } | ConvertTo-Json -Compress
                [Console]::WriteLine($focusJson)

                # Only emit app_switch and reset timer on actual app changes
                if ($app -ne $lastApp -and $lastApp -ne "") {
                    $durationMs = $nowMs - $lastSwitchTime

                    $switchJson = @{
                        type = "app_switch"
                        from_app = $lastApp
                        from_title = $lastTitle
                        to_app = $app
                        to_title = $title
                        duration_ms = [long]$durationMs
                        timestamp = $now
                    } | ConvertTo-Json -Compress
                    [Console]::WriteLine($switchJson)

                    $lastSwitchTime = $nowMs
                }

                $lastApp = $app
                $lastTitle = $title
                $lastPid = [int]$wpid
            }
        }
    }
    catch {
        # Silently continue on errors
    }

    Start-Sleep -Seconds 2
}
