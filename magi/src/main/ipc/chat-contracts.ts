import { uiMessageChunkSchema, type UIMessageChunk } from "ai";
import { z } from "zod";

const approvalRequestedSchema = z.object({
  type: z.literal("tool-approval-requested"),
  approvalId: z.string(),
  toolCallId: z.string(),
  toolName: z.string(),
  args: z.unknown(),
  destructive: z.boolean(),
  reason: z.string(),
});

const approvalResolvedSchema = z.object({
  type: z.literal("tool-approval-resolved"),
  approvalId: z.string(),
  toolCallId: z.string(),
  approved: z.boolean(),
});

export const approvalEventPayloadSchema = z.discriminatedUnion("type", [
  approvalRequestedSchema,
  approvalResolvedSchema,
]);

const statusEventSchema = z.object({
  type: z.literal("status-update"),
  phase: z.enum(["waiting-approval"]),
  label: z.string().min(1),
  toolName: z.string().optional(),
  toolCallId: z.string().optional(),
});

export interface UsageEventPayload {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
}

export type StreamChunkPayload = UIMessageChunk;
export type ApprovalEventPayload = z.infer<typeof approvalEventPayloadSchema>;
export type StatusEventPayload = z.infer<typeof statusEventSchema>;

function zodIssues(error: z.ZodError): string {
  return error.issues
    .map((issue) => `${issue.path.join(".") || "root"}: ${issue.message}`)
    .join("; ");
}

export async function parseStreamChunkPayload(payload: unknown): Promise<StreamChunkPayload> {
  const schema = uiMessageChunkSchema();
  if (!schema || typeof schema.validate !== "function") {
    throw new Error("Invalid stream chunk schema configuration.");
  }
  const parsed = await schema.validate(payload);
  if (parsed.success) return parsed.value;
  if (parsed.error instanceof z.ZodError) {
    throw new Error(`Invalid stream chunk payload: ${zodIssues(parsed.error)}`);
  }
  throw new Error(`Invalid stream chunk payload: ${String(parsed.error)}`);
}

export function parseApprovalEventPayload(payload: unknown): ApprovalEventPayload {
  const parsed = approvalEventPayloadSchema.safeParse(payload);
  if (parsed.success) return parsed.data;
  throw new Error(`Invalid approval event payload: ${zodIssues(parsed.error)}`);
}

export function parseStatusEventPayload(payload: unknown): StatusEventPayload {
  const parsed = statusEventSchema.safeParse(payload);
  if (parsed.success) return parsed.data;
  throw new Error(`Invalid status event payload: ${zodIssues(parsed.error)}`);
}
