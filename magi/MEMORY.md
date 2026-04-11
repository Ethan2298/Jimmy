# Project Memory

## Platform Isolation (2026-02-26)

- Window creation is platform-isolated:
  - Dispatcher: `src/main/window/create-window.ts`
  - Platform modules: `src/main/window/platforms/{mac,win,linux}.ts`
- Renderer shell is platform-isolated:
  - Dispatcher: `src/renderer/shells/index.tsx`
  - Platform shells: `src/renderer/shells/{mac-shell,win-shell,linux-shell}.tsx`
- Shared platform contract:
  - `src/shared/platform.ts`
  - `Platform = "darwin" | "win32" | "linux"`

## Do Not Regress

- Do not add platform conditionals back into shared shell components (`TopBar`, `LeftSidebar`, `AppShell`).
- Do not use Windows-only visual APIs outside Windows modules (`backgroundMaterial`, `titleBarOverlay`).
- Keep active/inactive window tint behavior scoped to Windows-only CSS selectors.
- Keep mac traffic-light spacing driven by shell config (`topBarMacInsetPx`), not hardcoded platform checks.
