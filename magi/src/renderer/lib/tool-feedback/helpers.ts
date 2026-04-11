import type { ToolFeedbackContext, ToolFeedbackTone } from "./types";

type UnknownRecord = Record<string, unknown>;

export function asRecord(value: unknown): UnknownRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as UnknownRecord;
}

export function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

export function asNumber(value: unknown): number | undefined {
  return typeof value === "number" ? value : undefined;
}

export function deriveTone(ctx: ToolFeedbackContext): ToolFeedbackTone {
  switch (ctx.part.state) {
    case "output-available":
      return "done";
    case "output-error":
    case "output-denied":
      return "failed";
    default:
      return "running";
  }
}

export function isDenied(ctx: ToolFeedbackContext): boolean {
  return ctx.part.state === "output-denied";
}

export function getInput(ctx: ToolFeedbackContext): UnknownRecord {
  return asRecord(ctx.part.input) ?? {};
}

export function getOutput(ctx: ToolFeedbackContext): UnknownRecord {
  if (ctx.part.state !== "output-available") return {};
  return asRecord(ctx.part.output) ?? {};
}

export function quoted(value: string): string {
  return `"${value}"`;
}

export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function taskTitleFromResult(result: UnknownRecord): string | undefined {
  const created = asRecord(result.created);
  if (created) {
    const title = asString(created.title);
    if (title) return title;
  }

  const updated = asRecord(result.updated);
  if (updated) {
    const title = asString(updated.title);
    if (title) return title;
  }

  const title = asString(result.title);
  if (title) return title;
  return undefined;
}

export function buildDebugPayload(ctx: ToolFeedbackContext): UnknownRecord {
  const payload: UnknownRecord = {
    tool: ctx.toolName,
    state: ctx.part.state,
    input: ctx.part.input,
  };
  if (ctx.part.state === "output-available") payload.output = ctx.part.output;
  if (ctx.part.state === "output-error") payload.error = ctx.part.errorText;
  if (ctx.part.state === "output-denied") payload.denied = true;
  return payload;
}
