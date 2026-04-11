type RecordValue = Record<string, unknown>;

const MAX_TASKS = 25;
const MAX_STRING = 240;

export function summarizeToolResult(
  toolName: string | undefined,
  args: unknown,
  output: unknown
): unknown {
  const safeToolName = toolName ?? "unknown";
  const result = asRecord(output);

  if (!result) {
    return sanitizeUnknown(output);
  }

  if (typeof result.error === "string") {
    return { error: truncateString(result.error) };
  }

  switch (safeToolName) {
    case "get_overview":
      return summarizeOverview(result);
    case "list_tasks":
    case "search_tasks":
      return summarizeTaskList(result);
    case "get_task":
      return summarizeTaskDetails(result);
    case "create_task":
    case "update_task":
    case "delete_task":
      return summarizeTaskMutation(result);
    case "manage_project":
      return summarizeProjectMutation(result, args);
    default:
      return sanitizeUnknown(result);
  }
}

function summarizeOverview(result: RecordValue) {
  return {
    today: maybeString(result.today),
    stats: sanitizeUnknown(result.stats),
    projects: sanitizeProjects(result.projects),
    overdue_tasks: sanitizeTaskArray(result.overdue_tasks),
    today_tasks: sanitizeTaskArray(result.today_tasks),
    recent_completed: sanitizeTaskArray(result.recent_completed),
  };
}

function summarizeTaskList(result: RecordValue) {
  return {
    count: typeof result.count === "number" ? result.count : undefined,
    tasks: sanitizeTaskArray(result.tasks),
  };
}

function summarizeTaskDetails(result: RecordValue) {
  return {
    id: maybeString(result.id),
    title: maybeString(result.title),
    status: maybeString(result.status),
    priority: maybeNumber(result.priority),
    due_date: maybeString(result.due_date),
    project_id: maybeString(result.project_id),
    labels: sanitizeLabels(result.labels),
    subtasks: sanitizeTaskArray(result.subtasks),
  };
}

function summarizeTaskMutation(result: RecordValue) {
  if (result.created) {
    return { created: sanitizeTask(result.created) };
  }
  if (result.updated) {
    return { updated: sanitizeTask(result.updated) };
  }
  return {
    deleted: maybeString(result.deleted),
    deleted_title: maybeString(result.deleted_title),
  };
}

function summarizeProjectMutation(result: RecordValue, args: unknown) {
  const argsRec = asRecord(args);
  return {
    action: maybeString(argsRec?.action),
    created: sanitizeProject(result.created),
    updated: sanitizeProject(result.updated),
    deleted: maybeString(result.deleted),
  };
}

function sanitizeTaskArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, MAX_TASKS).map(sanitizeTask);
}

function sanitizeLabels(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, MAX_TASKS).map((item) => {
    const rec = asRecord(item);
    return {
      id: maybeString(rec?.id),
      name: maybeString(rec?.name),
      color: maybeString(rec?.color),
    };
  });
}

function sanitizeProjects(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, MAX_TASKS).map(sanitizeProject);
}

function sanitizeProject(value: unknown) {
  const rec = asRecord(value);
  if (!rec) return undefined;
  return {
    id: maybeString(rec.id),
    name: maybeString(rec.name),
    color: maybeString(rec.color),
    view_mode: maybeString(rec.view_mode),
  };
}

function sanitizeTask(value: unknown) {
  const rec = asRecord(value);
  if (!rec) return undefined;
  return {
    id: maybeString(rec.id),
    title: maybeString(rec.title),
    status: maybeString(rec.status),
    priority: maybeNumber(rec.priority),
    due_date: maybeString(rec.due_date),
    project_id: maybeString(rec.project_id),
  };
}

function sanitizeUnknown(value: unknown): unknown {
  if (typeof value === "string") return truncateString(value);
  if (typeof value === "number" || typeof value === "boolean" || value === null) return value;

  if (Array.isArray(value)) {
    return value.slice(0, MAX_TASKS).map((item) => sanitizeUnknown(item));
  }

  const rec = asRecord(value);
  if (!rec) return undefined;

  const out: RecordValue = {};
  for (const [key, nested] of Object.entries(rec)) {
    if (key === "description" || key === "content") continue;
    out[key] = sanitizeUnknown(nested);
  }
  return out;
}

function maybeString(value: unknown): string | undefined {
  return typeof value === "string" ? truncateString(value) : undefined;
}

function maybeNumber(value: unknown): number | undefined {
  return typeof value === "number" ? value : undefined;
}

function asRecord(value: unknown): RecordValue | null {
  return value && typeof value === "object" ? (value as RecordValue) : null;
}

function truncateString(value: string): string {
  if (value.length <= MAX_STRING) return value;
  return `${value.slice(0, MAX_STRING - 1)}…`;
}
