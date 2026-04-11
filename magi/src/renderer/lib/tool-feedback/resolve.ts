import { buildDebugPayload, isDenied } from "./helpers";
import { fallbackToolFeedbackModule } from "./fallback";
import { toolFeedbackModules } from "./modules";
import type { ToolFeedbackContext, ToolFeedbackMessage } from "./types";

export function resolveToolFeedback(ctx: ToolFeedbackContext): ToolFeedbackMessage {
  if (ctx.approval || ctx.part.state === "approval-requested") {
    return {
      tone: "approval",
      line: "Awaiting approval",
      actionKind: "fallback",
      debugPayload: buildDebugPayload(ctx),
    };
  }

  if (isDenied(ctx)) {
    return {
      tone: "failed",
      line: "Action denied",
      actionKind: "fallback",
      debugPayload: buildDebugPayload(ctx),
    };
  }

  const module =
    toolFeedbackModules.find((candidate) => candidate.matches(ctx.toolName)) ??
    fallbackToolFeedbackModule;
  const rendered = module.render(ctx);
  return {
    ...rendered,
    debugPayload: rendered.debugPayload ?? buildDebugPayload(ctx),
  };
}
