import type { Goal, Task, ChatMessage } from "../App";

// --- System prompt ---

export function buildSystemPrompt(goal: Goal): string {
  const completed = goal.tasks.filter((t) => t.status === "completed");
  const current = goal.tasks.find((t) => t.status === "pending") ?? null;

  let prompt = `You are an AI assistant helping a user achieve a goal.\n\n`;
  prompt += `## Goal\n${goal.title}\n\n`;

  if (goal.context.length > 0) {
    prompt += `## Context\n`;
    for (const item of goal.context) {
      prompt += `- ${item}\n`;
    }
    prompt += `\n`;
  }

  if (completed.length > 0) {
    prompt += `## Completed Tasks\n`;
    for (const task of completed) {
      prompt += `- ${task.title}\n`;
    }
    prompt += `\n`;
  }

  if (current) {
    prompt += `## Current Task\n**${current.title}**\n${current.description}\n\n`;
  } else {
    prompt += `## Current Task\nNone\n\n`;
  }

  prompt += `## Tools
- **set_task** — Propose a new task (title + description). Replaces any current pending task.
- **edit_task** — Update the current task's title or description without replacing it.
- **complete_task** — Mark the current task as done. Only use when the user says they finished it.
- **delete_task** — Remove a completed task from history by title.
- **add_context** — Add a piece of context about the user's situation.
- **remove_context** — Remove a context item that's no longer relevant.

## Instructions
- Help the user achieve their goal by proposing concrete, actionable next steps — one at a time.
- Only ever propose ONE task at a time. Never plan ahead or batch multiple tasks.
- Keep tasks specific and achievable — one clear action.
- Task descriptions support markdown. Keep descriptions concise — a brief sentence or a few bullet points at most. Don't over-explain.
- Be concise. Don't over-explain. Respond in 1-3 short sentences unless asked for detail.
- When the user completes a task, acknowledge briefly and propose the next single step.
- If you have no task to propose yet, ask a clarifying question to understand the situation better.`;

  return prompt;
}

// --- Tool definitions ---

export const CLAUDE_TOOLS = [
  {
    name: "set_task",
    description:
      "Set the current task. Replaces any existing pending task. Completed/skipped tasks are preserved.",
    input_schema: {
      type: "object" as const,
      properties: {
        title: {
          type: "string" as const,
          description: "A short, clear title for the task",
        },
        description: {
          type: "string" as const,
          description: "A very brief markdown description — one sentence or a few bullet points max",
        },
      },
      required: ["title", "description"],
    },
  },
  {
    name: "edit_task",
    description:
      "Edit the current pending task's title or description. Only provided fields are updated.",
    input_schema: {
      type: "object" as const,
      properties: {
        title: {
          type: "string" as const,
          description: "New title for the task",
        },
        description: {
          type: "string" as const,
          description: "New description for the task",
        },
      },
      required: [],
    },
  },
  {
    name: "complete_task",
    description:
      "Mark the current pending task as completed. Moves it to the completed list.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "delete_task",
    description:
      "Delete a completed task from the history by matching its title.",
    input_schema: {
      type: "object" as const,
      properties: {
        title: {
          type: "string" as const,
          description: "Title of the completed task to delete (exact or close match)",
        },
      },
      required: ["title"],
    },
  },
  {
    name: "add_context",
    description: "Add a piece of context about the user's situation. Context helps you make better recommendations.",
    input_schema: {
      type: "object" as const,
      properties: {
        content: {
          type: "string" as const,
          description: "The context to add",
        },
      },
      required: ["content"],
    },
  },
  {
    name: "remove_context",
    description: "Remove a context item that is no longer relevant. Match by content.",
    input_schema: {
      type: "object" as const,
      properties: {
        content: {
          type: "string" as const,
          description: "The context item to remove (exact or close match)",
        },
      },
      required: ["content"],
    },
  },
];

// --- Apply tool calls to goal state ---

export function applyToolCalls(
  goal: Goal,
  toolCalls: { name: string; input: Record<string, unknown> }[]
): Partial<Goal> {
  let updates: Partial<Goal> = {};
  // Start from current state, accumulating changes
  let currentTasks = goal.tasks;
  let currentContext = goal.context;

  for (const call of toolCalls) {
    if (call.name === "set_task") {
      const input = call.input as { title: string; description: string };
      // Keep completed/skipped tasks, replace any pending task
      const kept = currentTasks.filter((t) => t.status !== "pending");
      const newTask: Task = {
        id: crypto.randomUUID(),
        title: input.title,
        description: input.description,
        status: "pending" as const,
        createdAt: new Date().toISOString(),
      };
      currentTasks = [...kept, newTask];
      updates.tasks = currentTasks;
    } else if (call.name === "edit_task") {
      const input = call.input as { title?: string; description?: string };
      currentTasks = currentTasks.map((t) =>
        t.status === "pending"
          ? { ...t, ...(input.title !== undefined && { title: input.title }), ...(input.description !== undefined && { description: input.description }) }
          : t
      );
      updates.tasks = currentTasks;
    } else if (call.name === "complete_task") {
      currentTasks = currentTasks.map((t) =>
        t.status === "pending"
          ? { ...t, status: "completed" as const, completedAt: new Date().toISOString() }
          : t
      );
      updates.tasks = currentTasks;
    } else if (call.name === "delete_task") {
      const input = call.input as { title: string };
      const search = input.title.toLowerCase().trim();
      // Remove first matching completed/skipped task
      let removed = false;
      currentTasks = currentTasks.filter((t) => {
        if (removed || t.status === "pending") return true;
        const title = t.title.toLowerCase();
        if (title.includes(search) || search.includes(title)) {
          removed = true;
          return false;
        }
        return true;
      });
      updates.tasks = currentTasks;
    } else if (call.name === "add_context") {
      const input = call.input as { content: string };
      currentContext = [...currentContext, input.content];
      updates.context = currentContext;
    } else if (call.name === "remove_context") {
      const input = call.input as { content: string };
      const lower = input.content.toLowerCase();
      currentContext = currentContext.filter(
        (c) => !c.toLowerCase().includes(lower) && !lower.includes(c.toLowerCase())
      );
      updates.context = currentContext;
    }
  }

  return updates;
}

// --- Build Claude API messages from chat messages ---

export function buildClaudeMessages(
  messages: ChatMessage[]
): { role: "user" | "assistant"; content: string }[] {
  const result: { role: "user" | "assistant"; content: string }[] = [];

  for (const msg of messages) {
    const role = msg.role === "user" || msg.type === "system" ? "user" : "assistant";
    const content = msg.text;

    // Merge consecutive same-role messages
    const last = result[result.length - 1];
    if (last && last.role === role) {
      last.content += "\n\n" + content;
    } else {
      result.push({ role, content });
    }
  }

  // Ensure messages start with user role (Claude API requirement)
  if (result.length > 0 && result[0].role !== "user") {
    result.unshift({ role: "user", content: "Hello" });
  }

  return result;
}
