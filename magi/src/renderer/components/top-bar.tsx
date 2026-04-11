import {
  FileText,
  Library,
  ListChecks,
  MessageCircle,
  Minus,
  Square,
  X,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import type { UniversalHeaderContentType } from "@/lib/universal-header";
import {
  isTopBarTitleEditable,
  restoreTopBarTitleDraft,
  saveTopBarTitleDraft,
} from "@/lib/top-bar-title-editing";

interface TopBarProps {
  contentType: UniversalHeaderContentType;
  title: string;
  canEditTitle?: boolean;
  onRenameTitle?: (nextName: string) => void;
  showWindowControls: boolean;
}

export function TopBar({
  contentType,
  title,
  canEditTitle,
  onRenameTitle,
  showWindowControls,
}: TopBarProps) {
  const ContentIcon = contentType === "library" ? Library : contentType === "project" ? ListChecks : contentType === "doc" ? FileText : MessageCircle;
  const titleInputRef = useRef<HTMLInputElement>(null);
  const shouldSkipBlurCommitRef = useRef(false);
  const editRenameHandlerRef = useRef<((nextName: string) => void) | undefined>(undefined);
  const previousTitleRef = useRef(title);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [draftTitle, setDraftTitle] = useState(title);
  const titleEditable = isTopBarTitleEditable({
    contentType,
    canEditTitle,
    onRenameTitle,
  });

  const startTitleEdit = useCallback(() => {
    if (!titleEditable || isEditingTitle) return;
    shouldSkipBlurCommitRef.current = false;
    editRenameHandlerRef.current = onRenameTitle;
    setDraftTitle(title);
    setIsEditingTitle(true);
  }, [isEditingTitle, onRenameTitle, title, titleEditable]);

  const commitTitleEdit = useCallback(() => {
    if (!isEditingTitle) return;
    shouldSkipBlurCommitRef.current = true;
    saveTopBarTitleDraft(editRenameHandlerRef.current, draftTitle);
    editRenameHandlerRef.current = undefined;
    setIsEditingTitle(false);
  }, [draftTitle, isEditingTitle]);

  const cancelTitleEdit = useCallback(() => {
    shouldSkipBlurCommitRef.current = true;
    editRenameHandlerRef.current = undefined;
    setDraftTitle(restoreTopBarTitleDraft(title));
    setIsEditingTitle(false);
  }, [title]);

  const handleTitleKeyDown = useCallback((event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      commitTitleEdit();
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      cancelTitleEdit();
    }
  }, [cancelTitleEdit, commitTitleEdit]);

  useEffect(() => {
    if (!titleEditable && isEditingTitle) {
      shouldSkipBlurCommitRef.current = true;
      editRenameHandlerRef.current = undefined;
      setIsEditingTitle(false);
    }
  }, [isEditingTitle, titleEditable]);

  useEffect(() => {
    if (!isEditingTitle) {
      shouldSkipBlurCommitRef.current = false;
      editRenameHandlerRef.current = undefined;
    }
  }, [isEditingTitle]);

  useEffect(() => {
    if (isEditingTitle) {
      window.requestAnimationFrame(() => {
        titleInputRef.current?.focus();
        titleInputRef.current?.select();
      });
    }
  }, [isEditingTitle]);

  useEffect(() => {
    const previousTitle = previousTitleRef.current;
    previousTitleRef.current = title;
    if (previousTitle === title) return;

    setDraftTitle(title);
    if (!isEditingTitle) return;
    shouldSkipBlurCommitRef.current = true;
    editRenameHandlerRef.current = undefined;
    setIsEditingTitle(false);
  }, [isEditingTitle, title]);

  return (
    <header
      className="h-[46px] pr-[26px] pl-[12px] flex items-center justify-between"
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <ContentIcon size={14} className="shrink-0 text-white/80" />
          {isEditingTitle ? (
            <input
              ref={titleInputRef}
              value={draftTitle}
              onChange={(event) => setDraftTitle(event.target.value)}
              onBlur={() => {
                if (shouldSkipBlurCommitRef.current) return;
                commitTitleEdit();
              }}
              onKeyDown={handleTitleKeyDown}
              className="magi-no-drag h-7 min-w-[56px] max-w-full rounded-[8px] border border-white/[0.16] bg-white/[0.06] px-2 text-[16px] font-normal tracking-[-0.01em] text-[#F1F5F7] outline-none"
              aria-label="Rename doc title"
            />
          ) : titleEditable ? (
            <button
              type="button"
              onClick={startTitleEdit}
              className="magi-no-drag h-7 min-w-[56px] max-w-full rounded-[8px] px-1 text-left hover:bg-white/[0.06]"
              title="Rename doc title"
              aria-label="Rename doc title"
            >
              <span className="block leading-[28px] text-[16px] font-normal tracking-[-0.01em] truncate text-[#F1F5F7]">
                {title}
              </span>
            </button>
          ) : (
            <h1 className="leading-[28px] text-[16px] font-normal tracking-[-0.01em] truncate text-[#F1F5F7]">
              {title}
            </h1>
          )}
        </div>
      </div>
      {showWindowControls && (
        <div className="magi-no-drag ml-2 flex items-center gap-1">
          <button
            onClick={() => window.api.minimize()}
            className="w-7 h-7 rounded-[8px] text-white/45 hover:text-white hover:bg-white/[0.08] grid place-items-center"
            title="Minimize"
          >
            <Minus size={12} />
          </button>
          <button
            onClick={() => window.api.maximize()}
            className="w-7 h-7 rounded-[8px] text-white/45 hover:text-white hover:bg-white/[0.08] grid place-items-center"
            title="Maximize"
          >
            <Square size={10} />
          </button>
          <button
            onClick={() => window.api.close()}
            className="w-7 h-7 rounded-[8px] text-white/45 hover:text-white hover:bg-red-500/80 grid place-items-center"
            title="Close"
          >
            <X size={12} />
          </button>
        </div>
      )}
    </header>
  );
}
