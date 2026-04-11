import {
  asNumber,
  asRecord,
  asString,
  deriveTone,
  getInput,
  getOutput,
  pluralize,
  quoted,
  taskTitleFromResult,
} from "./helpers";
import type { ToolFeedbackContext, ToolFeedbackMessage, ToolFeedbackModule } from "./types";

function failedFromRunning(runningLine: string): string {
  return `${runningLine.replace(/…$/, "")} failed`;
}

function byTone(params: {
  ctx: ToolFeedbackContext;
  running: string;
  done: ToolFeedbackMessage;
  actionKind: ToolFeedbackMessage["actionKind"];
}): ToolFeedbackMessage {
  const tone = deriveTone(params.ctx);
  if (tone === "running") {
    return { tone, line: params.running, actionKind: params.actionKind };
  }
  if (tone === "done") {
    return { ...params.done, tone, actionKind: params.actionKind };
  }
  return {
    tone,
    line: failedFromRunning(params.running),
    actionKind: params.actionKind,
  };
}

const overviewModule: ToolFeedbackModule = {
  matches: (toolName) => toolName === "get_overview",
  render: (ctx) => {
    const result = getOutput(ctx);
    const stats = asRecord(result.stats);
    const overdue = asNumber(stats?.overdue);
    const dueToday = asNumber(stats?.due_today);
    const detailParts: string[] = [];
    if (typeof overdue === "number") detailParts.push(`${overdue} overdue`);
    if (typeof dueToday === "number") detailParts.push(`${dueToday} due today`);

    return byTone({
      ctx,
      running: "Checking overview…",
      done: {
        tone: "done",
        line: "Checked overview",
        detail: detailParts.length > 0 ? detailParts.join(" · ") : undefined,
      },
      actionKind: "read",
    });
  },
};

const taskSearchModule: ToolFeedbackModule = {
  matches: (toolName) => toolName === "list_tasks" || toolName === "search_tasks",
  render: (ctx) => {
    const result = getOutput(ctx);
    const count = asNumber(result.count);

    return byTone({
      ctx,
      running: "Searching tasks…",
      done: {
        tone: "done",
        line:
          typeof count === "number"
            ? `Searched ${pluralize(count, "task")}`
            : "Searched tasks",
      },
      actionKind: "search",
    });
  },
};

const getTaskModule: ToolFeedbackModule = {
  matches: (toolName) => toolName === "get_task",
  render: (ctx) => {
    const result = getOutput(ctx);
    const title = asString(result.title);
    const id = asString(result.id);

    return byTone({
      ctx,
      running: "Fetching task…",
      done: {
        tone: "done",
        line: title ? `Fetched ${quoted(title)}` : id ? `Fetched task ${id}` : "Fetched task",
      },
      actionKind: "read",
    });
  },
};

const createTaskModule: ToolFeedbackModule = {
  matches: (toolName) => toolName === "create_task",
  render: (ctx) => {
    const input = getInput(ctx);
    const result = getOutput(ctx);
    const title = taskTitleFromResult(result) ?? asString(input.title);

    return byTone({
      ctx,
      running: "Creating task…",
      done: {
        tone: "done",
        line: title ? `Created ${quoted(title)}` : "Created task",
      },
      actionKind: "create",
    });
  },
};

const updateTaskModule: ToolFeedbackModule = {
  matches: (toolName) => toolName === "update_task",
  render: (ctx) => {
    const input = getInput(ctx);
    const result = getOutput(ctx);
    const title = taskTitleFromResult(result) ?? asString(input.title);
    const isCompletion = asString(input.status) === "completed";
    const running = isCompletion ? "Completing task…" : "Editing task…";
    const doneLineBase = isCompletion ? "Completed" : "Edited";

    return byTone({
      ctx,
      running,
      done: {
        tone: "done",
        line: title ? `${doneLineBase} ${quoted(title)}` : `${doneLineBase} task`,
      },
      actionKind: isCompletion ? "complete" : "update",
    });
  },
};

const deleteTaskModule: ToolFeedbackModule = {
  matches: (toolName) => toolName === "delete_task",
  render: (ctx) => {
    const result = getOutput(ctx);
    const deletedTitle = asString(result.deleted_title);
    const deletedId = asString(result.deleted);

    return byTone({
      ctx,
      running: "Deleting task…",
      done: {
        tone: "done",
        line: deletedTitle
          ? `Deleted ${quoted(deletedTitle)}`
          : deletedId
            ? `Deleted task ${deletedId}`
            : "Deleted task",
      },
      actionKind: "delete",
    });
  },
};

const manageProjectModule: ToolFeedbackModule = {
  matches: (toolName) => toolName === "manage_project",
  render: (ctx) => {
    const input = getInput(ctx);
    const result = getOutput(ctx);
    const action = asString(input.action);
    const project =
      asRecord(result.created) ??
      asRecord(result.updated) ??
      (result.deleted ? { id: result.deleted } : null);
    const projectName = asString(project?.name);
    const projectId = asString(project?.id);

    const running =
      action === "create"
        ? "Creating project…"
        : action === "delete"
          ? "Deleting project…"
          : "Updating project…";
    const doneVerb =
      action === "create" ? "Created" : action === "delete" ? "Deleted" : "Updated";

    return byTone({
      ctx,
      running,
      done: {
        tone: "done",
        line: projectName
          ? `${doneVerb} project ${quoted(projectName)}`
          : projectId
            ? `${doneVerb} project ${projectId}`
            : `${doneVerb} project`,
      },
      actionKind: "manage",
    });
  },
};

export const toolFeedbackModules: ToolFeedbackModule[] = [
  overviewModule,
  taskSearchModule,
  getTaskModule,
  createTaskModule,
  updateTaskModule,
  deleteTaskModule,
  manageProjectModule,
];
