import type { Editor } from "@milkdown/kit/core";
import type { Ctx } from "@milkdown/kit/ctx";
import type { EditorState, PluginView } from "@milkdown/kit/prose/state";
import type { EditorView } from "@milkdown/kit/prose/view";

import { commandsCtx } from "@milkdown/kit/core";
import { tooltipFactory, TooltipProvider } from "@milkdown/kit/plugin/tooltip";
import {
  toggleEmphasisCommand,
  toggleStrongCommand,
  wrapInBlockquoteCommand,
} from "@milkdown/kit/preset/commonmark";
import { toggleStrikethroughCommand } from "@milkdown/kit/preset/gfm";
import { resolveSlashMenuRoot } from "./midline-slash";

export type SelectionTooltipActionId =
  | "bold"
  | "italic"
  | "strike"
  | "quote";

export type SelectionTooltipCommandName =
  | "toggleStrong"
  | "toggleEmphasis"
  | "toggleStrikethrough"
  | "wrapInBlockquote";

export interface SelectionTooltipCommandPlan {
  name: SelectionTooltipCommandName;
}

function assertUnreachable(value: never): never {
  throw new Error(`Unexpected selection tooltip action: ${String(value)}`);
}

interface SelectionTooltipViewLike {
  editable: boolean;
  hasFocus: () => boolean;
  state: {
    selection: {
      empty: boolean;
    };
  };
}

const ACTIONS: readonly SelectionTooltipActionId[] = [
  "bold",
  "italic",
  "strike",
  "quote",
];

const ACTION_ARIA_LABEL: Record<SelectionTooltipActionId, string> = {
  bold: "Bold",
  italic: "Italic",
  strike: "Strikethrough",
  quote: "Blockquote",
};

const ACTION_ICON_MARKUP: Record<SelectionTooltipActionId, string> = {
  bold: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 12h9a4 4 0 0 1 0 8H7a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h7a4 4 0 0 1 0 8"></path></svg>',
  italic:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><line x1="19" x2="10" y1="4" y2="4"></line><line x1="14" x2="5" y1="20" y2="20"></line><line x1="15" x2="9" y1="4" y2="20"></line></svg>',
  strike:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16 4H9a3 3 0 0 0-2.83 4"></path><path d="M14 12a4 4 0 0 1 0 8H6"></path><line x1="4" x2="20" y1="12" y2="12"></line></svg>',
  quote:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M17 6H3"></path><path d="M21 12H8"></path><path d="M21 18H8"></path><path d="M3 12v6"></path></svg>',
};

function hasAncestorWithTypeName(view: EditorView, typeName: string): boolean {
  const { $from } = view.state.selection;
  for (let depth = $from.depth; depth > 0; depth -= 1) {
    if ($from.node(depth).type.name === typeName) return true;
  }
  return false;
}

export function shouldShowSelectionTooltip(view: SelectionTooltipViewLike): boolean {
  if (!view.editable) return false;
  if (!view.hasFocus()) return false;
  return !view.state.selection.empty;
}

export function getCommandPlanForAction(action: SelectionTooltipActionId): SelectionTooltipCommandPlan {
  switch (action) {
    case "bold":
      return { name: "toggleStrong" };
    case "italic":
      return { name: "toggleEmphasis" };
    case "strike":
      return { name: "toggleStrikethrough" };
    case "quote":
      return { name: "wrapInBlockquote" };
  }

  return assertUnreachable(action);
}

export const selectionIconTooltip = tooltipFactory("WORKSPACE_SELECTION");

class SelectionIconTooltipView implements PluginView {
  readonly #ctx: Ctx;
  readonly #content: HTMLElement;
  readonly #provider: TooltipProvider;
  readonly #buttons = new Map<SelectionTooltipActionId, HTMLButtonElement>();

  #view: EditorView;

  constructor(ctx: Ctx, view: EditorView) {
    this.#ctx = ctx;
    this.#view = view;

    const content = document.createElement("div");
    content.classList.add("workspace-selection-tooltip");
    this.#content = content;

    for (const action of ACTIONS) {
      const button = this.#createButton(action);
      this.#buttons.set(action, button);
      content.append(button);
    }

    this.#provider = new TooltipProvider({
      content,
      debounce: 20,
      root: resolveSlashMenuRoot(view.dom),
      shouldShow: (nextView) => shouldShowSelectionTooltip(nextView),
    });

    this.update(view);
  }

  #createButton = (action: SelectionTooltipActionId): HTMLButtonElement => {
    const button = document.createElement("button");
    button.type = "button";
    button.classList.add("workspace-selection-tooltip__button");
    button.dataset.action = action;
    button.setAttribute("aria-label", ACTION_ARIA_LABEL[action]);
    button.innerHTML = ACTION_ICON_MARKUP[action];

    button.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      this.#runAction(action);
    });

    return button;
  };

  #runAction = (action: SelectionTooltipActionId) => {
    const commands = this.#ctx.get(commandsCtx);
    const plan = getCommandPlanForAction(action);

    switch (plan.name) {
      case "toggleStrong":
        commands.call(toggleStrongCommand.key);
        return;
      case "toggleEmphasis":
        commands.call(toggleEmphasisCommand.key);
        return;
      case "toggleStrikethrough":
        commands.call(toggleStrikethroughCommand.key);
        return;
      case "wrapInBlockquote":
        commands.call(wrapInBlockquoteCommand.key);
        return;
    }
  };

  #syncActionStates = () => {
    const { selection, doc } = this.#view.state;
    if (selection.empty) {
      for (const button of this.#buttons.values()) {
        button.dataset.active = "false";
      }
      return;
    }

    const { from, to } = selection;
    const { marks } = this.#view.state.schema;
    const strongType = marks.strong;
    const emphasisType = marks.em;
    const strikeType = marks.strike_through;

    const isBold = !!strongType && doc.rangeHasMark(from, to, strongType);
    const isItalic = !!emphasisType && doc.rangeHasMark(from, to, emphasisType);
    const isStrike = !!strikeType && doc.rangeHasMark(from, to, strikeType);
    const isQuote = hasAncestorWithTypeName(this.#view, "blockquote");

    const stateMap: Record<SelectionTooltipActionId, boolean> = {
      bold: isBold,
      italic: isItalic,
      strike: isStrike,
      quote: isQuote,
    };

    for (const [action, button] of this.#buttons.entries()) {
      button.dataset.active = stateMap[action] ? "true" : "false";
    }
  };

  update = (view: EditorView, prevState?: EditorState) => {
    this.#view = view;
    this.#provider.update(view, prevState);
    this.#syncActionStates();
  };

  destroy = () => {
    this.#provider.destroy();
    this.#content.remove();
  };
}

export function configureSelectionIconTooltip(ctx: Ctx): void {
  ctx.set(selectionIconTooltip.key, {
    view: (view) => new SelectionIconTooltipView(ctx, view),
  });
}

export function selectionIconTooltipFeature(editor: Editor): void {
  editor.config(configureSelectionIconTooltip).use(selectionIconTooltip);
}
