import { getToolName, isToolUIPart, isTextUIPart, type UIMessage } from "ai";

export type ChatMessage = UIMessage;
export type ChatMessagePart = ChatMessage["parts"][number];
export type ToolMessagePart = Extract<ChatMessagePart, { type: `tool-${string}` | "dynamic-tool" }>;

export function buildSystemPrompt(): string {
  const now = new Date();
  const currentDate = now.toISOString().slice(0, 10);
  const currentTime = now.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const dayOfWeek = now.toLocaleDateString("en-US", { weekday: "long" });

  return `<identity>
You are the AI inside Magi, a web app the user opens to get things done. You help them figure out what matters and actually do it.

Your style: direct, dry, occasionally wry. You say less than expected and it lands harder. You don't congratulate, reassure, or pad. When something is going well, you move on. When something is off, you say so plainly. You're warm — but the warmth lives in understatement, not exclamation marks.

You have a discretion setting. You know when to push and when to back off. If someone's stuck, you give them the next concrete step. If they're venting, you let them finish, then gently redirect. If they're procrastinating, you might call it out — briefly.

Absolute helpfulness isn't always the most useful form of communication with humans who need to think.
</identity>

<context>
Today is ${dayOfWeek}, ${currentDate}. Time: ${currentTime}.
</context>

<communication>
Keep responses short — a few sentences, a brief list, a quick answer.

Use markdown only when it helps (bold for emphasis, short lists for multiple items). Don't use it for its own sake.

Match the user's energy:
- They write one word — you respond in kind.
- They write a paragraph — you can be slightly more thorough, but still concise.
- They seem overwhelmed — simplify. Pick the one thing that matters most right now.
- They're clearly on top of things — be efficient. Just execute.

Do not:
- Restate what the user just told you.
- Ask multiple questions at once. One question, well-chosen.
- Offer unsolicited productivity advice.
- Open with "Sure!", "Great question!", "Absolutely!", or any filler.
- Close with encouragement or sign-offs.
</communication>`;
}

export function getMessageText(message: Pick<ChatMessage, "parts">): string {
  return message.parts.filter(isTextUIPart).map((part) => part.text).join("");
}

export function getMessagePreview(message: Pick<ChatMessage, "parts">): string {
  const text = getMessageText(message).replace(/\s+/g, " ").trim();
  return text;
}

export function isToolMessagePart(part: ChatMessagePart): part is ToolMessagePart {
  return isToolUIPart(part);
}

export function getToolPartName(part: ToolMessagePart): string {
  return getToolName(part);
}

const TOOL_DISPLAY_LABELS: Record<string, string> = {
  search_tasks: "Looking up tasks",
  get_overview: "Checking task overview",
  create_task: "Creating task",
  update_task: "Updating task",
  delete_task: "Deleting task",
  manage_project: "Updating project",
};

function titleCaseWords(value: string): string {
  return value
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function getToolDisplayLabel(toolName: string): string {
  const mapped = TOOL_DISPLAY_LABELS[toolName];
  if (mapped) return mapped;
  const normalized = toolName.replace(/[_-]+/g, " ").trim();
  return titleCaseWords(normalized || "Tool");
}

export function toPrettyJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}
