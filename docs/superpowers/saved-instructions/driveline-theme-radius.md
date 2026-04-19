# Saved Instructions — Driveline Theme: Border Radius

**Scope:** every border-radius in the Driveline desktop app.
**Single file to edit:** `driveline-desktop/packages/driveline-theme/src/tokens.ts`

Any change in that one file hot-reloads the entire app through Vite HMR. No other file needs to be touched to move every corner in the UI.

---

## The four knobs

All values are **absolute pixels**.

| Knob | What it affects | Current default |
|---|---|---|
| `cap.px` | Every corner *not* in a carveout. This is the global ceiling — clamps everything via `*{border-radius:Npx !important}`. | `5` |
| `inputRadius` | Agent text input + all picker popups (model picker, agent picker, thinking difficulty, popovers, dropdowns, context menus, hover cards, selects). | `10` |
| `itemRadius` | Interactive rows *inside* popups — menu items, select items, hover highlights. | `5` |
| `radiusScale.{xs,sm,md,lg,xl}` | Resets the Tailwind `--radius-*` tokens at `:root`. Mostly cosmetic when the cap is below these values — the cap's `!important` wins. Matters only for components that set `border-radius: ... !important` on themselves (rare). | `1, 2, 3, 4, 5` |
| `cap.enabled` | Disable the global cap entirely. When `false`, every component shows its hardcoded/tokened radius. | `true` |

## How the knobs interact

```
┌─ cap (global) ───────────────────────────────┐
│  * {border-radius: cap.px !important}        │
│  wins unless a carveout has higher specificity│
└──────────────────────────────────────────────┘
         │
         │  overridden on carveout surfaces ↓
         ▼
┌─ inputRadius ────────────────────────────────┐
│  dock-surface, popover-content,              │
│  dropdown-menu-content,                      │
│  context-menu-content, hover-card-content,   │
│  select-content                              │
└──────────────────────────────────────────────┘
         │
         │  overridden on item rows inside popups ↓
         ▼
┌─ itemRadius ─────────────────────────────────┐
│  dropdown-menu-item, context-menu-item,      │
│  select-select-item                          │
└──────────────────────────────────────────────┘
```

**Rules of thumb:**
- Raise `cap` → everything rounds together
- Raise `inputRadius` → only popups/inputs round, chrome stays flat
- Raise `itemRadius` → only rows inside popups round
- Raise `radiusScale` → usually invisible unless `cap.enabled = false`

## Typical recipes

**Sharp brutalist:** `cap:0, inputRadius:0, itemRadius:0`
**Crisp but civilized** (current): `cap:5, inputRadius:10, itemRadius:5`
**Friendly / soft:** `cap:8, inputRadius:16, itemRadius:10`
**Pill pickers / flat chrome:** `cap:2, inputRadius:24, itemRadius:12`

## How to edit

1. Open `driveline-desktop/packages/driveline-theme/src/tokens.ts`
2. Change the values under `DEFAULTS`
3. Save — Vite HMR pushes the change to the running Electron app in ~1 second
4. If it doesn't reload, focus the Electron window and `Ctrl+R`

## How to disable the cap (let every component breathe)

```ts
cap: { enabled: false, px: 5 },  // keep px for when you flip it back on
```

## Adding a new surface to the carveout list

If upstream OpenCode ships a new popup surface (e.g. `[data-component="command-palette-content"]`) and you want it to match the agent input radius:

1. Open `driveline-desktop/packages/driveline-theme/src/generate-css.ts`
2. Add the selector string to `CARVEOUT_SELECTORS` (for popup containers) or `ITEM_SELECTORS` (for row-level hover states)
3. Add a corresponding test assertion in `generate-css.test.ts`
4. `bun test ./src` from the package dir to confirm
5. Save — HMR picks it up

## Where the overlay plugs in

Two and only two files import the overlay. These are the sole upstream-adjacent touchpoints:

- `driveline-desktop/packages/app/src/entry.tsx` — line 3: `import "@driveline/theme"`
- `driveline-desktop/packages/desktop-electron/src/renderer/index.tsx` — line 3: same

When merging `upstream/dev`, these are the only files that can conflict for theme reasons. Everything else the overlay does lives inside `packages/driveline-theme/`, invisible to upstream.

## Verifying changes

- **Tests:** `cd driveline-desktop/packages/driveline-theme && bun test ./src` (18 tests)
- **DevTools:** open Electron DevTools (`Ctrl+Shift+I`), look for `<style id="driveline-theme">` in `<head>`. Its contents should match the current tokens.
- **Upstream diff stays empty:** `git diff upstream/dev -- packages/ui/src/styles/` should return zero lines. If it doesn't, something crept back into the ui package that belongs in the overlay.

## Related docs

- Implementation plan: `docs/superpowers/plans/2026-04-19-driveline-radius-overlay.md`
- Package README: `driveline-desktop/packages/driveline-theme/README.md`
- Package source: `driveline-desktop/packages/driveline-theme/src/`
