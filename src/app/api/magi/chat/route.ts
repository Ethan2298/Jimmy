import { streamText, convertToModelMessages, type ModelMessage } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { buildSystemPrompt } from "@/lib/magi/ai";
import { isValidProvider, isValidModelForProvider, type AIProvider } from "@/lib/magi/ai-provider";

function createProviderModel(provider: AIProvider, model: string, apiKey: string) {
  if (provider === "openai") {
    return createOpenAI({ apiKey })(model);
  }
  return createAnthropic({ apiKey })(model);
}

export async function POST(req: Request) {
  const body = await req.json();
  const { provider, model, messages, apiKey } = body;

  if (!isValidProvider(provider)) {
    return Response.json({ error: "Invalid provider" }, { status: 400 });
  }
  if (!isValidModelForProvider(provider, model)) {
    return Response.json({ error: `Invalid model "${model}" for provider "${provider}"` }, { status: 400 });
  }

  const resolvedKey = apiKey || (provider === "openai" ? process.env.OPENAI_API_KEY : process.env.ANTHROPIC_API_KEY);
  if (!resolvedKey) {
    return Response.json({ error: `No API key for ${provider}. Set one in settings.` }, { status: 400 });
  }

  const providerModel = createProviderModel(provider, model, resolvedKey);
  const systemPrompt = buildSystemPrompt();

  let modelMessages: ModelMessage[];
  try {
    modelMessages = await convertToModelMessages(messages, {
      tools: {},
      ignoreIncompleteToolCalls: true,
    });
  } catch {
    return Response.json({ error: "Invalid messages format" }, { status: 400 });
  }

  const result = streamText({
    model: providerModel,
    system: systemPrompt,
    messages: modelMessages,
    maxOutputTokens: 4096,
  });

  return result.toUIMessageStreamResponse({
    sendReasoning: true,
    sendSources: false,
  });
}
