# Driveline Radius Overlay — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hot-wire OpenCode's border-radius system from a dedicated workspace package that lives outside `packages/ui/`, so upstream OpenCode updates never clobber Driveline's brand decisions and all radii can be controlled from one file.

**Architecture:** Create `packages/driveline-theme` as a sibling workspace package. It owns (a) TypeScript token definitions, (b) a pure `generateCss()` function that turns tokens into override CSS, and (c) a runtime that injects a `<style id="driveline-theme">` element into `<head>`. Integration is one `import "@driveline/theme"` line in two entry files. The package uses CSS custom properties + high-specificity selectors + `!important` to override every radius declaration in upstream — including hardcoded component values and Tailwind `--radius-*` tokens. Future phases add colors, fonts, spacing via the same pattern.

**Tech Stack:** TypeScript, Bun workspaces, bun test (for unit tests), happy-dom (already used in the monorepo) for DOM tests, plain CSS (no framework).

---

## Work location

All work happens inside the driveline-desktop fork: `C:\Users\ethan\Jimmy\driveline-desktop\` on branch `driveline/main`. This is our isolation from upstream. Do not commit to `dev` — that branch tracks `upstream/dev` cleanly for future merges.

## Rebase survival contract

After this plan, upstream OpenCode can refactor everything under `packages/ui/src/styles/` without breaking Driveline. The only upstream-adjacent edits are **two one-line imports** in `packages/app/src/entry.tsx` and `packages/desktop-electron/src/renderer/index.tsx`. During future `git merge upstream/dev`, conflicts are possible only in those two files.

---

## File structure

**Create (all new, inside `packages/driveline-theme/`):**
- `package.json` — workspace package manifest
- `tsconfig.json` — extends root, emits types
- `src/index.ts` — public API + auto-init side effect
- `src/tokens.ts` — token definitions, defaults, TypeScript types
- `src/generate-css.ts` — pure function: tokens → CSS string
- `src/generate-css.test.ts` — tests for the pure function
- `src/runtime.ts` — DOM-side injection + live updates
- `src/runtime.test.ts` — tests using happy-dom
- `README.md` — package docs + rebase notes

**Modify (upstream-adjacent, one line each):**
- `packages/app/src/entry.tsx` — add `import "@driveline/theme"` near the top
- `packages/desktop-electron/src/renderer/index.tsx` — same one-line import

**Clean up (after verifying new system works, Task 9):**
- Delete `packages/ui/src/styles/driveline-overrides.css`
- Remove `@import "./driveline-overrides.css"` line from `packages/ui/src/styles/index.css`
- Revert `packages/ui/src/styles/theme.css` radius tokens to upstream values
- Revert `packages/ui/src/styles/tailwind/index.css` radius tokens to upstream values

---

## Task 1: Scaffold the workspace package

**Files:**
- Create: `packages/driveline-theme/package.json`
- Create: `packages/driveline-theme/tsconfig.json`
- Create: `packages/driveline-theme/src/index.ts`
- Create: `packages/driveline-theme/README.md`

- [ ] **Step 1: Create package.json**

Write `packages/driveline-theme/package.json`:

```json
{
  "$schema": "https://json.schemastore.org/package.json",
  "name": "@driveline/theme",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "description": "Driveline design-token overlay that hot-wires OpenCode's style system without modifying upstream files.",
  "exports": {
    ".": "./src/index.ts",
    "./tokens": "./src/tokens.ts",
    "./generate-css": "./src/generate-css.ts"
  },
  "scripts": {
    "typecheck": "tsgo -b",
    "test": "bun test ./src"
  },
  "devDependencies": {
    "@happy-dom/global-registrator": "20.0.11",
    "@types/bun": "catalog:",
    "@types/node": "catalog:",
    "@typescript/native-preview": "catalog:",
    "typescript": "catalog:"
  },
  "license": "MIT"
}
```

- [ ] **Step 2: Create tsconfig.json**

Write `packages/driveline-theme/tsconfig.json`:

```json
{
  "extends": "@tsconfig/node22/tsconfig.json",
  "compilerOptions": {
    "composite": true,
    "declaration": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "moduleResolution": "bundler",
    "strict": true,
    "noEmit": false,
    "skipLibCheck": true
  },
  "include": ["src/**/*"],
  "exclude": ["**/*.test.ts"]
}
```

- [ ] **Step 3: Create placeholder index.ts**

Write `packages/driveline-theme/src/index.ts`:

```typescript
export {}
```

- [ ] **Step 4: Create README.md**

Write `packages/driveline-theme/README.md`:

```markdown
# @driveline/theme

Hot-wires OpenCode's style system. Lives outside `packages/ui/` so upstream patches don't clobber our design decisions.

## Usage

```ts
import "@driveline/theme" // side effect: injects overrides into <head>
```

## Rebase notes

When merging `upstream/dev`:
- Conflicts possible in `packages/app/src/entry.tsx` and `packages/desktop-electron/src/renderer/index.tsx` (our one-line imports may move around)
- This package itself is invisible to upstream — never touched by `upstream/dev`
- If upstream adds new popup surfaces, add their selectors to `src/generate-css.ts` carveouts list
```

- [ ] **Step 5: Verify workspace picks it up**

Run: `cd /c/Users/ethan/Jimmy/driveline-desktop && bun install`

Expected: installs without error; `packages/driveline-theme/node_modules` exists.

- [ ] **Step 6: Commit**

```bash
cd /c/Users/ethan/Jimmy/driveline-desktop
git add packages/driveline-theme
git commit -m "feat(theme): scaffold @driveline/theme workspace package"
```

---

## Task 2: Token definitions with tests

**Files:**
- Create: `packages/driveline-theme/src/tokens.ts`
- Create: `packages/driveline-theme/src/tokens.test.ts`

- [ ] **Step 1: Write the failing test**

Write `packages/driveline-theme/src/tokens.test.ts`:

```typescript
import { describe, expect, test } from "bun:test"
import { DEFAULTS, RADIUS_SCALE_KEYS } from "./tokens"

describe("tokens", () => {
  test("radius scale has the five standard keys in order", () => {
    expect(RADIUS_SCALE_KEYS).toEqual(["xs", "sm", "md", "lg", "xl"])
  })

  test("DEFAULTS.inputRadius is 14px", () => {
    expect(DEFAULTS.inputRadius).toBe(14)
  })

  test("DEFAULTS.itemRadius is 10px", () => {
    expect(DEFAULTS.itemRadius).toBe(10)
  })

  test("DEFAULTS.cap is enabled at 2px", () => {
    expect(DEFAULTS.cap).toEqual({ enabled: true, px: 2 })
  })

  test("DEFAULTS.radiusScale has an entry for every key", () => {
    for (const key of RADIUS_SCALE_KEYS) {
      expect(DEFAULTS.radiusScale[key]).toBeTypeOf("number")
    }
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd packages/driveline-theme && bun test ./src/tokens.test.ts`
Expected: FAIL with "Cannot find module './tokens'"

- [ ] **Step 3: Write the implementation**

Write `packages/driveline-theme/src/tokens.ts`:

```typescript
export const RADIUS_SCALE_KEYS = ["xs", "sm", "md", "lg", "xl"] as const
export type RadiusScaleKey = (typeof RADIUS_SCALE_KEYS)[number]

export type RadiusScale = Record<RadiusScaleKey, number>

export type RadiusCap = {
  enabled: boolean
  px: number
}

export type ThemeTokens = {
  /** Base Tailwind --radius-* scale, in pixels */
  radiusScale: RadiusScale
  /** Global border-radius cap applied to *, ::before, ::after */
  cap: RadiusCap
  /** Radius for the agent input shell + all picker popups (dock-surface, popover, dropdown, etc.) */
  inputRadius: number
  /** Radius for interactive items inside popups (menu items, select items, hover highlights) */
  itemRadius: number
}

export const DEFAULTS: ThemeTokens = {
  radiusScale: {
    xs: 1,
    sm: 2,
    md: 3,
    lg: 4,
    xl: 5,
  },
  cap: { enabled: true, px: 2 },
  inputRadius: 14,
  itemRadius: 10,
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `bun test ./src/tokens.test.ts`
Expected: 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/driveline-theme/src/tokens.ts packages/driveline-theme/src/tokens.test.ts
git commit -m "feat(theme): define radius tokens + defaults"
```

---

## Task 3: `generateCss` — pure function, tokens → CSS string

**Files:**
- Create: `packages/driveline-theme/src/generate-css.ts`
- Create: `packages/driveline-theme/src/generate-css.test.ts`

- [ ] **Step 1: Write the failing test**

Write `packages/driveline-theme/src/generate-css.test.ts`:

```typescript
import { describe, expect, test } from "bun:test"
import { generateCss, CARVEOUT_SELECTORS, ITEM_SELECTORS } from "./generate-css"
import { DEFAULTS } from "./tokens"

describe("generateCss", () => {
  test("emits the --driveline-input-radius custom property", () => {
    const css = generateCss(DEFAULTS)
    expect(css).toContain("--driveline-input-radius: 14px")
  })

  test("emits the --driveline-item-radius custom property", () => {
    const css = generateCss(DEFAULTS)
    expect(css).toContain("--driveline-item-radius: 10px")
  })

  test("emits all five --radius-* tailwind tokens with px values", () => {
    const css = generateCss(DEFAULTS)
    expect(css).toContain("--radius-xs: 1px")
    expect(css).toContain("--radius-sm: 2px")
    expect(css).toContain("--radius-md: 3px")
    expect(css).toContain("--radius-lg: 4px")
    expect(css).toContain("--radius-xl: 5px")
  })

  test("emits the universal cap rule when cap is enabled", () => {
    const css = generateCss(DEFAULTS)
    expect(css).toContain("*,*::before,*::after{border-radius:2px !important}")
  })

  test("omits the universal cap rule when cap is disabled", () => {
    const css = generateCss({ ...DEFAULTS, cap: { enabled: false, px: 2 } })
    expect(css).not.toContain("*,*::before,*::after{border-radius:")
  })

  test("emits all carve-out selectors with --driveline-input-radius", () => {
    const css = generateCss(DEFAULTS)
    for (const selector of CARVEOUT_SELECTORS) {
      expect(css).toContain(selector)
    }
    expect(css).toContain("border-radius: var(--driveline-input-radius) !important")
  })

  test("emits item selectors with --driveline-item-radius", () => {
    const css = generateCss(DEFAULTS)
    for (const selector of ITEM_SELECTORS) {
      expect(css).toContain(selector)
    }
    expect(css).toContain("border-radius: var(--driveline-item-radius) !important")
  })

  test("preserves flat-top carve-out for docked trays", () => {
    const css = generateCss(DEFAULTS)
    expect(css).toContain('[data-dock-surface="tray"][data-dock-attach="top"]')
    expect(css).toContain("border-top-left-radius: 0 !important")
    expect(css).toContain("border-top-right-radius: 0 !important")
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun test ./src/generate-css.test.ts`
Expected: FAIL with module not found.

- [ ] **Step 3: Write the implementation**

Write `packages/driveline-theme/src/generate-css.ts`:

```typescript
import type { ThemeTokens } from "./tokens"
import { RADIUS_SCALE_KEYS } from "./tokens"

/**
 * Surfaces that should share the "agent input" radius.
 * Add new popup-surface selectors here as upstream introduces them.
 */
export const CARVEOUT_SELECTORS = [
  '[data-dock-surface="shell"]',
  '[data-dock-surface="tray"]',
  '[data-component="popover-content"]',
  '[data-component="dropdown-menu-content"]',
  '[data-component="dropdown-menu-sub-content"]',
  '[data-component="context-menu-content"]',
  '[data-component="context-menu-sub-content"]',
  '[data-component="hover-card-content"]',
  '[data-component="select-content"]',
] as const

/**
 * Interactive items inside popups (hover highlights, selection rows).
 */
export const ITEM_SELECTORS = [
  '[data-slot="dropdown-menu-item"]',
  '[data-slot="dropdown-menu-checkbox-item"]',
  '[data-slot="dropdown-menu-radio-item"]',
  '[data-slot="context-menu-item"]',
  '[data-slot="context-menu-checkbox-item"]',
  '[data-slot="context-menu-radio-item"]',
  '[data-slot="select-select-item"]',
] as const

/**
 * Turn theme tokens into an override CSS string.
 * Pure — no DOM access. Safe to call on server or in tests.
 */
export function generateCss(tokens: ThemeTokens): string {
  const rootVars: string[] = [
    `--driveline-input-radius: ${tokens.inputRadius}px`,
    `--driveline-item-radius: ${tokens.itemRadius}px`,
  ]
  for (const key of RADIUS_SCALE_KEYS) {
    rootVars.push(`--radius-${key}: ${tokens.radiusScale[key]}px`)
  }

  const capRule = tokens.cap.enabled
    ? `*,*::before,*::after{border-radius:${tokens.cap.px}px !important}`
    : ""

  const carveout = `${CARVEOUT_SELECTORS.join(",")}{border-radius: var(--driveline-input-radius) !important}`
  const dockTrayTop = `[data-dock-surface="tray"][data-dock-attach="top"]{border-top-left-radius: 0 !important;border-top-right-radius: 0 !important}`
  const itemRule = `${ITEM_SELECTORS.join(",")}{border-radius: var(--driveline-item-radius) !important}`

  return [
    `:root{${rootVars.join(";")}}`,
    capRule,
    carveout,
    dockTrayTop,
    itemRule,
  ]
    .filter(Boolean)
    .join("\n")
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `bun test ./src/generate-css.test.ts`
Expected: 8 tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/driveline-theme/src/generate-css.ts packages/driveline-theme/src/generate-css.test.ts
git commit -m "feat(theme): generateCss() — pure tokens-to-CSS transform"
```

---

## Task 4: Runtime — DOM injection + live updates

**Files:**
- Create: `packages/driveline-theme/src/runtime.ts`
- Create: `packages/driveline-theme/src/runtime.test.ts`

- [ ] **Step 1: Write the failing tests**

Write `packages/driveline-theme/src/runtime.test.ts`:

```typescript
import { beforeEach, describe, expect, test } from "bun:test"
import { GlobalRegistrator } from "@happy-dom/global-registrator"
import { applyTokens, initDrivelineTheme, STYLE_ELEMENT_ID } from "./runtime"
import { DEFAULTS } from "./tokens"

beforeEach(() => {
  if (!GlobalRegistrator.isRegistered) {
    GlobalRegistrator.register()
  }
  document.head.innerHTML = ""
})

describe("runtime", () => {
  test("initDrivelineTheme appends one <style> element to <head>", () => {
    initDrivelineTheme()
    const el = document.getElementById(STYLE_ELEMENT_ID)
    expect(el).not.toBeNull()
    expect(el?.tagName).toBe("STYLE")
  })

  test("initDrivelineTheme writes the defaults into the <style> element", () => {
    initDrivelineTheme()
    const el = document.getElementById(STYLE_ELEMENT_ID)
    expect(el?.textContent).toContain("--driveline-input-radius: 14px")
  })

  test("calling initDrivelineTheme twice does not duplicate the element", () => {
    initDrivelineTheme()
    initDrivelineTheme()
    const matches = document.querySelectorAll(`#${STYLE_ELEMENT_ID}`)
    expect(matches.length).toBe(1)
  })

  test("applyTokens replaces the <style> element textContent with new CSS", () => {
    initDrivelineTheme()
    applyTokens({ ...DEFAULTS, inputRadius: 22 })
    const el = document.getElementById(STYLE_ELEMENT_ID)
    expect(el?.textContent).toContain("--driveline-input-radius: 22px")
    expect(el?.textContent).not.toContain("--driveline-input-radius: 14px")
  })

  test("applyTokens creates the <style> element if init was not called", () => {
    applyTokens(DEFAULTS)
    const el = document.getElementById(STYLE_ELEMENT_ID)
    expect(el).not.toBeNull()
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bun test ./src/runtime.test.ts`
Expected: FAIL with module not found.

- [ ] **Step 3: Write the implementation**

Write `packages/driveline-theme/src/runtime.ts`:

```typescript
import { generateCss } from "./generate-css"
import { DEFAULTS, type ThemeTokens } from "./tokens"

export const STYLE_ELEMENT_ID = "driveline-theme"

function getOrCreateStyleElement(): HTMLStyleElement {
  if (typeof document === "undefined") {
    throw new Error("@driveline/theme runtime requires a DOM (document not found)")
  }
  const existing = document.getElementById(STYLE_ELEMENT_ID)
  if (existing && existing instanceof HTMLStyleElement) return existing
  const el = document.createElement("style")
  el.id = STYLE_ELEMENT_ID
  document.head.appendChild(el)
  return el
}

/**
 * Apply a token set, replacing whatever CSS is currently injected.
 * Creates the <style> element on first call.
 */
export function applyTokens(tokens: ThemeTokens): void {
  const el = getOrCreateStyleElement()
  el.textContent = generateCss(tokens)
}

/**
 * Initialize with DEFAULTS. Idempotent — calling twice is a no-op.
 */
export function initDrivelineTheme(): void {
  applyTokens(DEFAULTS)
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `bun test ./src/runtime.test.ts`
Expected: 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/driveline-theme/src/runtime.ts packages/driveline-theme/src/runtime.test.ts
git commit -m "feat(theme): runtime injection + live updates"
```

---

## Task 5: Wire up the public API + auto-init side effect

**Files:**
- Modify: `packages/driveline-theme/src/index.ts`

- [ ] **Step 1: Replace the placeholder with the real exports + init**

Replace the contents of `packages/driveline-theme/src/index.ts`:

```typescript
import { initDrivelineTheme } from "./runtime"

export { applyTokens, initDrivelineTheme, STYLE_ELEMENT_ID } from "./runtime"
export { DEFAULTS, RADIUS_SCALE_KEYS } from "./tokens"
export type { RadiusCap, RadiusScale, RadiusScaleKey, ThemeTokens } from "./tokens"
export { CARVEOUT_SELECTORS, ITEM_SELECTORS, generateCss } from "./generate-css"

// Side effect: initialize on first import. Safe in SSR — runtime.ts guards for missing document.
if (typeof document !== "undefined") {
  initDrivelineTheme()
}
```

- [ ] **Step 2: Verify typecheck passes**

Run: `cd packages/driveline-theme && bun run typecheck`
Expected: no errors.

- [ ] **Step 3: Verify all tests still pass**

Run: `bun test ./src`
Expected: all 18 tests pass (5 tokens + 8 generateCss + 5 runtime).

- [ ] **Step 4: Commit**

```bash
git add packages/driveline-theme/src/index.ts
git commit -m "feat(theme): public API + auto-init side effect"
```

---

## Task 6: Integrate into the app renderer

**Files:**
- Modify: `packages/app/src/entry.tsx`
- Modify: `packages/app/package.json` (add dependency)

- [ ] **Step 1: Add the workspace dependency**

Edit `packages/app/package.json`. Find the `"dependencies"` block (if absent, create one alongside `devDependencies`). Add:

```json
"@driveline/theme": "workspace:*"
```

- [ ] **Step 2: Run install to register the workspace link**

Run: `cd /c/Users/ethan/Jimmy/driveline-desktop && bun install`
Expected: no errors; `packages/app/node_modules/@driveline/theme` symlink exists.

- [ ] **Step 3: Add the import at the top of entry.tsx**

Edit `packages/app/src/entry.tsx`. Above the first import line (`// @refresh reload`), add:

```typescript
// @refresh reload

import "@driveline/theme" // Driveline design-token overlay (must load before renderer)

import { render } from "solid-js/web"
// ... rest of file unchanged
```

(Preserve the existing `// @refresh reload` directive as the first line — insert the driveline import after it.)

- [ ] **Step 4: Launch the Electron dev app and verify**

Run: `cd /c/Users/ethan/Jimmy/driveline-desktop && bun run dev:desktop`

Expected:
- App boots with sidecar
- Open the Electron DevTools (Ctrl+Shift+I)
- In the Elements panel, expand `<head>` — you see `<style id="driveline-theme">` with the generated CSS
- The agent input shell is rounded at 14px; menu items at 10px; everything else capped at 2px

- [ ] **Step 5: Commit**

```bash
git add packages/app/src/entry.tsx packages/app/package.json bun.lock
git commit -m "feat(theme): wire @driveline/theme into app renderer"
```

---

## Task 7: Integrate into the Electron renderer

**Files:**
- Modify: `packages/desktop-electron/src/renderer/index.tsx`
- Modify: `packages/desktop-electron/package.json` (add dependency)

- [ ] **Step 1: Add the workspace dependency**

Edit `packages/desktop-electron/package.json`. In `"devDependencies"` (where `@opencode-ai/ui` lives), add:

```json
"@driveline/theme": "workspace:*"
```

- [ ] **Step 2: Run install**

Run: `bun install`
Expected: no errors.

- [ ] **Step 3: Add the import to the renderer entry**

Edit `packages/desktop-electron/src/renderer/index.tsx`. Add as the first import line (or immediately after any existing `// @refresh reload` directive):

```typescript
import "@driveline/theme" // Driveline design-token overlay
```

- [ ] **Step 4: Relaunch the desktop app and confirm**

Run: `bun run dev:desktop`
Expected: Same visual result as Task 6, but now loaded through the Electron renderer's own entry (so if you ever run the app without the app-package renderer, the overlay still applies).

- [ ] **Step 5: Commit**

```bash
git add packages/desktop-electron/src/renderer/index.tsx packages/desktop-electron/package.json bun.lock
git commit -m "feat(theme): wire @driveline/theme into electron renderer"
```

---

## Task 8: Remove the old shim and revert ui-package edits

**Files:**
- Delete: `packages/ui/src/styles/driveline-overrides.css`
- Modify: `packages/ui/src/styles/index.css`
- Modify: `packages/ui/src/styles/theme.css`
- Modify: `packages/ui/src/styles/tailwind/index.css`

Rationale: the old shim was a quick hack that lived inside the ui package. Now that `@driveline/theme` owns everything, we restore those upstream files to their original state so future `git merge upstream/dev` is conflict-free there.

- [ ] **Step 1: Delete the overrides CSS file**

Run: `rm packages/ui/src/styles/driveline-overrides.css`

- [ ] **Step 2: Remove the import from index.css**

Edit `packages/ui/src/styles/index.css`. Remove these lines (they currently sit below `@import "./animations.css" layer(utilities);`):

```css

/* Unlayered — wins cascade over all @layer rules */
@import "./driveline-overrides.css";
```

- [ ] **Step 3: Revert radius tokens in theme.css to upstream values**

Edit `packages/ui/src/styles/theme.css`, restoring the five radius lines:

```css
  --radius-xs: 0.125rem;
  --radius-sm: 0.25rem;
  --radius-md: 0.375rem;
  --radius-lg: 0.5rem;
  --radius-xl: 0.625rem;
```

- [ ] **Step 4: Revert radius tokens in tailwind/index.css to upstream values**

Edit `packages/ui/src/styles/tailwind/index.css`, restoring the same five lines:

```css
  --radius-xs: 0.125rem;
  --radius-sm: 0.25rem;
  --radius-md: 0.375rem;
  --radius-lg: 0.5rem;
  --radius-xl: 0.625rem;
```

- [ ] **Step 5: Verify the app still looks Driveline-branded**

Run: `bun run dev:desktop`

Expected:
- The agent input is still 14px rounded, menu items still 10px, everything else still capped at 2px — but now all of that comes from `@driveline/theme`, not the old shim.
- Confirm in DevTools: `packages/ui/src/styles/theme.css` now serves the upstream `0.125rem`-style values, and `<style id="driveline-theme">` overrides them with px values at `:root` with equal specificity (later in cascade wins).

- [ ] **Step 6: Confirm `git diff upstream/dev -- packages/ui/src/styles/` is empty**

Run:
```bash
git fetch upstream
git diff upstream/dev -- packages/ui/src/styles/
```

Expected: empty diff. This is the core win — the ui package is now pristine relative to upstream.

- [ ] **Step 7: Commit**

```bash
git add packages/ui/src/styles/
git commit -m "chore(theme): remove old shim; ui package now pristine vs upstream"
```

---

## Task 9 (OPTIONAL — park unless you want the tweaker back)

You toggled the storybook tweaker off. This task exists only for when you want it back, wired into the new runtime. Skip it unless you're explicitly bringing the tweaker out of retirement.

## Task 9: Storybook tweaker — reroute to use @driveline/theme

**Files:**
- Modify: `packages/storybook/.storybook/driveline-tweaker.tsx`
- Modify: `packages/storybook/.storybook/preview.tsx`
- Modify: `packages/storybook/package.json` (add dependency)

Rationale: the existing tweaker writes its own `<style>` element. Moving it to call `applyTokens()` from `@driveline/theme` centralizes state — the tweaker becomes pure UI, the package owns the CSS.

- [ ] **Step 1: Add the workspace dependency to storybook**

Edit `packages/storybook/package.json`, add to `devDependencies`:

```json
"@driveline/theme": "workspace:*"
```

Run: `bun install`

- [ ] **Step 2: Rewrite driveline-tweaker.tsx to delegate to the package**

Replace the body of `packages/storybook/.storybook/driveline-tweaker.tsx` with:

```typescript
import { createSignal, createEffect, For, Show } from "solid-js"
import { applyTokens, DEFAULTS, RADIUS_SCALE_KEYS, type ThemeTokens } from "@driveline/theme"

const STORAGE_KEY = "driveline-tweaker-v2"

type State = ThemeTokens & { collapsed: boolean }

function loadState(): State {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULTS, collapsed: false }
    return { ...DEFAULTS, collapsed: false, ...JSON.parse(raw) }
  } catch {
    return { ...DEFAULTS, collapsed: false }
  }
}

function saveState(s: State) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s))
  } catch {}
}

export function DrivelineTweaker() {
  const initial = loadState()
  const [tokens, setTokens] = createSignal<ThemeTokens>({
    radiusScale: initial.radiusScale,
    cap: initial.cap,
    inputRadius: initial.inputRadius,
    itemRadius: initial.itemRadius,
  })
  const [collapsed, setCollapsed] = createSignal(initial.collapsed)

  createEffect(() => {
    applyTokens(tokens())
  })

  createEffect(() => {
    saveState({ ...tokens(), collapsed: collapsed() })
  })

  const reset = () => setTokens(DEFAULTS)

  const panel = {
    position: "fixed",
    bottom: "16px",
    right: "16px",
    "z-index": "99999",
    "font-family": "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
    "font-size": "11px",
    background: "#0b0b0b",
    color: "#e8e8e8",
    border: "1px solid rgba(255,255,255,0.08)",
    "box-shadow": "0 20px 60px -20px rgba(0,0,0,0.6)",
    "min-width": "280px",
    "max-width": "320px",
    "user-select": "none",
  } as const

  const header = {
    display: "flex",
    "align-items": "center",
    "justify-content": "space-between",
    padding: "10px 12px",
    "border-bottom": "1px solid rgba(255,255,255,0.08)",
    "letter-spacing": "0.08em",
    "text-transform": "uppercase",
    "font-size": "10px",
    color: "rgba(232,232,232,0.6)",
    cursor: "pointer",
  } as const

  const body = {
    padding: "12px",
    display: "flex",
    "flex-direction": "column",
    gap: "10px",
  } as const

  const row = {
    display: "grid",
    "grid-template-columns": "28px 1fr 42px",
    "align-items": "center",
    gap: "8px",
  } as const

  const label = {
    color: "rgba(232,232,232,0.5)",
    "font-size": "10px",
    "text-transform": "uppercase",
    "letter-spacing": "0.04em",
  } as const

  const valueCell = {
    "text-align": "right",
    color: "#ff9a6c",
    "font-variant-numeric": "tabular-nums",
  } as const

  const btn = {
    flex: "1",
    background: "transparent",
    color: "rgba(232,232,232,0.8)",
    border: "1px solid rgba(255,255,255,0.12)",
    padding: "6px 10px",
    "font-family": "inherit",
    "font-size": "10px",
    "letter-spacing": "0.06em",
    "text-transform": "uppercase",
    cursor: "pointer",
  } as const

  const slider = (
    labelText: string,
    min: number,
    max: number,
    value: number,
    onChange: (v: number) => void,
    unit = "px",
    disabled = false,
  ) => (
    <div style={row}>
      <span style={label}>{labelText}</span>
      <input
        type="range"
        min={min}
        max={max}
        step="0.5"
        value={value}
        disabled={disabled}
        onInput={(e) => onChange(parseFloat(e.currentTarget.value))}
        style={{ width: "100%", "accent-color": "#ff6a2c" }}
      />
      <span style={valueCell}>
        {value}
        {unit}
      </span>
    </div>
  )

  return (
    <div style={panel}>
      <div style={header} onClick={() => setCollapsed(!collapsed())}>
        <span>Driveline Tweaker</span>
        <span>{collapsed() ? "+" : "–"}</span>
      </div>
      <Show when={!collapsed()}>
        <div style={body}>
          <div style={label}>Tailwind scale</div>
          <For each={RADIUS_SCALE_KEYS}>
            {(key) =>
              slider(key, 0, 20, tokens().radiusScale[key], (v) =>
                setTokens({ ...tokens(), radiusScale: { ...tokens().radiusScale, [key]: v } }),
              )
            }
          </For>
          <div style={{ ...label, "margin-top": "6px" }}>
            Global cap{" "}
            <input
              type="checkbox"
              checked={tokens().cap.enabled}
              onChange={(e) =>
                setTokens({ ...tokens(), cap: { ...tokens().cap, enabled: e.currentTarget.checked } })
              }
              style={{ "accent-color": "#ff6a2c", "margin-left": "4px" }}
            />
          </div>
          {slider(
            "max",
            0,
            24,
            tokens().cap.px,
            (v) => setTokens({ ...tokens(), cap: { ...tokens().cap, px: v } }),
            "px",
            !tokens().cap.enabled,
          )}
          <div style={{ ...label, "margin-top": "6px" }}>Agent input + pickers</div>
          {slider("rad", 0, 32, tokens().inputRadius, (v) => setTokens({ ...tokens(), inputRadius: v }))}
          {slider("item", 0, 24, tokens().itemRadius, (v) => setTokens({ ...tokens(), itemRadius: v }))}
          <div style={{ display: "flex", gap: "8px", "margin-top": "4px", "border-top": "1px solid rgba(255,255,255,0.06)", "padding-top": "10px" }}>
            <button style={btn} onClick={reset}>
              Reset
            </button>
            <button
              style={btn}
              onClick={() => navigator.clipboard?.writeText(JSON.stringify(tokens(), null, 2))}
            >
              Copy JSON
            </button>
          </div>
        </div>
      </Show>
    </div>
  )
}
```

- [ ] **Step 3: Re-enable the tweaker in preview.tsx**

Edit `packages/storybook/.storybook/preview.tsx`. Uncomment the import and the JSX usage:

```typescript
import { DrivelineTweaker } from "./driveline-tweaker"
```

and in the JSX tree:

```tsx
              <Story />
            </div>
            <DrivelineTweaker />
          </MarkedProvider>
```

- [ ] **Step 4: Launch storybook and verify live control works**

Run: `cd packages/storybook && bun run storybook`

Expected:
- Panel appears bottom-right on every story
- Dragging `rad` updates the popover radius immediately
- Dragging `item` updates menu-item radii
- The changes persist through `localStorage`

- [ ] **Step 5: Commit**

```bash
git add packages/storybook/.storybook/driveline-tweaker.tsx packages/storybook/.storybook/preview.tsx packages/storybook/package.json bun.lock
git commit -m "feat(theme): storybook tweaker delegates to @driveline/theme runtime"
```

---

## Self-review checklist (run before claiming done)

- [ ] Every task has all steps completed
- [ ] `bun test ./packages/driveline-theme/src` passes (18 tests)
- [ ] `bun run typecheck` passes at root
- [ ] `git diff upstream/dev -- packages/ui/src/` is empty (ui package pristine)
- [ ] The only upstream-touching commits are the two one-line entry imports (Task 6/7) and the ui-package revert (Task 8)
- [ ] Storybook boots with the tweaker visible and live-editing
- [ ] Electron app boots with 14px agent input, 10px items, 2px cap elsewhere
- [ ] README.md describes the rebase survival contract

## Future extensions (not in this plan)

- Task 10+: extend `ThemeTokens` with `colorScale`, `fontStack`, `spacingScale`
- Task 11: per-rooftop theme loading (dealers ship their own token file)
- Task 12: strip the Storybook tweaker, replace with a Driveline admin UI that persists token changes to Supabase
- Task 13: build-time CSS generation (emit a static stylesheet for the production bundle — avoids a one-frame flash of unstyled radii on first paint)
