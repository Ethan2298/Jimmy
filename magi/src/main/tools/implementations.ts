import { projects, tasks, labels, taskLabels } from "../db/queries";
import type { Task } from "../db/types";

const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function findOrCreateLabel(name: string) {
  const existing = labels.list().find((l) => l.name.toLowerCase() === name.toLowerCase());
  return existing ?? labels.create(name);
}

function todayISO(): string {
  return toLocalDateKey(new Date());
}

function toLocalDateKey(date: Date): string {
  const year = String(date.getFullYear());
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function normalizeDueDateInput(value: string): string {
  if (DATE_ONLY_REGEX.test(value)) {
    return value;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error("Invalid due_date format");
  }
  return parsed.toISOString();
}

function dueDateKey(value: string | null | undefined): string | null {
  if (!value) return null;
  if (DATE_ONLY_REGEX.test(value)) {
    return value;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return toLocalDateKey(parsed);
}

export function getOverview() {
  const today = todayISO();
  const allProjects = projects.list();
  const activeTasks = tasks.list({ status: "active" });
  const overdue = activeTasks.filter((t) => {
    const key = dueDateKey(t.due_date);
    return key !== null && key < today;
  });
  const dueToday = activeTasks.filter((t) => dueDateKey(t.due_date) === today);
  const recentCompleted = tasks.recentCompleted(10);

  return {
    today,
    projects: allProjects.map((p) => ({
      id: p.id,
      name: p.name,
      color: p.color,
      view_mode: p.view_mode,
    })),
    stats: {
      total_active: activeTasks.length,
      overdue: overdue.length,
      due_today: dueToday.length,
    },
    overdue_tasks: overdue.map(briefTask),
    today_tasks: dueToday.map(briefTask),
    recent_completed: recentCompleted.map(briefTask),
  };
}

export function listTasks(args: {
  project_id?: string;
  status?: string;
  priority?: number;
  due_before?: string;
  due_after?: string;
  label?: string;
}) {
  const dueBefore = args.due_before ? dueDateKey(args.due_before) : null;
  const dueAfter = args.due_after ? dueDateKey(args.due_after) : null;

  let result = tasks.list({
    project_id: args.project_id,
    status: args.status as Task["status"],
    priority: args.priority,
    due_before: undefined,
    due_after: undefined,
  });

  if (dueBefore || dueAfter) {
    result = result.filter((task) => {
      const key = dueDateKey(task.due_date);
      if (!key) return false;
      if (dueBefore && key > dueBefore) return false;
      if (dueAfter && key < dueAfter) return false;
      return true;
    });
  }

  if (args.label) {
    const allLabels = labels.list();
    const targetLabel = allLabels.find(
      (l) => l.name.toLowerCase() === args.label!.toLowerCase()
    );
    if (targetLabel) {
      result = result.filter((t) => {
        const tl = taskLabels.getForTask(t.id);
        return tl.some((l) => l.id === targetLabel.id);
      });
    } else {
      result = [];
    }
  }

  return { count: result.length, tasks: result.map(briefTask) };
}

export function getTask(args: { task_id: string }) {
  const task = tasks.get(args.task_id);
  if (!task) return { error: "Task not found" };

  const taskLabelList = taskLabels.getForTask(task.id);
  const subtasks = tasks.list({ parent_id: task.id });

  return {
    ...task,
    labels: taskLabelList.map((l) => ({ id: l.id, name: l.name, color: l.color })),
    subtasks: subtasks.map(briefTask),
  };
}

export function searchTasks(args: { query: string; limit?: number }) {
  const result = tasks.search(args.query, args.limit);
  return { count: result.length, tasks: result.map(briefTask) };
}

export function createTask(args: {
  title: string;
  description?: string;
  project_id?: string;
  parent_id?: string;
  priority?: number;
  due_date?: string;
  labels?: string[];
}) {
  const normalizedDueDate = args.due_date
    ? normalizeDueDateInput(args.due_date)
    : undefined;

  const task = tasks.create({
    title: args.title,
    description: args.description,
    project_id: args.project_id,
    parent_id: args.parent_id,
    priority: args.priority,
    due_date: normalizedDueDate,
  });

  if (args.labels?.length) {
    for (const name of args.labels) {
      const label = findOrCreateLabel(name);
      taskLabels.add(task.id, label.id);
    }
  }

  return { created: briefTask(task) };
}

export function updateTask(args: {
  task_id: string;
  title?: string;
  description?: string;
  status?: string;
  priority?: number;
  due_date?: string | null;
  project_id?: string;
  add_labels?: string[];
  remove_labels?: string[];
}) {
  const existing = tasks.get(args.task_id);
  if (!existing) return { error: "Task not found" };

  let normalizedDueDate: string | null | undefined = undefined;
  if (args.due_date !== undefined) {
    normalizedDueDate =
      args.due_date === null ? null : normalizeDueDateInput(args.due_date);
  }

  // Apply field updates (excluding status) first
  const hasFieldUpdates =
    args.title !== undefined ||
    args.description !== undefined ||
    args.priority !== undefined ||
    args.due_date !== undefined ||
    args.project_id !== undefined;
  if (hasFieldUpdates || (args.status && args.status !== "completed")) {
    tasks.update(args.task_id, {
      title: args.title,
      description: args.description,
      status: args.status === "completed" ? undefined : args.status as Task["status"],
      priority: args.priority,
      due_date: normalizedDueDate,
      project_id: args.project_id,
    });
  }

  // Handle completion via recursive complete() (after field updates)
  if (args.status === "completed") {
    tasks.complete(args.task_id);
  }

  // Handle label changes
  if (args.add_labels?.length) {
    for (const name of args.add_labels) {
      const label = findOrCreateLabel(name);
      taskLabels.add(args.task_id, label.id);
    }
  }

  if (args.remove_labels?.length) {
    for (const name of args.remove_labels) {
      const label = labels.list().find((l) => l.name.toLowerCase() === name.toLowerCase());
      if (label) {
        taskLabels.remove(args.task_id, label.id);
      }
    }
  }

  const updated = tasks.get(args.task_id);
  return { updated: updated ? briefTask(updated) : null };
}

export function deleteTask(args: { task_id: string }) {
  const existing = tasks.get(args.task_id);
  if (!existing) return { error: "Task not found" };
  tasks.delete(args.task_id);
  return { deleted: args.task_id, deleted_title: existing.title };
}

export function manageProject(args: {
  action: "create" | "update" | "delete";
  project_id?: string;
  name?: string;
  color?: string | null;
  view_mode?: "list" | "map";
}) {
  switch (args.action) {
    case "create": {
      if (!args.name) return { error: "Name required for create" };
      const project = projects.create({
        name: args.name,
        color: args.color,
        view_mode: args.view_mode,
      });
      return {
        created: {
          id: project.id,
          name: project.name,
          color: project.color,
          view_mode: project.view_mode,
        },
      };
    }
    case "update": {
      if (!args.project_id) return { error: "project_id required for update" };
      const project = projects.update(args.project_id, {
        name: args.name,
        color: args.color,
        view_mode: args.view_mode,
      });
      if (!project) return { error: "Project not found" };
      return {
        updated: {
          id: project.id,
          name: project.name,
          color: project.color,
          view_mode: project.view_mode,
        },
      };
    }
    case "delete": {
      if (!args.project_id) return { error: "project_id required for delete" };
      projects.delete(args.project_id);
      return { deleted: args.project_id };
    }
  }
}

function briefTask(t: Task) {
  return {
    id: t.id,
    title: t.title,
    status: t.status,
    priority: t.priority,
    due_date: t.due_date,
    project_id: t.project_id,
  };
}
