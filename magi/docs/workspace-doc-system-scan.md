# Workspace Docs System Scan (Current Implementation)

Last updated: February 27, 2026

## 1. What this document covers
This is a plain-English scan of the full "workspace docs" system:
- how docs are created and shown in the UI
- how the markdown editor works
- how text is saved
- what keyboard behavior is custom vs default
- what is tested vs not tested

This does not cover the AI chat streaming internals unless they touch workspace docs.

## 2. High-level architecture
There are 4 layers involved:
1. `Workspace state model` (`src/renderer/lib/workspace.ts`): the source of truth for doc metadata + doc content.
2. `App wiring` (`src/renderer/App.tsx`): connects selected workspace item to the right page and save behavior.
3. `Page rendering` (`src/renderer/components/workspace-item-page.tsx`): routes docs to the editor component.
4. `Editor runtime` (`src/renderer/components/workspace-doc-editor.tsx` + Milkdown CSS): actual typing, markdown conversion, heading behavior.

## 3. Data model (what exists in state)
`WorkspaceState` stores:
- `items`: tree nodes (folder/doc/project)
- `docContentById`: markdown text by doc id
- `rootIds`: top-level order
- `selectedId`: selected workspace item
- `editingId`: item currently being renamed in the tree

Important behavior in `workspace.ts`:
- New doc -> creates empty markdown entry in `docContentById`.
- Delete doc/folder -> removes doc content entries for deleted descendants.
- Rename doc -> only changes title metadata, not body markdown.
- Normalization/migration -> backfills missing doc content with empty string and ignores invalid/non-doc content entries.

## 4. End-to-end flow (from click to saved text)
### A) Open a doc
1. User selects doc in `WorkspaceTree` (`workspace-tree.tsx`).
2. `App.tsx` updates `workspaceState.selectedId` and `mainView`.
3. If selected item is a doc, `WorkspaceItemPage` renders `WorkspaceDocEditor`.

### B) Type in the editor
1. Milkdown/Crepe editor emits `markdownUpdated` on edits.
2. `WorkspaceDocEditor` calls `onChange(markdown)`.
3. `App.tsx` calls `updateWorkspaceDocContent(...)`.
4. React state updates for workspace content.

### C) Persist
- Workspace state is saved to local storage key: `outcome-ai:workspace-state-v1`.
- Save happens in a React `useEffect` on every workspace state change (no debounce currently).

## 5. Editor behavior and defaults
The editor uses `@milkdown/crepe`.

Enabled/disabled features:
- Disabled explicitly: toolbar, block edit controls, link tooltip, code mirror, image block, table, latex.
- Kept by default: core markdown behavior including headings, bold/italic, blockquotes, lists.

Heading styling:
- Milkdown default stylesheet is loaded from `@milkdown/crepe/theme/common/style.css` in `src/renderer/main.tsx`.
- This activates default heading sizing behavior for `#`, `##`, etc.

Font behavior:
- Editor font variables in `src/renderer/app.css` are set to the app default system font stack for both body and headings.

## 6. Custom keyboard behavior added
Custom rule in `workspace-doc-editor.tsx`:
- If cursor is at the start of an empty styled block (`heading`, `blockquote`, `code_block`), pressing Backspace converts the block back to normal paragraph immediately.

Why this exists:
- Without this, users often need an extra backspace to "exit" heading/blockquote mode after deleting all characters.

Current scope:
- This shortcut currently covers headings, blockquotes, and code blocks.
- It does not currently override list-item behavior.

## 7. Styling system
Editor visual system is split across:
- Base Milkdown theme CSS import in `main.tsx`.
- App-specific overrides in `app.css` under `.workspace-doc-editor .milkdown`.

Current override goals:
- dark-surface colors matching the app shell
- app-consistent typography
- constrained editor width/padding aligned to workspace page layout

## 8. Persistence boundaries (important)
Two different persistence paths exist:
- Chat threads: saved through IPC to `project-magi-data.json` (`window.api.saveData` / `data:save`).
- Workspace docs/state: currently local storage only (`outcome-ai:workspace-state-v1`).

Meaning:
- Workspace docs persist across normal app restarts on the same machine/profile.
- Workspace docs are not currently written into `project-magi-data.json`.

## 9. Test coverage status
Covered by tests (`src/renderer/lib/__tests__/workspace.test.ts`):
- creating docs and initializing doc content map
- deleting docs/folders and cleanup of doc content
- migration/normalization behavior
- moving/reordering tree items

Not currently covered by automated tests:
- editor UI behavior itself (Milkdown component integration)
- custom backspace shortcut behavior in the editor
- visual typography/styling outcomes

## 10. Practical implications for roadmap
If you want this system production-hard, the next high-impact steps are:
1. Add editor integration tests for heading conversion and backspace behavior.
2. Decide whether workspace docs should also be persisted to `project-magi-data.json` (single source of truth with chat) or remain local-storage-only.
3. Add lightweight save-throttling if high-frequency writes become a performance issue on slower devices.

## 11. File map (quick reference)
- `src/renderer/lib/workspace.ts`
- `src/renderer/App.tsx`
- `src/renderer/components/workspace-item-page.tsx`
- `src/renderer/components/workspace-doc-editor.tsx`
- `src/renderer/components/workspace-tree.tsx`
- `src/renderer/app.css`
- `src/renderer/main.tsx`
- `src/renderer/lib/__tests__/workspace.test.ts`
- `src/main/ipc/data.ts`
- `src/preload/index.ts`
