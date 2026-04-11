import type { UniversalHeaderContentType } from "./universal-header";

export interface TopBarTitleEditConfig {
  contentType: UniversalHeaderContentType;
  canEditTitle?: boolean;
  onRenameTitle?: ((nextName: string) => void) | undefined;
}

export function isTopBarTitleEditable({
  contentType,
  canEditTitle,
  onRenameTitle,
}: TopBarTitleEditConfig): boolean {
  return (
    contentType === "doc" &&
    canEditTitle === true &&
    typeof onRenameTitle === "function"
  );
}

export function saveTopBarTitleDraft(
  onRenameTitle: ((nextName: string) => void) | undefined,
  nextName: string
): boolean {
  if (typeof onRenameTitle !== "function") {
    return false;
  }

  onRenameTitle(nextName);
  return true;
}

export function restoreTopBarTitleDraft(title: string): string {
  return title;
}
