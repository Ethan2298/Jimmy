import { deriveTone } from "./helpers";
import type { ToolFeedbackContext, ToolFeedbackModule } from "./types";

function fallbackLine(ctx: ToolFeedbackContext): string {
  if (ctx.part.state === "output-denied") return "Action denied";

  const tone = deriveTone(ctx);
  if (tone === "running") return "Working…";
  if (tone === "done") return "Completed";
  return "Failed";
}

export const fallbackToolFeedbackModule: ToolFeedbackModule = {
  matches: () => true,
  render: (ctx) => ({
    tone: deriveTone(ctx),
    line: fallbackLine(ctx),
    actionKind: "fallback",
  }),
};
