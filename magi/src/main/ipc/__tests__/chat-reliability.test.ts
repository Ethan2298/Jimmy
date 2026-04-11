import { describe, it, expect } from "vitest";
import {
  buildAttemptPlan,
  classifyFailure,
  shouldRetry,
  runReliabilityAttempts,
  AttemptError,
} from "../chat-reliability";
import { reliabilityCases } from "./fixtures/reliability-cases";

describe("chat reliability planning", () => {
  it("builds robust-first schedule with expected models and context windows", () => {
    const plans = buildAttemptPlan(
      ["claude-sonnet-4-6", "claude-sonnet-4-5", "claude-3-7-sonnet-latest"],
      40,
      "robust-first"
    );

    expect(plans).toHaveLength(5);
    expect(plans.map((plan) => plan.model)).toEqual([
      "claude-sonnet-4-6",
      "claude-sonnet-4-6",
      "claude-sonnet-4-5",
      "claude-3-7-sonnet-latest",
      "claude-3-7-sonnet-latest",
    ]);
    expect(plans.map((plan) => plan.contextWindow)).toEqual([
      "full",
      "full",
      "full",
      24,
      12,
    ]);
    expect(plans.map((plan) => plan.messageCount)).toEqual([40, 40, 40, 24, 12]);
  });

  it("caps context-window attempts by available message count", () => {
    const plans = buildAttemptPlan(
      ["claude-sonnet-4-6", "claude-sonnet-4-5", "claude-3-7-sonnet-latest"],
      9
    );
    expect(plans.map((plan) => plan.messageCount)).toEqual([9, 9, 9, 9, 9]);
  });

  it("maps known failure cases and retryability", () => {
    for (const failureCase of reliabilityCases) {
      const classification = classifyFailure(
        failureCase.errorMessage,
        failureCase.emittedContent,
        failureCase.emittedToolCalls
      );
      expect(classification, failureCase.name).toBe(failureCase.expectedClassification);
      expect(
        shouldRetry(classification, failureCase.emittedToolCalls, 0, 5),
        failureCase.name
      ).toBe(failureCase.expectedRetriable);
    }
  });

  it("never retries after tool calls even for retriable classifications", () => {
    expect(shouldRetry("transport", true, 0, 5)).toBe(false);
    expect(shouldRetry("empty_stream", true, 0, 5)).toBe(false);
  });

  it("never retries cancelled attempts", () => {
    expect(shouldRetry("transport", false, 0, 5, true)).toBe(false);
  });
});

describe("chat reliability runner", () => {
  it("retries empty stream and succeeds on fallback attempt", async () => {
    const attempts: string[] = [];
    const result = await runReliabilityAttempts({
      models: ["claude-sonnet-4-6", "claude-sonnet-4-5", "claude-3-7-sonnet-latest"],
      messages: [{ role: "user", content: "hello" }],
      executeAttempt: async ({ plan }) => {
        attempts.push(plan.model);
        if (attempts.length === 1) {
          throw new AttemptError(
            "No output generated. Check the stream for errors.",
            false,
            false
          );
        }
        return { emittedContent: true, emittedToolCalls: false };
      },
      sleep: async () => undefined,
    });

    expect(result.emittedContent).toBe(true);
    expect(attempts).toEqual(["claude-sonnet-4-6", "claude-sonnet-4-6"]);
  });

  it("fails fast on billing errors", async () => {
    await expect(
      runReliabilityAttempts({
        models: ["claude-sonnet-4-6", "claude-sonnet-4-5", "claude-3-7-sonnet-latest"],
        messages: [{ role: "user", content: "hello" }],
        executeAttempt: async () => {
          throw new AttemptError(
            "Your credit balance is too low to access the Anthropic API.",
            false,
            false
          );
        },
        sleep: async () => undefined,
      })
    ).rejects.toMatchObject({
      classification: "billing",
      attempt: 1,
    });
  });

  it("stops retrying when error happens after a tool call", async () => {
    await expect(
      runReliabilityAttempts({
        models: ["claude-sonnet-4-6", "claude-sonnet-4-5", "claude-3-7-sonnet-latest"],
        messages: [{ role: "user", content: "hello" }],
        executeAttempt: async () => {
          throw new AttemptError("Tool execution failed: task not found", true, true);
        },
        sleep: async () => undefined,
      })
    ).rejects.toMatchObject({
      classification: "tool_error",
      attempt: 1,
    });
  });

  it("retries the same selected model only in manual model mode", async () => {
    const attempts: string[] = [];
    await expect(
      runReliabilityAttempts({
        models: ["gpt-5"],
        messages: [{ role: "user", content: "hello" }],
        executeAttempt: async ({ plan }) => {
          attempts.push(plan.model);
          throw new AttemptError("Network timeout while waiting for stream response", false, false);
        },
        sleep: async () => undefined,
      })
    ).rejects.toMatchObject({
      classification: "transport",
      attempt: 5,
    });

    expect(attempts).toEqual(["gpt-5", "gpt-5", "gpt-5", "gpt-5", "gpt-5"]);
  });

  it("stops immediately when attempt is cancelled", async () => {
    let attempts = 0;
    await expect(
      runReliabilityAttempts({
        models: ["gpt-5"],
        messages: [{ role: "user", content: "hello" }],
        executeAttempt: async () => {
          attempts += 1;
          throw new AttemptError("Request cancelled.", false, false, true);
        },
        sleep: async () => undefined,
      })
    ).rejects.toMatchObject({
      classification: "transport",
      attempt: 1,
    });
    expect(attempts).toBe(1);
  });

  it("aborts during backoff and does not execute next attempt", async () => {
    const abortController = new AbortController();
    let executeCalls = 0;

    await expect(
      runReliabilityAttempts({
        models: ["gpt-5"],
        messages: [{ role: "user", content: "hello" }],
        executeAttempt: async () => {
          executeCalls += 1;
          if (executeCalls === 1) {
            throw new AttemptError("Network timeout", false, false);
          }
          return { emittedContent: true, emittedToolCalls: false };
        },
        sleep: async (ms) => {
          if (ms >= 350) {
            abortController.abort("user_cancelled");
          }
          await Promise.resolve();
        },
        abortSignal: abortController.signal,
      })
    ).rejects.toMatchObject({
      classification: "transport",
      attempt: 2,
    });

    expect(executeCalls).toBe(1);
  });
});
