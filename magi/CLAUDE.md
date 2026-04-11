## Stack

- **Desktop:** Electron (main process + renderer)
- **Bundler:** electron-vite (Vite-based, handles main/preload/renderer)
- **UI:** React 19 + TypeScript
- **Styling:** Tailwind CSS v4 + shadcn/ui patterns
- **Icons:** lucide-react

## Commands

- `npm run dev` — Start Electron with Vite HMR
- `npm run build` — Production build to `out/`
- `npm run test` — Run vitest tests
- `npm run mcp` — Start MCP server on stdio
- `npm install` — Install dependencies

## Project Structure

```
src/
  shared/        — Shared cross-process platform types/helpers
  main/          — Electron main process (Node.js)
    window/      — Platform-specific window factories + dispatcher
    db/          — SQLite task database (better-sqlite3)
    ipc/         — IPC handlers (chat, data, magi)
    tools/       — Tool schemas & implementations
    activity/    — Activity tracking (keyboard, clipboard)
  preload/       — Preload scripts (context bridge)
  renderer/      — React chat UI (Vite-bundled)
    shells/      — Platform shell dispatcher + per-OS shell modules
    components/
      ui/        — shadcn-style base components
    lib/
      utils.ts   — cn() utility
  mcp/           — MCP server (stdio transport)
native/          — Swift keystroke-watcher (macOS)
scripts/         — Build scripts
```

## Conventions

- Use `@/` path alias for renderer imports (maps to `src/renderer/`)
- shadcn components go in `src/renderer/components/ui/`
- App-specific components go in `src/renderer/components/`
- Dark theme by default, CSS variables defined in `index.css`
- Use `cn()` from `@/lib/utils` for conditional classnames
- Use npm as the package manager

## Platform Architecture Guardrails

- Normalize platform via `src/shared/platform.ts` (`darwin | win32 | linux`).
- Main process must create windows through `src/main/window/create-window.ts`.
- Put OS-specific `BrowserWindow` options only in:
  - `src/main/window/platforms/mac.ts`
  - `src/main/window/platforms/win.ts`
  - `src/main/window/platforms/linux.ts`
- Renderer platform selection must go through `src/renderer/shells/index.tsx`.
- Shared UI components must not read `window.api.platform` directly.
- Windows-only behavior:
  - `backgroundMaterial` / `titleBarOverlay`
  - `data-window-active` tinting styles
- macOS behavior:
  - Native frame + hidden inset title bar path
  - Traffic-light safe spacing controlled by shell config (not hardcoded in shared components)
