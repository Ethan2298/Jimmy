export type ReliabilityPolicy = "robust-first";

export type FailureClassification =
  | "billing"
  | "auth"
  | "rate_limit"
  | "overloaded"
  | "transport"
  | "empty_stream"
  | "tool_error"
  | "unknown";

export type ContextWindow = "full" | number;

export type AttemptPlan = {
  attempt: number;
  model: string;
  contextWindow: ContextWindow;
  backoffMs: number;
  messageCount: number;
};

export type AttemptUsage = {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
};

export type AttemptResult = {
  emittedContent: boolean;
  emittedToolCalls: boolean;
  cancelled?: boolean;
  usage?: AttemptUsage;
};

export type AttemptSummary = {
  attempt: number;
  model: string;
  contextWindow: ContextWindow;
  messageCount: number;
  classification: FailureClassification;
  retriable: boolean;
  emittedContent: boolean;
  emittedToolCalls: boolean;
  cancelled?: boolean;
  latencyMs: number;
  error?: string;
  usage?: AttemptUsage;
};

type AttemptTemplate = {
  modelIndex: number;
  contextWindow: ContextWindow;
  backoffMs: number;
};

const ROBUST_FIRST_ATTEMPTS: AttemptTemplate[] = [
  { modelIndex: 0, contextWindow: "full", backoffMs: 0 },
  { modelIndex: 0, contextWindow: "full", backoffMs: 350 },
  { modelIndex: 1, contextWindow: "full", backoffMs: 700 },
  { modelIndex: 2, contextWindow: 24, backoffMs: 1200 },
  { modelIndex: 2, contextWindow: 12, backoffMs: 1800 },
];

const RETRIABLE_CLASSIFICATIONS = new Set<FailureClassification>([
  "rate_limit",
  "overloaded",
  "transport",
  "empty_stream",
]);

const BILLING_PATTERNS = [
  /credit balance is too low/i,
  /insufficient credits?/i,
  /insufficient[_\s-]?quota/i,
  /quota exceeded/i,
  /billing hard limit/i,
  /plans?\s*&\s*billing/i,
  /\bbilling\b/i,
  /purchase credits?/i,
];

const AUTH_PATTERNS = [
  /invalid api key/i,
  /invalid[_\s-]?api[_\s-]?key/i,
  /incorrect api key/i,
  /\bapi key\b/i,
  /unauthorized/i,
  /authentication/i,
  /\bforbidden\b/i,
  /permission denied/i,
];

const RATE_LIMIT_PATTERNS = [
  /rate limit/i,
  /too many requests/i,
  /\b429\b/,
  /requests per min/i,
];

const OVERLOADED_PATTERNS = [
  /overloaded/i,
  /\bcapacity\b/i,
  /temporarily unavailable/i,
  /try again later/i,
];

const TRANSPORT_PATTERNS = [
  /network/i,
  /timed?\s*out/i,
  /timeout/i,
  /aborted?/i,
  /cancel(?:led|ed)/i,
  /socket/i,
  /econnreset/i,
  /enotfound/i,
  /connection/i,
  /stream closed/i,
  /no response/i,
];

const TOOL_ERROR_PATTERNS = [/tool/i, /approval/i, /denied by user/i];

function matchesAny(patterns: RegExp[], value: string): boolean {
  return patterns.some((pattern) => pattern.test(value));
}

function resolveModel(models: readonly string[], index: number): string {
  if (models.length === 0) {
    throw new Error("No model fallbacks configured.");
  }
  return models[Math.min(index, models.length - 1)];
}

function contextWindowMessageCount(
  contextWindow: ContextWindow,
  totalMessageCount: number
): number {
  if (contextWindow === "full") return totalMessageCount;
  return Math.min(totalMessageCount, contextWindow);
}

function nowMs(): number {
  return Date.now();
}

async function defaultSleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export function buildAttemptPlan(
  models: readonly string[],
  messageCount: number,
  policy: ReliabilityPolicy = "robust-first"
): AttemptPlan[] {
  if (policy !== "robust-first") {
    throw new Error(`Unsupported reliability policy: ${policy}`);
  }

  return ROBUST_FIRST_ATTEMPTS.map((item, index) => ({
    attempt: index + 1,
    model: resolveModel(models, item.modelIndex),
    contextWindow: item.contextWindow,
    backoffMs: item.backoffMs,
    messageCount: contextWindowMessageCount(item.contextWindow, messageCount),
  }));
}

export function trimMessagesForContext<T>(
  messages: T[],
  contextWindow: ContextWindow
): T[] {
  if (contextWindow === "full") return messages;
  return messages.slice(-contextWindow);
}

export function classifyFailure(
  errorMessage: string,
  emittedContent: boolean,
  emittedToolCalls: boolean
): FailureClassification {
  const message = errorMessage.trim();

  if (!message) {
    return emittedContent ? "unknown" : "empty_stream";
  }

  if (!emittedContent && /no output generated/i.test(message)) {
    return "empty_stream";
  }

  if (matchesAny(BILLING_PATTERNS, message)) return "billing";
  if (matchesAny(AUTH_PATTERNS, message)) return "auth";
  if (matchesAny(RATE_LIMIT_PATTERNS, message)) return "rate_limit";
  if (matchesAny(OVERLOADED_PATTERNS, message)) return "overloaded";
  if (matchesAny(TRANSPORT_PATTERNS, message)) return "transport";

  if (emittedToolCalls && matchesAny(TOOL_ERROR_PATTERNS, message)) {
    return "tool_error";
  }

  if (!emittedContent && /(empty|no content|no output)/i.test(message)) {
    return "empty_stream";
  }

  return "unknown";
}

export function isRetriableClassification(
  classification: FailureClassification
): boolean {
  return RETRIABLE_CLASSIFICATIONS.has(classification);
}

export function shouldRetry(
  classification: FailureClassification,
  emittedToolCalls: boolean,
  attemptIndex: number,
  maxAttempts: number,
  cancelled = false
): boolean {
  if (cancelled) return false;
  if (emittedToolCalls) return false;
  if (attemptIndex >= maxAttempts - 1) return false;
  return isRetriableClassification(classification);
}

export class AttemptError extends Error {
  emittedContent: boolean;
  emittedToolCalls: boolean;
  cancelled: boolean;

  constructor(
    message: string,
    emittedContent: boolean,
    emittedToolCalls: boolean,
    cancelled = false
  ) {
    super(message);
    this.name = "AttemptError";
    this.emittedContent = emittedContent;
    this.emittedToolCalls = emittedToolCalls;
    this.cancelled = cancelled;
  }
}

export class ReliabilityRunError extends Error {
  classification: FailureClassification;
  attempt: number;
  model: string;
  emittedContent: boolean;
  emittedToolCalls: boolean;

  constructor(params: {
    message: string;
    classification: FailureClassification;
    attempt: number;
    model: string;
    emittedContent: boolean;
    emittedToolCalls: boolean;
  }) {
    super(`Error [${params.classification}]: ${params.message}`);
    this.name = "ReliabilityRunError";
    this.classification = params.classification;
    this.attempt = params.attempt;
    this.model = params.model;
    this.emittedContent = params.emittedContent;
    this.emittedToolCalls = params.emittedToolCalls;
  }
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string") return error;
  try {
    return JSON.stringify(error);
  } catch {
    return "Unknown error";
  }
}

function toAttemptError(error: unknown): AttemptError {
  if (error instanceof AttemptError) return error;

  const message = toErrorMessage(error);
  const rec = error && typeof error === "object" ? (error as Record<string, unknown>) : null;
  const emittedContent = typeof rec?.emittedContent === "boolean" ? rec.emittedContent : false;
  const emittedToolCalls =
    typeof rec?.emittedToolCalls === "boolean" ? rec.emittedToolCalls : false;
  const cancelled = typeof rec?.cancelled === "boolean" ? rec.cancelled : false;
  return new AttemptError(message, emittedContent, emittedToolCalls, cancelled);
}

function makeCancelledAttemptError(): AttemptError {
  return new AttemptError("Request cancelled.", false, false, true);
}

async function sleepWithAbort(
  ms: number,
  sleep: (ms: number) => Promise<void>,
  abortSignal?: AbortSignal
): Promise<void> {
  if (ms <= 0) return;
  if (!abortSignal) {
    await sleep(ms);
    return;
  }
  if (abortSignal.aborted) {
    throw makeCancelledAttemptError();
  }

  await new Promise<void>((resolve, reject) => {
    const onAbort = () => {
      abortSignal.removeEventListener("abort", onAbort);
      reject(makeCancelledAttemptError());
    };
    abortSignal.addEventListener("abort", onAbort, { once: true });
    sleep(ms).then(
      () => {
        abortSignal.removeEventListener("abort", onAbort);
        resolve();
      },
      (error) => {
        abortSignal.removeEventListener("abort", onAbort);
        reject(error);
      }
    );
  });
}

export async function runReliabilityAttempts<T>(params: {
  models: readonly string[];
  messages: T[];
  policy?: ReliabilityPolicy;
  executeAttempt: (input: { plan: AttemptPlan; messages: T[] }) => Promise<AttemptResult>;
  onAttemptFinished?: (summary: AttemptSummary) => Promise<void> | void;
  sleep?: (ms: number) => Promise<void>;
  abortSignal?: AbortSignal;
}): Promise<AttemptResult> {
  const policy = params.policy ?? "robust-first";
  const plans = buildAttemptPlan(params.models, params.messages.length, policy);
  const sleep = params.sleep ?? defaultSleep;

  for (let i = 0; i < plans.length; i += 1) {
    const plan = plans[i];
    const attemptMessages = trimMessagesForContext(params.messages, plan.contextWindow);
    const startedAt = nowMs();

    try {
      if (plan.backoffMs > 0) {
        await sleepWithAbort(plan.backoffMs, sleep, params.abortSignal);
      }

      const result = await params.executeAttempt({ plan, messages: attemptMessages });
      const summary: AttemptSummary = {
        attempt: plan.attempt,
        model: plan.model,
        contextWindow: plan.contextWindow,
        messageCount: attemptMessages.length,
        classification: "unknown",
        retriable: false,
        emittedContent: result.emittedContent,
        emittedToolCalls: result.emittedToolCalls,
        cancelled: result.cancelled,
        latencyMs: nowMs() - startedAt,
        usage: result.usage,
      };
      await params.onAttemptFinished?.(summary);
      return result;
    } catch (error) {
      const attemptError = toAttemptError(error);
      const classification = classifyFailure(
        attemptError.message,
        attemptError.emittedContent,
        attemptError.emittedToolCalls
      );
      const retriable = shouldRetry(
        classification,
        attemptError.emittedToolCalls,
        i,
        plans.length,
        attemptError.cancelled
      );
      const summary: AttemptSummary = {
        attempt: plan.attempt,
        model: plan.model,
        contextWindow: plan.contextWindow,
        messageCount: attemptMessages.length,
        classification,
        retriable,
        emittedContent: attemptError.emittedContent,
        emittedToolCalls: attemptError.emittedToolCalls,
        cancelled: attemptError.cancelled,
        latencyMs: nowMs() - startedAt,
        error: attemptError.message,
      };
      await params.onAttemptFinished?.(summary);

      if (!retriable) {
        throw new ReliabilityRunError({
          message: attemptError.message,
          classification,
          attempt: plan.attempt,
          model: plan.model,
          emittedContent: attemptError.emittedContent,
          emittedToolCalls: attemptError.emittedToolCalls,
        });
      }
    }
  }

  throw new ReliabilityRunError({
    message: "Unknown reliability failure.",
    classification: "unknown",
    attempt: plans.length,
    model: plans[plans.length - 1]?.model ?? "unknown",
    emittedContent: false,
    emittedToolCalls: false,
  });
}
