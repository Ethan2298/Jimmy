import type { FailureClassification } from "../../chat-reliability";

export type ReliabilityCase = {
  name: string;
  errorMessage: string;
  emittedContent: boolean;
  emittedToolCalls: boolean;
  expectedClassification: FailureClassification;
  expectedRetriable: boolean;
};

export const reliabilityCases: ReliabilityCase[] = [
  {
    name: "empty stream",
    errorMessage: "No output generated. Check the stream for errors.",
    emittedContent: false,
    emittedToolCalls: false,
    expectedClassification: "empty_stream",
    expectedRetriable: true,
  },
  {
    name: "billing credit exhaustion",
    errorMessage:
      "Your credit balance is too low to access the Anthropic API. Please go to Plans & Billing to upgrade or purchase credits.",
    emittedContent: false,
    emittedToolCalls: false,
    expectedClassification: "billing",
    expectedRetriable: false,
  },
  {
    name: "openai quota exhaustion",
    errorMessage: "insufficient_quota: You exceeded your current quota.",
    emittedContent: false,
    emittedToolCalls: false,
    expectedClassification: "billing",
    expectedRetriable: false,
  },
  {
    name: "authentication failure",
    errorMessage: "Unauthorized: invalid API key provided",
    emittedContent: false,
    emittedToolCalls: false,
    expectedClassification: "auth",
    expectedRetriable: false,
  },
  {
    name: "openai invalid key",
    errorMessage: "invalid_api_key: Incorrect API key provided.",
    emittedContent: false,
    emittedToolCalls: false,
    expectedClassification: "auth",
    expectedRetriable: false,
  },
  {
    name: "rate limit",
    errorMessage: "Rate limit exceeded (429): too many requests",
    emittedContent: false,
    emittedToolCalls: false,
    expectedClassification: "rate_limit",
    expectedRetriable: true,
  },
  {
    name: "provider overloaded",
    errorMessage: "Service overloaded. Please try again later.",
    emittedContent: false,
    emittedToolCalls: false,
    expectedClassification: "overloaded",
    expectedRetriable: true,
  },
  {
    name: "transport timeout",
    errorMessage: "Network timeout while waiting for stream response",
    emittedContent: false,
    emittedToolCalls: false,
    expectedClassification: "transport",
    expectedRetriable: true,
  },
  {
    name: "transport abort",
    errorMessage: "Request aborted by user",
    emittedContent: false,
    emittedToolCalls: false,
    expectedClassification: "transport",
    expectedRetriable: true,
  },
  {
    name: "tool error after call",
    errorMessage: "Tool execution failed: task not found",
    emittedContent: true,
    emittedToolCalls: true,
    expectedClassification: "tool_error",
    expectedRetriable: false,
  },
];
