import { useEffect, useRef } from "react";
import { Crepe, CrepeFeature } from "@milkdown/crepe";
import { $shortcut } from "@milkdown/kit/utils";
import { midlineSlashFeature } from "../lib/midline-slash";
import { selectionIconTooltipFeature } from "../lib/selection-icon-tooltip";

const convertEmptyStyledBlockToParagraphOnBackspace = $shortcut(() => ({
  Backspace: (state, dispatch) => {
    const { selection, schema } = state;
    if (!selection.empty) return false;

    const { $from } = selection;
    const parent = $from.parent;
    const isCursorAtStart = $from.parentOffset === 0;
    const isBlockEmpty = parent.content.size === 0;
    const isRevertableBlock =
      parent.type.name === "heading" ||
      parent.type.name === "blockquote" ||
      parent.type.name === "code_block";
    const paragraph = schema.nodes.paragraph;

    if (!isCursorAtStart || !isBlockEmpty || !isRevertableBlock || !paragraph) {
      return false;
    }

    if (!dispatch) return true;

    const tr = state.tr.setBlockType($from.before(), $from.after(), paragraph);
    dispatch(tr.scrollIntoView());
    return true;
  },
}));

interface WorkspaceDocEditorProps {
  value: string;
  onChange: (nextMarkdown: string) => void;
  placeholder?: string;
  docId: string;
}

export function WorkspaceDocEditor({
  docId,
  value,
  onChange,
  placeholder = "Start writing...",
}: WorkspaceDocEditorProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const editorRef = useRef<Crepe | null>(null);
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    let disposed = false;

    const editor = new Crepe({
      root,
      defaultValue: value,
      features: {
        [CrepeFeature.Toolbar]: false,
        [CrepeFeature.BlockEdit]: false,
        [CrepeFeature.LinkTooltip]: false,
        [CrepeFeature.CodeMirror]: false,
        [CrepeFeature.ImageBlock]: false,
        [CrepeFeature.Table]: false,
        [CrepeFeature.Latex]: false,
      },
      featureConfigs: {
        [CrepeFeature.Cursor]: {
          virtual: false,
        },
        [CrepeFeature.Placeholder]: {
          text: placeholder,
          mode: "doc",
        },
      },
    });
    editor.addFeature((milkdown) => {
      milkdown.use(convertEmptyStyledBlockToParagraphOnBackspace);
    });
    editor.addFeature(midlineSlashFeature);
    editor.addFeature(selectionIconTooltipFeature);

    editorRef.current = editor;
    editor.on((listener) => {
      listener.markdownUpdated((_ctx, markdown) => {
        if (disposed) return;
        onChangeRef.current(markdown);
      });
    });

    void editor.create();

    return () => {
      disposed = true;
      editorRef.current = null;
      void editor.destroy();
    };
  }, [docId, placeholder]);

  return <div ref={rootRef} className="workspace-doc-editor" />;
}
