import { convertToModelMessages, streamText, stepCountIs, UIMessage } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { createClient } from "@/lib/supabase/server";
import { marcusSystemPrompt } from "@/lib/ai/marcus";
import { ghlTools } from "@/lib/ai/tools";

export const maxDuration = 60;

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { messages, sessionId }: { messages: UIMessage[]; sessionId: string } =
    await req.json();

  // Save user message to DB
  const lastMessage = messages[messages.length - 1];
  if (lastMessage.role === "user") {
    const textPart = lastMessage.parts.find((p) => p.type === "text");
    if (textPart && textPart.type === "text") {
      await supabase.from("messages").insert({
        session_id: sessionId,
        role: "user",
        content: textPart.text,
      });
    }
  }

  const result = streamText({
    model: anthropic("claude-sonnet-4.5"),
    system: marcusSystemPrompt,
    messages: await convertToModelMessages(messages),
    tools: ghlTools,
    stopWhen: stepCountIs(5),
    onFinish: async ({ text, toolCalls }) => {
      // Save assistant message
      if (text) {
        await supabase.from("messages").insert({
          session_id: sessionId,
          role: "assistant",
          content: text,
          tool_invocations: toolCalls?.length ? toolCalls : null,
        });
      }

      // Update session timestamp
      await supabase
        .from("chat_sessions")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", sessionId);
    },
  });

  return result.toUIMessageStreamResponse();
}
