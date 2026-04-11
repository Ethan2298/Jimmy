import type { ToolMessagePart } from "../ai";

export type ToolFeedbackTone = "running" | "done" | "failed" | "approval";

export type ToolActionKind =
  | "read"
  | "search"
  | "create"
  | "update"
  | "complete"
  | "delete"
  | "manage"
  | "fallback";

export type ToolFeedbackApproval = {
  approvalId: string;
  destructive: boolean;
  reason: string;
  resolving?: boolean;
};

export type ToolFeedbackContext = {
  part: ToolMessagePart;
  toolName: string;
  approval?: ToolFeedbackApproval;
  durationMs?: number;
};

export type ToolFeedbackMessage = {
  tone: ToolFeedbackTone;
  line: string;
  detail?: string;
  debugPayload?: unknown;
  actionKind?: ToolActionKind;
};

export type ToolFeedbackModule = {
  matches: (toolName: string) => boolean;
  render: (ctx: ToolFeedbackContext) => ToolFeedbackMessage;
};
