import { describe, expect, it } from "vitest";

import {
  getCommandPlanForAction,
  shouldShowSelectionTooltip,
} from "../selection-icon-tooltip";

describe("shouldShowSelectionTooltip", () => {
  it("returns true only for focused editable views with non-empty selection", () => {
    expect(
      shouldShowSelectionTooltip({
        editable: true,
        hasFocus: () => true,
        state: { selection: { empty: false } },
      })
    ).toBe(true);

    expect(
      shouldShowSelectionTooltip({
        editable: false,
        hasFocus: () => true,
        state: { selection: { empty: false } },
      })
    ).toBe(false);

    expect(
      shouldShowSelectionTooltip({
        editable: true,
        hasFocus: () => false,
        state: { selection: { empty: false } },
      })
    ).toBe(false);

    expect(
      shouldShowSelectionTooltip({
        editable: true,
        hasFocus: () => true,
        state: { selection: { empty: true } },
      })
    ).toBe(false);
  });
});

describe("getCommandPlanForAction", () => {
  it("maps action ids to expected command plans", () => {
    expect(getCommandPlanForAction("bold")).toEqual({ name: "toggleStrong" });
    expect(getCommandPlanForAction("italic")).toEqual({ name: "toggleEmphasis" });
    expect(getCommandPlanForAction("strike")).toEqual({ name: "toggleStrikethrough" });
    expect(getCommandPlanForAction("quote")).toEqual({ name: "wrapInBlockquote" });
  });
});
