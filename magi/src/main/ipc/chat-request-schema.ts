import { z } from "zod";

export const permissionModeSchema = z.enum(["ask", "edits", "full"]);

export const chatRequestSchema = z.object({
  apiKey: z.string().optional(),
  apiKeys: z
    .object({
      anthropic: z.string().optional(),
      openai: z.string().optional(),
    })
    .optional(),
  provider: z.string(),
  model: z.string().min(1, "model is required"),
  systemPrompt: z.string().min(1, "systemPrompt is required"),
  permissionMode: permissionModeSchema.default("ask"),
  meta: z
    .object({
      requestId: z.string().min(1).optional(),
      threadId: z.string().min(1).optional(),
    })
    .optional(),
  // UI messages are validated at runtime in the handler before conversion.
  messages: z.array(z.unknown()),
});

export type PermissionMode = z.infer<typeof permissionModeSchema>;
export type ChatRequest = z.infer<typeof chatRequestSchema>;
