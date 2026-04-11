import { ipcMain, type WebContents } from "electron";
import { randomUUID } from "crypto";
import {
  convertToModelMessages,
  streamText,
  tool,
  stepCountIs,
  type ModelMessage,
} from "ai";
import { z } from "zod";
import {
  getOverviewSchema,
  listTasksSchema,
  getTaskSchema,
  searchTasksSchema,
  createTaskSchema,
  updateTaskSchema,
  deleteTaskSchema,
  manageProjectSchema,
} from "../tools/schemas";
import * as impl from "../tools/implementations";
import { addCacheBreakpoints } from "../lib/cache-breakpoints";
import {
  parseApprovalEventPayload,
  parseStatusEventPayload,
  parseStreamChunkPayload,
  type ApprovalEventPayload,
  type StatusEventPayload,
  type UsageEventPayload,
} from "./chat-contracts";
import {
  AttemptError,
  ReliabilityRunError,
  runReliabilityAttempts,
  type AttemptPlan,
  type AttemptResult,
  type ReliabilityPolicy,
} from "./chat-reliability";
import { writeChatDiagnosticsEntry } from "./chat-diagnostics";
import {
  isValidModelForProvider,
  isValidProvider,
  type AIProvider,
} from "../../shared/ai-provider";
import { createProviderRuntime } from "./provider-factory";
import { getStoredApiKey } from "./api-keys";
import {
  buildMissingApiKeyError,
  resolveApiKeyForProvider,
} from "./chat-key-resolution";
import {
  chatRequestSchema,
  type ChatRequest,
  type PermissionMode,
} from "./chat-request-schema";
import { buildOpenAIPromptCacheKey } from "./openai-prompt-cache";

const approvalDecisionSchema = z.object({
  streamId: z.string().min(1),
  approvalId: z.string().min(1),
  approved: z.boolean(),
});

const cancelRequestSchema = z.object({
  streamId: z.string().min(1),
});

type ApprovalDecision = {
  approved: boolean;
  reason: string;
};

type PendingApproval = {
  resolve: (decision: ApprovalDecision) => void;
  timeout: NodeJS.Timeout;
  toolCallId: string;
};

type StreamApprovalState = {
  senderId: number;
  approvals: Map<string, PendingApproval>;
};

type ActiveRunState = {
  senderId: number;
  abortController: AbortController;
  cancelledByUser: boolean;
  terminalSent: boolean;
};

const RELIABILITY_POLICY: ReliabilityPolicy = "robust-first";
const APPROVAL_TIMEOUT_MS = 60_000;

const streamApprovals = new Map<string, StreamApprovalState>();
const activeRuns = new Map<string, ActiveRunState>();

function toErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string") return error;
  try {
    return JSON.stringify(error);
  } catch {
    return "Unknown error";
  }
}

function validationErrorSummary(prefix: string, error: z.ZodError): string {
  const details = error.issues.map((issue) => `${issue.path.join(".") || "root"}: ${issue.message}`);
  return `${prefix}: ${details.join("; ")}`;
}

async function emitStreamChunk(sender: WebContents, streamId: string, payload: unknown): Promise<void> {
  if (sender.isDestroyed()) return;
  const validatedPayload = await parseStreamChunkPayload(payload);
  sender.send(`chat:stream:${streamId}:chunk`, validatedPayload);
}

function emitApprovalEvent(
  sender: WebContents,
  streamId: string,
  payload: ApprovalEventPayload
): void {
  if (sender.isDestroyed()) return;
  const validatedPayload = parseApprovalEventPayload(payload);
  sender.send(`chat:stream:${streamId}:approval`, validatedPayload);
}

function emitStatusEvent(
  sender: WebContents,
  streamId: string,
  payload: StatusEventPayload
): void {
  if (sender.isDestroyed()) return;
  const validatedPayload = parseStatusEventPayload(payload);
  sender.send(`chat:stream:${streamId}:status`, validatedPayload);
}

function cleanupStreamApprovals(streamId: string, reason = "Approval session ended."): void {
  const state = streamApprovals.get(streamId);
  if (!state) return;

  for (const [, pending] of state.approvals) {
    clearTimeout(pending.timeout);
    pending.resolve({ approved: false, reason });
  }

  streamApprovals.delete(streamId);
}

function cancelRun(streamId: string, reason: string): void {
  const run = activeRuns.get(streamId);
  if (!run) return;
  run.cancelledByUser = true;
  if (!run.abortController.signal.aborted) {
    run.abortController.abort(reason);
  }
}

function emitStreamDone(sender: WebContents, streamId: string): void {
  const run = activeRuns.get(streamId);
  if (!run || run.terminalSent || sender.isDestroyed()) return;
  run.terminalSent = true;
  sender.send(`chat:stream:${streamId}:done`);
}

function emitStreamError(sender: WebContents, streamId: string, message: string): void {
  const run = activeRuns.get(streamId);
  if (!run || run.terminalSent || sender.isDestroyed()) return;
  run.terminalSent = true;
  sender.send(`chat:stream:${streamId}:error`, message);
}

function emitStreamUsage(sender: WebContents, streamId: string, payload: UsageEventPayload): void {
  if (sender.isDestroyed()) return;
  sender.send(`chat:stream:${streamId}:usage`, payload);
}

function requiresApproval(mode: PermissionMode, mutating: boolean, destructive: boolean): boolean {
  if (!mutating) return false;
  if (mode === "full") return false;
  if (mode === "edits") return destructive;
  return true;
}

function normalizeToolCallId(options: unknown): string {
  if (!options || typeof options !== "object") return randomUUID();
  const maybeId = (options as Record<string, unknown>).toolCallId;
  return typeof maybeId === "string" && maybeId.trim() ? maybeId : randomUUID();
}

async function requestToolApproval(params: {
  sender: WebContents;
  streamId: string;
  toolCallId: string;
  toolName: string;
  args: unknown;
  destructive: boolean;
  reason: string;
}): Promise<void> {
  const state = streamApprovals.get(params.streamId);
  if (!state) {
    throw new Error("Approval session not found.");
  }

  const approvalId = randomUUID();

  const decisionPromise = new Promise<ApprovalDecision>((resolve) => {
    const resolveDecision = (decision: ApprovalDecision) => {
      const pending = state.approvals.get(approvalId);
      if (!pending) return;
      clearTimeout(pending.timeout);
      state.approvals.delete(approvalId);
      resolve(decision);
    };

    const timeout = setTimeout(() => {
      resolveDecision({ approved: false, reason: "Approval timed out after 60 seconds." });
    }, APPROVAL_TIMEOUT_MS);

    state.approvals.set(approvalId, {
      resolve: resolveDecision,
      timeout,
      toolCallId: params.toolCallId,
    });
  });

  emitApprovalEvent(params.sender, params.streamId, {
    type: "tool-approval-requested",
    approvalId,
    toolCallId: params.toolCallId,
    toolName: params.toolName,
    args: params.args,
    destructive: params.destructive,
    reason: params.reason,
  });

  const decision = await decisionPromise;

  emitApprovalEvent(params.sender, params.streamId, {
    type: "tool-approval-resolved",
    approvalId,
    toolCallId: params.toolCallId,
    approved: decision.approved,
  });

  if (!decision.approved) {
    throw new Error(decision.reason);
  }
}

async function enforcePermission(params: {
  permissionMode: PermissionMode;
  sender: WebContents;
  streamId: string;
  toolName: string;
  toolCallId: string;
  args: unknown;
  mutating: boolean;
  destructive: boolean;
}): Promise<void> {
  if (!requiresApproval(params.permissionMode, params.mutating, params.destructive)) {
    return;
  }

  await requestToolApproval({
    sender: params.sender,
    streamId: params.streamId,
    toolCallId: params.toolCallId,
    toolName: params.toolName,
    args: params.args,
    destructive: params.destructive,
    reason: params.destructive
      ? "This action is destructive and requires confirmation."
      : "This action will modify tasks/projects and requires confirmation.",
  });
}

function createChatTools(context: {
  permissionMode: PermissionMode;
  sender: WebContents;
  streamId: string;
}) {
  return {
    get_overview: tool({
      description:
        "Retrieve a snapshot of the user's task system: all projects, today's tasks, overdue tasks, recent completions, and stats. Call this when the user asks what to work on, wants a status update, or starts a planning conversation. Summarize the highlights rather than dumping raw output. Read-only, no side effects.",
      inputSchema: getOverviewSchema,
      execute: async () => impl.getOverview(),
    }),
    list_tasks: tool({
      description:
        "List tasks with optional filters for project, status (active/completed/cancelled), priority (1=urgent to 4=low), due date range, or label. Use when the user asks about specific subsets - 'what's due this week,' 'high-priority items,' etc. Prefer using at least one filter; unfiltered results can be noisy.",
      inputSchema: listTasksSchema,
      execute: async (args) => impl.listTasks(args),
    }),
    get_task: tool({
      description:
        "Fetch full details of a single task by ID, including labels, description, and subtasks. Use when inspecting a task before updating it, or when the user asks about a specific item. Get the task_id from get_overview, list_tasks, or search_tasks results.",
      inputSchema: getTaskSchema,
      execute: async (args) => impl.getTask(args),
    }),
    search_tasks: tool({
      description:
        "Search tasks by matching text against titles and descriptions. Use when the user refers to a task by name or topic rather than ID - e.g., 'mark the migration done.' Returns active tasks first, sorted by relevance. Default limit is 50; use a lower limit for targeted searches.",
      inputSchema: searchTasksSchema,
      execute: async (args) => impl.searchTasks(args),
    }),
    create_task: tool({
      description:
        "Create a new task. Only title is required; project, parent, priority, due date, and labels are optional. Labels are created automatically if they don't exist. Be proactive about setting due dates and priorities when the user's intent is clear, even if they don't spell them out.",
      inputSchema: createTaskSchema,
      execute: async (args, options) => {
        const toolCallId = normalizeToolCallId(options);
        await enforcePermission({
          permissionMode: context.permissionMode,
          sender: context.sender,
          streamId: context.streamId,
          toolName: "create_task",
          toolCallId,
          args,
          mutating: true,
          destructive: false,
        });
        return impl.createTask(args);
      },
    }),
    update_task: tool({
      description:
        "Update fields on an existing task: title, description, status, priority, due date, project, labels. Setting status to 'completed' recursively completes all subtasks. Setting due_date to null clears it. Use add_labels/remove_labels to modify without replacing. Requires task_id - use search_tasks first if you only have a name.",
      inputSchema: updateTaskSchema,
      execute: async (args, options) => {
        const toolCallId = normalizeToolCallId(options);
        await enforcePermission({
          permissionMode: context.permissionMode,
          sender: context.sender,
          streamId: context.streamId,
          toolName: "update_task",
          toolCallId,
          args,
          mutating: true,
          destructive: false,
        });
        return impl.updateTask(args);
      },
    }),
    delete_task: tool({
      description:
        "Permanently delete a task and its subtasks. This is irreversible. Only use when the user explicitly asks to delete - for finished tasks, use update_task with status='completed' instead.",
      inputSchema: deleteTaskSchema,
      execute: async (args, options) => {
        const toolCallId = normalizeToolCallId(options);
        await enforcePermission({
          permissionMode: context.permissionMode,
          sender: context.sender,
          streamId: context.streamId,
          toolName: "delete_task",
          toolCallId,
          args,
          mutating: true,
          destructive: true,
        });
        return impl.deleteTask(args);
      },
    }),
    manage_project: tool({
      description:
        "Create, update, or delete a project. Create requires a name (optional color). Update/delete require project_id. Deleting a project cascades to all its tasks. The Inbox project cannot be deleted.",
      inputSchema: manageProjectSchema,
      execute: async (args, options) => {
        const toolCallId = normalizeToolCallId(options);
        const destructive = args.action === "delete";
        await enforcePermission({
          permissionMode: context.permissionMode,
          sender: context.sender,
          streamId: context.streamId,
          toolName: "manage_project",
          toolCallId,
          args,
          mutating: true,
          destructive,
        });
        return impl.manageProject(args);
      },
    }),
  };
}

ipcMain.handle("chat:approveTool", async (event, payload: unknown) => {
  const parsed = approvalDecisionSchema.safeParse(payload);
  if (!parsed.success) {
    return { ok: false, error: validationErrorSummary("Invalid approval payload", parsed.error) };
  }

  const { streamId, approvalId, approved } = parsed.data;
  const state = streamApprovals.get(streamId);
  if (!state) {
    return { ok: false, error: "Approval session not found." };
  }

  if (state.senderId !== event.sender.id) {
    return { ok: false, error: "Approval sender mismatch." };
  }

  const pending = state.approvals.get(approvalId);
  if (!pending) {
    return { ok: false, error: "Approval request not found or already resolved." };
  }

  pending.resolve({
    approved,
    reason: approved ? "Approved by user." : "Denied by user.",
  });

  return { ok: true };
});

ipcMain.handle("chat:cancel", async (event, payload: unknown) => {
  const parsed = cancelRequestSchema.safeParse(payload);
  if (!parsed.success) {
    return { ok: false, error: validationErrorSummary("Invalid cancel payload", parsed.error) };
  }

  const { streamId } = parsed.data;
  const run = activeRuns.get(streamId);
  if (!run) {
    return { ok: true };
  }
  if (run.senderId !== event.sender.id) {
    return { ok: false, error: "Cancel sender mismatch." };
  }

  cancelRun(streamId, "user_cancelled");
  cleanupStreamApprovals(streamId, "Request cancelled by user.");
  return { ok: true };
});

ipcMain.handle("chat:send", async (event, rawRequest: unknown) => {
  const parsedRequest = chatRequestSchema.safeParse(rawRequest);
  if (!parsedRequest.success) {
    return {
      streamId: "",
      error: validationErrorSummary("Invalid chat request", parsedRequest.error),
    };
  }

  const request: ChatRequest = parsedRequest.data;

  try {
    if (!isValidProvider(request.provider)) {
      return { streamId: "", error: "Invalid provider requested." };
    }
    const provider: AIProvider = request.provider;
    if (!isValidModelForProvider(provider, request.model)) {
      return {
        streamId: "",
        error: `Invalid model "${request.model}" for provider "${provider}".`,
      };
    }

    const apiKey = resolveApiKeyForProvider({
      request,
      provider,
      storedKey: getStoredApiKey(provider),
      env: process.env,
    });
    if (!apiKey) {
      return {
        streamId: "",
        error: buildMissingApiKeyError(provider),
      };
    }

    const streamId = randomUUID();
    const sender = event.sender;
    const runState: ActiveRunState = {
      senderId: sender.id,
      abortController: new AbortController(),
      cancelledByUser: false,
      terminalSent: false,
    };
    activeRuns.set(streamId, runState);
    const threadIdForCache = request.meta?.threadId?.trim() || undefined;
    const promptCacheKeyConfigured =
      provider === "openai" && typeof threadIdForCache === "string";
    const tools = createChatTools({
      permissionMode: request.permissionMode,
      sender,
      streamId,
    });

    let messages: ModelMessage[];
    try {
      messages = await convertToModelMessages(request.messages as any, {
        tools,
        ignoreIncompleteToolCalls: true,
      });
    } catch (error) {
      return {
        streamId: "",
        error: `Invalid chat messages: ${toErrorMessage(error)}`,
      };
    }

    const senderDestroyedListener = () => {
      cancelRun(streamId, "window_destroyed");
      cleanupStreamApprovals(streamId, "Window closed before approval could complete.");
    };

    streamApprovals.set(streamId, {
      senderId: sender.id,
      approvals: new Map(),
    });
    sender.once("destroyed", senderDestroyedListener);

    const runStreamForAttempt = async (
      plan: AttemptPlan,
      attemptMessages: ModelMessage[]
    ): Promise<AttemptResult> => {
      const openAIPromptCacheKey =
        provider === "openai"
          ? buildOpenAIPromptCacheKey({
              model: plan.model,
              systemPrompt: request.systemPrompt,
              threadId: threadIdForCache,
            })
          : undefined;
      const runtime = createProviderRuntime({
        provider,
        model: plan.model,
        apiKey,
        systemPrompt: request.systemPrompt,
        messages: addCacheBreakpoints(attemptMessages, provider),
      });

      const result = streamText({
        model: runtime.model as Parameters<typeof streamText>[0]["model"],
        maxOutputTokens: 2048,
        system: runtime.system,
        messages: runtime.messages,
        tools,
        providerOptions: openAIPromptCacheKey
          ? { openai: { promptCacheKey: openAIPromptCacheKey } }
          : undefined,
        abortSignal: runState.abortController.signal,
        stopWhen: stepCountIs(10),
      });

      let streamError: string | null = null;
      let emittedContent = false;
      let emittedToolCalls = false;
      let lastStatusKey = "";

      const emitStatusIfChanged = (payload: StatusEventPayload) => {
        const key = `${payload.phase}:${payload.label}:${payload.toolCallId ?? ""}`;
        if (key === lastStatusKey) return;
        lastStatusKey = key;
        emitStatusEvent(sender, streamId, payload);
      };

      const uiStream = result.toUIMessageStream({
        sendReasoning: true,
        sendSources: false,
        onError: (error) => toErrorMessage(error),
      });

      // Batch IPC chunks: buffer validated chunks and flush every ~12ms
      const BATCH_INTERVAL_MS = 12;
      const chunkBuffer: unknown[] = [];
      let flushTimer: ReturnType<typeof setTimeout> | null = null;

      const flushChunkBuffer = () => {
        flushTimer = null;
        if (chunkBuffer.length === 0 || sender.isDestroyed()) return;
        const batch = chunkBuffer.splice(0);
        sender.send(`chat:stream:${streamId}:chunks`, batch);
      };

      try {
        for await (const streamChunk of uiStream) {
          if (sender.isDestroyed()) break;
          switch (streamChunk.type) {
            case "text-delta":
            case "tool-input-start":
            case "tool-input-delta":
            case "tool-input-available":
            case "tool-input-error":
            case "tool-output-available":
            case "tool-output-error":
            case "tool-output-denied":
            case "tool-approval-request":
              emittedContent = true;
              break;
          }

          switch (streamChunk.type) {
            case "tool-input-start":
            case "tool-input-delta":
            case "tool-input-available":
            case "tool-input-error":
            case "tool-output-available":
            case "tool-output-error":
            case "tool-output-denied":
            case "tool-approval-request":
              emittedToolCalls = true;
              break;
          }

          switch (streamChunk.type) {
            case "tool-approval-request":
              emitStatusIfChanged({
                type: "status-update",
                phase: "waiting-approval",
                label: "Waiting for approval",
                toolName: streamChunk.toolName,
                toolCallId: streamChunk.toolCallId,
              });
              break;
            case "abort":
              throw new AttemptError("Request cancelled.", emittedContent, emittedToolCalls, true);
            case "error":
              streamError = streamChunk.errorText;
              break;
          }

          const validated = await parseStreamChunkPayload(streamChunk);
          chunkBuffer.push(validated);

          // Flush immediately for interactive events, otherwise batch on timer
          if (streamChunk.type === "tool-approval-request") {
            if (flushTimer) { clearTimeout(flushTimer); flushTimer = null; }
            flushChunkBuffer();
          } else if (!flushTimer) {
            flushTimer = setTimeout(flushChunkBuffer, BATCH_INTERVAL_MS);
          }
        }

        // Flush any remaining buffered chunks
        if (flushTimer) { clearTimeout(flushTimer); flushTimer = null; }
        flushChunkBuffer();
      } catch (streamLoopError) {
        if (flushTimer) { clearTimeout(flushTimer); flushTimer = null; }
        flushChunkBuffer();
        const message = toErrorMessage(streamLoopError);
        if (
          runState.abortController.signal.aborted ||
          /abort(?:ed)?|cancel(?:led|ed)/i.test(message)
        ) {
          throw new AttemptError("Request cancelled.", emittedContent, emittedToolCalls, true);
        }
        throw streamLoopError;
      }

      if (runState.abortController.signal.aborted) {
        throw new AttemptError("Request cancelled.", emittedContent, emittedToolCalls, true);
      }

      if (sender.isDestroyed()) {
        throw new AttemptError(
          "Window closed during stream.",
          emittedContent,
          emittedToolCalls,
          true
        );
      }

      if (streamError) {
        throw new AttemptError(streamError, emittedContent, emittedToolCalls);
      }

      if (!emittedContent) {
        throw new AttemptError(
          "No output generated. Check the stream for errors.",
          false,
          emittedToolCalls
        );
      }

      let usageSummary: AttemptResult["usage"] | undefined;
      try {
        const usage = await result.totalUsage;
        const d = usage.inputTokenDetails;
        usageSummary = {
          inputTokens: usage.inputTokens,
          outputTokens: usage.outputTokens,
          totalTokens: usage.totalTokens,
          cacheReadTokens: d?.cacheReadTokens,
          cacheWriteTokens: d?.cacheWriteTokens,
        };
        console.log(
          `[cache] read=${d?.cacheReadTokens ?? 0} write=${d?.cacheWriteTokens ?? 0} input=${usage.inputTokens ?? 0}`
        );
      } catch (usageError) {
        console.warn("[chat] usage unavailable:", toErrorMessage(usageError));
      }

      return { emittedContent, emittedToolCalls, usage: usageSummary };
    };

    // Give renderer a tick to attach stream listeners before sending events.
    setTimeout(() => {
      void (async () => {
        try {
          let lastUsage: UsageEventPayload | undefined;
          await runReliabilityAttempts({
            models: [request.model],
            messages,
            policy: RELIABILITY_POLICY,
            abortSignal: runState.abortController.signal,
            executeAttempt: ({ plan, messages: scopedMessages }) =>
              runStreamForAttempt(plan, scopedMessages),
            onAttemptFinished: (summary) => {
              if (summary.usage) {
                lastUsage = {
                  inputTokens: summary.usage.inputTokens,
                  outputTokens: summary.usage.outputTokens,
                  totalTokens: summary.usage.totalTokens,
                  cacheReadTokens: summary.usage.cacheReadTokens,
                  cacheWriteTokens: summary.usage.cacheWriteTokens,
                };
              }
              writeChatDiagnosticsEntry({
                ts: new Date().toISOString(),
                streamId,
                provider,
                attempt: summary.attempt,
                model: summary.model,
                messageCount: summary.messageCount,
                contextWindow: summary.contextWindow,
                classification: summary.classification,
                retriable: summary.retriable,
                emittedContent: summary.emittedContent,
                emittedToolCalls: summary.emittedToolCalls,
                cancelled: summary.cancelled,
                promptCacheKeyApplied: promptCacheKeyConfigured,
                latencyMs: summary.latencyMs,
                error: summary.error,
                usage: summary.usage,
              });

              if (summary.error && summary.retriable) {
                console.warn(
                  `[chat] attempt ${summary.attempt} (${summary.model}) failed with ${summary.classification}; retrying: ${summary.error}`
                );
              }
            },
          });
          if (!runState.cancelledByUser) {
            if (lastUsage) emitStreamUsage(sender, streamId, lastUsage);
            emitStreamDone(sender, streamId);
          }
        } catch (err: unknown) {
          if (runState.cancelledByUser) {
            return;
          }
          const message =
            err instanceof ReliabilityRunError
              ? err.message
              : `Error [unknown]: ${toErrorMessage(err)}`;
          emitStreamError(sender, streamId, message);
        } finally {
          sender.removeListener("destroyed", senderDestroyedListener);
          cleanupStreamApprovals(streamId);
          activeRuns.delete(streamId);
        }
      })();
    }, 0);

    return { streamId };
  } catch (err: unknown) {
    const message = toErrorMessage(err);
    return { streamId: "", error: message };
  }
});
