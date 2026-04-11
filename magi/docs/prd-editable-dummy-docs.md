# PRD: Editable Dummy Docs (Human WYSIWYG Editing)

## 1. Summary
Enable users to open workspace doc items and edit content directly in a performant WYSIWYG Markdown editor.

This phase is human-only editing (no agentic edits, no collaboration).

## 2. Current State (Code Scan)
- Workspace docs are renderable items in `src/renderer/lib/workspace.ts`, but only tree metadata exists (`id`, `name`, `type`, parent/sort).
- Doc pages are static placeholder UI in `src/renderer/components/workspace-item-page.tsx` (`DocPage`).
- Workspace state persists to local storage via `outcome-ai:workspace-state-v1` in `src/renderer/App.tsx`.
- Workspace view routing already exists (`mainView.type === "workspace-item"`) in `src/renderer/lib/workspace-navigation.ts` and `src/renderer/App.tsx`.
- The top bar title already reflects selected doc name via `resolveUniversalHeader` in `src/renderer/lib/universal-header.ts`.
- Composer is disabled while viewing workspace content, which is fine for this phase.

## 3. Problem
Users can select docs in the tree, but cannot edit doc content. The current doc page is dummy text and does not persist user-written notes.

## 4. Goals
1. Make `doc` items editable in WYSIWYG mode.
2. Keep Markdown as the stored source format.
3. Persist edits locally and reliably.
4. Preserve current workspace navigation and UI behavior.
5. Keep typing and load performance responsive on normal note sizes.

## 5. Non-Goals (Phase 1)
- Agentic editing or AI-driven structured edits.
- Real-time collaboration or multi-user sync.
- Rich embeds/custom block types.
- Cloud sync and server-side doc storage.

## 6. User Stories
1. As a user, when I click a doc in the workspace tree, I can edit it immediately.
2. As a user, my edits persist after app restart.
3. As a user, new docs start with a usable empty template (title/placeholder body).
4. As a user, I can use basic rich text formatting without writing raw Markdown.

## 7. Product Requirements
### 7.1 Editing Experience
- Replace static `DocPage` content with a WYSIWYG Markdown editor.
- Support baseline formatting:
  - Paragraphs
  - H1/H2/H3 headings
  - Bold, italic, inline code
  - Ordered and unordered lists
  - Task list checkboxes
  - Blockquotes
  - Horizontal rule
- Show a placeholder for empty docs (for example: `Start writing...`).

### 7.2 Persistence
- Save doc content in renderer state and local storage.
- Autosave behavior:
  - In-memory state updates on edit.
  - Local storage writes debounced (250-500ms).
- On app load, hydrate all doc content from persisted workspace state.

### 7.3 Document Lifecycle
- Creating a new `doc` item creates an empty Markdown body entry.
- Deleting a `doc` removes its content from storage.
- Deleting folders cascades and removes descendant doc content.
- Renaming docs only changes title metadata; body remains untouched.

### 7.4 Compatibility
- Existing users with `workspace-state-v1` must migrate cleanly.
- If content is missing for an existing doc item, initialize with empty Markdown.

## 8. Technical Design
### 8.1 Library Choice
Use **Milkdown** for Markdown-first WYSIWYG in the active app.

Rationale:
- Markdown as source of truth aligns with future agentic roadmap.
- Good editing performance for note-sized documents.
- Extensible plugin model for later phases.

### 8.2 Data Model Changes
Update `WorkspaceState` in `src/renderer/lib/workspace.ts`:
- Add `docContentById: Record<string, string>`.

Behavior changes:
- `createDummyWorkspaceState()` seeds content for each initial `doc` id.
- `addWorkspaceItem(... type: "doc")` initializes empty content.
- `deleteWorkspaceItem()` removes entries for deleted `doc` descendants.
- Add helper `updateWorkspaceDocContent(state, docId, markdown)`.

### 8.3 State Normalization / Migration
Update `normalizeWorkspaceState(input)`:
- Read optional `docContentById` from persisted state.
- Validate it as string map.
- Backfill missing doc ids with `""`.
- Ignore content entries pointing to non-existent/non-doc items.

Keep same storage key (`outcome-ai:workspace-state-v1`) and treat migration as tolerant normalization.

### 8.4 UI Integration
Refactor `src/renderer/components/workspace-item-page.tsx`:
- Keep project page behavior unchanged.
- Replace current `DocPage` with new editor-backed component.

Add component (proposed):
- `src/renderer/components/workspace-doc-editor.tsx`
- Props: `item`, `markdown`, `onChange`

Update `App.tsx`:
- Pass selected doc content and `onChange` callback to `WorkspaceItemPage`.
- Wire callback to workspace state updater.

### 8.5 Styling
Update `src/renderer/app.css`:
- Add Milkdown editor theme overrides aligned with current dark UI.
- Ensure typography/spacing matches existing content width (`max-w-[704px]`) and panel styles.
- Keep scroll behavior consistent with existing workspace content area.

### 8.6 Testing
Extend `src/renderer/lib/__tests__/workspace.test.ts`:
- Seeds doc content map for dummy state.
- `addWorkspaceItem("doc")` creates content entry.
- `deleteWorkspaceItem` removes content entries for deleted docs.
- `normalizeWorkspaceState` migration/backfill behavior.

Add component-level tests (new):
- Editor receives initial markdown.
- Change callback updates state.
- Empty doc shows placeholder.

## 9. Performance Requirements
1. Typing should feel immediate for documents up to 10,000 characters.
2. No full re-render of the app shell on every keystroke.
3. Debounced persistence should not block typing.

## 10. Rollout Plan
### Milestone 1: Data + Migration
- Add `docContentById` model and normalization.
- Add/update workspace tests.

### Milestone 2: Editor UI
- Integrate Milkdown component into doc page.
- Wire change events into workspace state.

### Milestone 3: Polish + Validation
- Add CSS theme tuning.
- Validate persistence and restart behavior manually.
- Add component tests for core editor interactions.

## 11. Acceptance Criteria
1. Selecting any doc opens editable WYSIWYG content instead of placeholder text.
2. Formatting actions (bold/list/headings/task list) work and persist.
3. Edits survive app reload/restart via local storage.
4. New docs are editable immediately.
5. Deleting docs/folders removes corresponding stored content.
6. Existing workspace state loads without crashes and missing content is backfilled.

## 12. Risks and Mitigations
- Risk: Editor bundle size impacts startup.
  - Mitigation: lazy-load editor component for doc view only.
- Risk: Markdown round-trip edge cases.
  - Mitigation: constrain Phase 1 feature set and test canonical examples.
- Risk: Re-render churn from workspace state updates.
  - Mitigation: memoize editor wrapper and keep updates scoped to selected doc path.

## 13. Open Questions
1. Should Phase 1 include keyboard shortcuts UI hints (slash menu/toolbars), or rely on default shortcuts only?
2. Do we need per-doc `updatedAt` metadata now for future Recents correctness, or defer?
3. Should doc content remain localStorage-only in Phase 1, or mirror to `window.api.saveData` with chat data?
