# OC-2 Default Theme — Reference Copy

`oc-2.json` is the **default UI theme** shipped with opencode desktop
(the app `driveline-desktop/` is forked from).

- **Upstream source:** `packages/ui/src/theme/themes/oc-2.json` in the
  opencode desktop repo
- **License:** MIT (Copyright (c) 2025 opencode)
- **Why it's here:** keep a snapshot of the upstream defaults the Driveline
  brand is diverging from, so design decisions have a reference point without
  needing to crack open the fork

Do not modify this file. If the Driveline Desktop fork overrides any of these
tokens, do it in the fork's own theme files, not here.

## Structure

Each variant (`light` / `dark`) has two sections:

- **palette** — the 10 semantic colors the theme system derives everything
  else from (neutral, ink, primary, success, warning, error, info,
  interactive, diffAdd, diffDelete)
- **overrides** — explicit values for specific tokens (text, surface,
  border, icon, syntax) that shouldn't be auto-derived from the palette

## Quick read

Dark-mode primary is a warm orange (`#fab283`), neutrals are deep gray
(`#1f1f1f` surface, `#1C1C1C` base), interactive blue stays the same as
light mode (`#034cff`). Light-mode primary is a muted yellow-green
(`#dcde8d`) — notable because most dev-tool themes default to blue there.

Full schema:
https://opencode.ai/desktop-theme.json
