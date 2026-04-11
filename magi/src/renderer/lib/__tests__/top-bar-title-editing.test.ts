import { describe, expect, it, vi } from "vitest";
import {
  isTopBarTitleEditable,
  restoreTopBarTitleDraft,
  saveTopBarTitleDraft,
} from "../top-bar-title-editing";

describe("top bar title editing helpers", () => {
  it("only enables editing for docs when flag and callback are present", () => {
    const onRename = vi.fn();

    expect(
      isTopBarTitleEditable({
        contentType: "doc",
        canEditTitle: true,
        onRenameTitle: onRename,
      })
    ).toBe(true);

    expect(
      isTopBarTitleEditable({
        contentType: "project",
        canEditTitle: true,
        onRenameTitle: onRename,
      })
    ).toBe(false);

    expect(
      isTopBarTitleEditable({
        contentType: "doc",
        canEditTitle: false,
        onRenameTitle: onRename,
      })
    ).toBe(false);

    expect(
      isTopBarTitleEditable({
        contentType: "doc",
        canEditTitle: true,
        onRenameTitle: undefined,
      })
    ).toBe(false);
  });

  it("saves the draft exactly as entered", () => {
    const onRename = vi.fn();
    const saved = saveTopBarTitleDraft(onRename, "   ");

    expect(saved).toBe(true);
    expect(onRename).toHaveBeenCalledWith("   ");
  });

  it("does nothing when save callback is missing", () => {
    expect(saveTopBarTitleDraft(undefined, "Roadmap")).toBe(false);
  });

  it("restores the current title when cancelling", () => {
    expect(restoreTopBarTitleDraft("New Title")).toBe("New Title");
    expect(restoreTopBarTitleDraft("")).toBe("");
  });
});
