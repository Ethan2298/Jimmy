import type { Editor } from "@milkdown/kit/core";
import type { Ctx } from "@milkdown/kit/ctx";
import type { EditorView } from "@milkdown/kit/prose/view";
import type { EditorState, PluginView, Selection } from "@milkdown/kit/prose/state";

import { CrepeFeature, useCrepeFeatures } from "@milkdown/crepe";
import { imageBlockSchema } from "@milkdown/kit/component/image-block";
import { commandsCtx, editorViewCtx } from "@milkdown/kit/core";
import { SlashProvider, slashFactory } from "@milkdown/kit/plugin/slash";
import {
  TextSelection,
} from "@milkdown/kit/prose/state";
import {
  addBlockTypeCommand,
  blockquoteSchema,
  bulletListSchema,
  codeBlockSchema,
  headingSchema,
  hrSchema,
  listItemSchema,
  orderedListSchema,
  selectTextNearPosCommand,
  setBlockTypeCommand,
  wrapInBlockTypeCommand,
} from "@milkdown/kit/preset/commonmark";
import { createTable } from "@milkdown/kit/preset/gfm";

export interface SlashQueryMatch {
  slashIndex: number;
  query: string;
  replaceFrom: number;
  replaceTo: number;
}

export type SlashCommandId =
  | "text"
  | "h1"
  | "h2"
  | "h3"
  | "h4"
  | "h5"
  | "h6"
  | "quote"
  | "divider"
  | "bullet-list"
  | "ordered-list"
  | "task-list"
  | "image"
  | "code"
  | "table"
  | "math";

export type InsertTarget = "block" | "list_item";

type SlashCommandGroupKey = "text" | "list" | "advanced";

export interface SlashCommandDefinition {
  id: SlashCommandId;
  label: string;
  group: SlashCommandGroupKey;
  keywords: readonly string[];
  requiresFeature?: CrepeFeature;
}

export interface SlashCommandGroup {
  key: SlashCommandGroupKey;
  label: string;
  commands: SlashCommandDefinition[];
}

interface ActiveSlashContext {
  match: SlashQueryMatch;
  deleteFrom: number;
  deleteTo: number;
  blockInsertPos: number;
  listItemInsertPos: number | null;
  listItemAttrs: Record<string, unknown> | null;
}

interface InsertResult {
  target: InsertTarget;
  cursorPos: number;
}

const GROUP_LABELS: Record<SlashCommandGroupKey, string> = {
  text: "Text",
  list: "List",
  advanced: "Advanced",
};

const COMMANDS: readonly SlashCommandDefinition[] = [
  { id: "text", label: "Text", group: "text", keywords: ["text", "paragraph", "p"] },
  { id: "h1", label: "Heading 1", group: "text", keywords: ["h1", "heading1", "heading"] },
  { id: "h2", label: "Heading 2", group: "text", keywords: ["h2", "heading2", "heading"] },
  { id: "h3", label: "Heading 3", group: "text", keywords: ["h3", "heading3", "heading"] },
  { id: "h4", label: "Heading 4", group: "text", keywords: ["h4", "heading4", "heading"] },
  { id: "h5", label: "Heading 5", group: "text", keywords: ["h5", "heading5", "heading"] },
  { id: "h6", label: "Heading 6", group: "text", keywords: ["h6", "heading6", "heading"] },
  { id: "quote", label: "Quote", group: "text", keywords: ["quote", "blockquote"] },
  { id: "divider", label: "Divider", group: "text", keywords: ["divider", "hr", "line"] },
  {
    id: "bullet-list",
    label: "Bullet List",
    group: "list",
    keywords: ["bullet", "list", "ul", "unordered"],
  },
  {
    id: "ordered-list",
    label: "Ordered List",
    group: "list",
    keywords: ["ordered", "list", "ol", "numbered"],
  },
  {
    id: "task-list",
    label: "Task List",
    group: "list",
    keywords: ["task", "todo", "checklist", "list"],
  },
  {
    id: "image",
    label: "Image",
    group: "advanced",
    keywords: ["image", "img", "media"],
    requiresFeature: CrepeFeature.ImageBlock,
  },
  { id: "code", label: "Code", group: "advanced", keywords: ["code", "snippet", "block"] },
  {
    id: "table",
    label: "Table",
    group: "advanced",
    keywords: ["table", "grid"],
    requiresFeature: CrepeFeature.Table,
  },
  {
    id: "math",
    label: "Math",
    group: "advanced",
    keywords: ["math", "latex", "equation"],
    requiresFeature: CrepeFeature.Latex,
  },
] as const;

const HEADING_LEVEL_BY_COMMAND: Record<Extract<SlashCommandId, "h1" | "h2" | "h3" | "h4" | "h5" | "h6">, number> = {
  h1: 1,
  h2: 2,
  h3: 3,
  h4: 4,
  h5: 5,
  h6: 6,
};

function isInsideTable(selection: Selection): boolean {
  const { $from } = selection;
  for (let depth = $from.depth; depth >= 0; depth -= 1) {
    const name = $from.node(depth)?.type?.name;
    if (name === "table_cell" || name === "table_header") return true;
  }
  return false;
}

function findAncestorDepth(selection: Selection, nodeName: string): number | null {
  const { $from } = selection;
  for (let depth = $from.depth; depth >= 0; depth -= 1) {
    if ($from.node(depth)?.type?.name === nodeName) {
      return depth;
    }
  }
  return null;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function findMidlineSlashQuery(textBeforeCursor: string): SlashQueryMatch | null {
  const slashIndex = textBeforeCursor.lastIndexOf("/");
  if (slashIndex < 0) return null;

  // Require slash token boundary at start of line or after whitespace.
  if (slashIndex > 0) {
    const prevChar = textBeforeCursor[slashIndex - 1];
    if (!/\s/.test(prevChar)) return null;
  }

  const query = textBeforeCursor.slice(slashIndex + 1);

  // Close the menu once the slash token is no longer the active token.
  if (/\s/.test(query)) return null;

  // Keep slash commands token-like to avoid URL/path false positives.
  if (!/^[A-Za-z0-9_-]*$/.test(query)) return null;

  return {
    slashIndex,
    query,
    replaceFrom: slashIndex,
    replaceTo: textBeforeCursor.length,
  };
}

export function isSupportedContext(selection: Selection): boolean {
  if (!(selection instanceof TextSelection)) return false;
  if (!selection.empty) return false;

  if (isInsideTable(selection)) return false;

  const parentName = selection.$from.parent.type.name;
  if (parentName === "code_block") return false;

  return parentName === "paragraph" || parentName === "heading";
}

function supportsFeature(
  command: SlashCommandDefinition,
  enabledFeatures: ReadonlySet<CrepeFeature>
): boolean {
  if (!command.requiresFeature) return true;
  return enabledFeatures.has(command.requiresFeature);
}

function filterCommandByQuery(command: SlashCommandDefinition, query: string): boolean {
  if (!query) return true;

  const normalized = query.toLowerCase();
  if (command.label.toLowerCase().includes(normalized)) return true;

  return command.keywords.some((keyword) => keyword.toLowerCase().includes(normalized));
}

export function buildSlashCommandGroups(
  query: string,
  enabledFeatures: ReadonlySet<CrepeFeature>
): SlashCommandGroup[] {
  const groups: SlashCommandGroup[] = [
    { key: "text", label: GROUP_LABELS.text, commands: [] },
    { key: "list", label: GROUP_LABELS.list, commands: [] },
    { key: "advanced", label: GROUP_LABELS.advanced, commands: [] },
  ];

  for (const command of COMMANDS) {
    if (!supportsFeature(command, enabledFeatures)) continue;
    if (!filterCommandByQuery(command, query)) continue;

    const group = groups.find((item) => item.key === command.group);
    if (!group) continue;
    group.commands.push(command);
  }

  return groups.filter((group) => group.commands.length > 0);
}

function getActiveSlashContext(selection: Selection): ActiveSlashContext | null {
  if (!isSupportedContext(selection)) return null;

  const { $from } = selection;
  const textBeforeCursor = $from.parent.textBetween(0, $from.parentOffset, undefined, "\uFFFC");
  const match = findMidlineSlashQuery(textBeforeCursor);
  if (!match) return null;

  const blockDepth = $from.depth;
  const blockPos = $from.before(blockDepth);
  const blockInsertPos = blockPos + $from.parent.nodeSize;

  const deleteFrom = $from.start() + match.replaceFrom;
  const deleteTo = $from.start() + match.replaceTo;

  const listItemDepth = findAncestorDepth(selection, "list_item");
  if (listItemDepth == null) {
    return {
      match,
      deleteFrom,
      deleteTo,
      blockInsertPos,
      listItemInsertPos: null,
      listItemAttrs: null,
    };
  }

  const listItemNode = $from.node(listItemDepth);
  const listItemPos = $from.before(listItemDepth);

  return {
    match,
    deleteFrom,
    deleteTo,
    blockInsertPos,
    listItemInsertPos: listItemPos + listItemNode.nodeSize,
    listItemAttrs: { ...listItemNode.attrs },
  };
}

export function insertTargetBelowAndSelect(
  view: EditorView,
  context: ActiveSlashContext
): InsertResult | null {
  const { state } = view;

  const paragraphType = state.schema.nodes.paragraph;
  if (!paragraphType) return null;

  let tr = state.tr.deleteRange(context.deleteFrom, context.deleteTo);

  if (context.listItemInsertPos != null) {
    const listItemType = state.schema.nodes.list_item;
    if (!listItemType) return null;

    const mappedInsertPos = tr.mapping.map(context.listItemInsertPos, -1);

    const attrs = { ...(context.listItemAttrs ?? {}) };
    if (Object.prototype.hasOwnProperty.call(attrs, "checked")) {
      attrs.checked = false;
    }

    const paragraph = paragraphType.createAndFill();
    if (!paragraph) return null;

    const listItem = listItemType.createAndFill(attrs, [paragraph]);
    if (!listItem) return null;

    tr = tr.insert(mappedInsertPos, listItem);

    const cursorPos = clamp(mappedInsertPos + 2, 0, tr.doc.content.size);
    tr = tr.setSelection(TextSelection.near(tr.doc.resolve(cursorPos)));

    view.dispatch(tr.scrollIntoView());
    return {
      target: "list_item",
      cursorPos,
    };
  }

  const mappedInsertPos = tr.mapping.map(context.blockInsertPos, -1);
  const paragraph = paragraphType.createAndFill();
  if (!paragraph) return null;

  tr = tr.insert(mappedInsertPos, paragraph);

  const cursorPos = clamp(mappedInsertPos + 1, 0, tr.doc.content.size);
  tr = tr.setSelection(TextSelection.near(tr.doc.resolve(cursorPos)));

  view.dispatch(tr.scrollIntoView());
  return {
    target: "block",
    cursorPos,
  };
}

export function runCommandOnInsertedTarget(ctx: Ctx, commandId: SlashCommandId): boolean {
  const commands = ctx.get(commandsCtx);

  switch (commandId) {
    case "text": {
      const paragraph = ctx.get(editorViewCtx).state.schema.nodes.paragraph;
      if (!paragraph) return false;
      return commands.call(setBlockTypeCommand.key, {
        nodeType: paragraph,
      });
    }
    case "h1":
    case "h2":
    case "h3":
    case "h4":
    case "h5":
    case "h6": {
      const heading = headingSchema.type(ctx);
      return commands.call(setBlockTypeCommand.key, {
        nodeType: heading,
        attrs: {
          level: HEADING_LEVEL_BY_COMMAND[commandId],
        },
      });
    }
    case "quote": {
      return commands.call(wrapInBlockTypeCommand.key, {
        nodeType: blockquoteSchema.type(ctx),
      });
    }
    case "divider": {
      return commands.call(addBlockTypeCommand.key, {
        nodeType: hrSchema.type(ctx),
      });
    }
    case "bullet-list": {
      return commands.call(wrapInBlockTypeCommand.key, {
        nodeType: bulletListSchema.type(ctx),
      });
    }
    case "ordered-list": {
      return commands.call(wrapInBlockTypeCommand.key, {
        nodeType: orderedListSchema.type(ctx),
      });
    }
    case "task-list": {
      return commands.call(wrapInBlockTypeCommand.key, {
        nodeType: listItemSchema.type(ctx),
        attrs: { checked: false },
      });
    }
    case "image": {
      return commands.call(addBlockTypeCommand.key, {
        nodeType: imageBlockSchema.type(ctx),
      });
    }
    case "code": {
      return commands.call(setBlockTypeCommand.key, {
        nodeType: codeBlockSchema.type(ctx),
      });
    }
    case "table": {
      const view = ctx.get(editorViewCtx);
      const from = view.state.selection.from;

      const inserted = commands.call(addBlockTypeCommand.key, {
        nodeType: createTable(ctx, 3, 3),
      });
      if (!inserted) return false;

      return commands.call(selectTextNearPosCommand.key, { pos: from });
    }
    case "math": {
      return commands.call(addBlockTypeCommand.key, {
        nodeType: codeBlockSchema.type(ctx),
        attrs: { language: "LaTex" },
      });
    }
    default:
      return false;
  }
}

function createItemIcon(): SVGElement {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 14 14");
  svg.setAttribute("aria-hidden", "true");

  const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  circle.setAttribute("cx", "7");
  circle.setAttribute("cy", "7");
  circle.setAttribute("r", "3");
  circle.setAttribute("fill", "currentColor");

  svg.append(circle);
  return svg;
}

const MAIN_OVERLAY_ROOT_SELECTOR = '[data-main-overlay-root="true"]';

function isElementNode(value: unknown): value is HTMLElement {
  return !!value && typeof value === "object" && (value as { nodeType?: number }).nodeType === 1;
}

export function resolveSlashMenuRoot(viewDom: HTMLElement): HTMLElement {
  const overlayRoot = viewDom.closest(MAIN_OVERLAY_ROOT_SELECTOR);
  if (isElementNode(overlayRoot)) return overlayRoot;

  if (viewDom.parentElement) return viewDom.parentElement;

  const ownerDocumentBody = viewDom.ownerDocument?.body;
  if (ownerDocumentBody) return ownerDocumentBody;

  if (typeof document !== "undefined" && document.body) return document.body;

  return viewDom;
}

export const midlineSlashMenu = slashFactory("MIDLINE_MENU");

class MidlineSlashMenuView implements PluginView {
  readonly #ctx: Ctx;
  readonly #content: HTMLElement;
  readonly #slashProvider: SlashProvider;
  readonly #enabledFeatures: Set<CrepeFeature>;

  #view: EditorView;
  #groups: SlashCommandGroup[] = [];
  #flatCommands: SlashCommandDefinition[] = [];
  #hoverIndex = 0;
  #shown = false;

  constructor(ctx: Ctx, view: EditorView) {
    this.#ctx = ctx;
    this.#view = view;
    this.#enabledFeatures = new Set(useCrepeFeatures(ctx).get());

    const content = document.createElement("div");
    content.classList.add("milkdown-slash-menu");
    content.classList.add("workspace-midline-slash-menu");
    content.dataset.show = "false";
    this.#content = content;

    this.#slashProvider = new SlashProvider({
      content,
      debounce: 20,
      shouldShow: (_view) => this.#shouldShow(_view),
      offset: 10,
      root: resolveSlashMenuRoot(view.dom),
    });

    this.#slashProvider.onShow = () => {
      this.#shown = true;
      window.addEventListener("keydown", this.#onKeyDown, { capture: true });
      this.#render();
    };

    this.#slashProvider.onHide = () => {
      this.#shown = false;
      window.removeEventListener("keydown", this.#onKeyDown, { capture: true });
    };

    this.update(view);
  }

  #shouldShow = (view: EditorView): boolean => {
    if (!view.editable) return false;

    const isMenuFocused =
      typeof document !== "undefined" && this.#content.contains(document.activeElement);
    if (!view.hasFocus() && !isMenuFocused) return false;

    const active = getActiveSlashContext(view.state.selection);
    if (!active) return false;

    const groups = buildSlashCommandGroups(active.match.query, this.#enabledFeatures);
    const flatCommands = groups.flatMap((group) => group.commands);

    if (flatCommands.length === 0) return false;

    this.#groups = groups;
    this.#flatCommands = flatCommands;
    if (this.#hoverIndex >= flatCommands.length) {
      this.#hoverIndex = 0;
    }

    return true;
  };

  #render = () => {
    this.#content.replaceChildren();

    const menuGroups = document.createElement("div");
    menuGroups.classList.add("menu-groups");

    let absoluteIndex = 0;

    for (const group of this.#groups) {
      const groupEl = document.createElement("div");
      groupEl.classList.add("menu-group");

      const title = document.createElement("h6");
      title.textContent = group.label;
      groupEl.append(title);

      const list = document.createElement("ul");

      for (const command of group.commands) {
        const index = absoluteIndex;
        const li = document.createElement("li");
        li.dataset.index = String(index);
        if (index === this.#hoverIndex) {
          li.classList.add("hover");
        }

        li.addEventListener("pointerenter", () => {
          this.#hoverIndex = index;
          this.#render();
        });

        li.addEventListener("pointerdown", (event) => {
          event.preventDefault();
          li.classList.add("active");
        });

        li.addEventListener("pointerup", (event) => {
          event.preventDefault();
          li.classList.remove("active");
          this.#executeByIndex(index);
        });

        li.append(createItemIcon());

        const label = document.createElement("span");
        label.textContent = command.label;
        li.append(label);

        list.append(li);
        absoluteIndex += 1;
      }

      groupEl.append(list);
      menuGroups.append(groupEl);
    }

    this.#content.append(menuGroups);
  };

  #executeByIndex = (index: number) => {
    const command = this.#flatCommands[index];
    if (!command) {
      this.#slashProvider.hide();
      return;
    }

    const active = getActiveSlashContext(this.#view.state.selection);
    if (!active) {
      this.#slashProvider.hide();
      return;
    }

    const inserted = insertTargetBelowAndSelect(this.#view, active);
    if (!inserted) {
      this.#slashProvider.hide();
      return;
    }

    runCommandOnInsertedTarget(this.#ctx, command.id);
    this.#slashProvider.hide();
  };

  #onKeyDown = (event: KeyboardEvent) => {
    if (!this.#shown || this.#flatCommands.length === 0) return;

    if (event.key === "Escape") {
      event.preventDefault();
      this.#slashProvider.hide();
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      this.#hoverIndex = Math.min(this.#hoverIndex + 1, this.#flatCommands.length - 1);
      this.#render();
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      this.#hoverIndex = Math.max(this.#hoverIndex - 1, 0);
      this.#render();
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      this.#executeByIndex(this.#hoverIndex);
    }
  };

  update = (view: EditorView, prevState?: EditorState) => {
    this.#view = view;
    this.#slashProvider.update(view, prevState);
  };

  destroy = () => {
    window.removeEventListener("keydown", this.#onKeyDown, { capture: true });
    this.#slashProvider.destroy();
    this.#content.remove();
  };
}

export function configureMidlineSlash(ctx: Ctx): void {
  ctx.set(midlineSlashMenu.key, {
    view: (view) => new MidlineSlashMenuView(ctx, view),
  });
}

export function midlineSlashFeature(editor: Editor): void {
  editor.config(configureMidlineSlash).use(midlineSlashMenu);
}
