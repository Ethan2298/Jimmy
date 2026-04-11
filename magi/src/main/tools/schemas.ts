import { z } from "zod";

export const getOverviewSchema = z.object({});

const dateOnlyRegex = /^\d{4}-\d{2}-\d{2}$/;
const dateTimeRegex =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/;

function isValidDateOnly(value: string): boolean {
  if (!dateOnlyRegex.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() + 1 === month &&
    date.getUTCDate() === day
  );
}

function isValidISODateOrDateTime(value: string): boolean {
  if (isValidDateOnly(value)) return true;
  if (!dateTimeRegex.test(value)) return false;
  const parsed = new Date(value);
  return !Number.isNaN(parsed.getTime());
}

const isoDateOrDateTime = z
  .string()
  .refine(
    isValidISODateOrDateTime,
    "Expected ISO date (YYYY-MM-DD) or ISO datetime string"
  );

export const listTasksSchema = z.object({
  project_id: z.string().optional().describe("Filter by project ID"),
  status: z.enum(["active", "completed", "cancelled"]).optional().describe("Filter by status"),
  priority: z.number().min(1).max(4).optional().describe("Filter by priority (1=urgent, 4=low)"),
  due_before: isoDateOrDateTime.optional().describe("ISO date — tasks due on or before this date"),
  due_after: isoDateOrDateTime.optional().describe("ISO date — tasks due on or after this date"),
  label: z.string().optional().describe("Filter by label name"),
});

export const getTaskSchema = z.object({
  task_id: z.string().describe("The task ID to retrieve"),
});

export const searchTasksSchema = z.object({
  query: z.string().describe("Search term to match against task title and description"),
  limit: z.number().optional().describe("Max results (default 50)"),
});

export const createTaskSchema = z.object({
  title: z.string().describe("Task title"),
  description: z.string().optional().describe("Task description"),
  project_id: z.string().optional().describe("Project ID (defaults to inbox)"),
  parent_id: z.string().optional().describe("Parent task ID for subtasks"),
  priority: z.number().min(1).max(4).optional().describe("Priority 1-4 (1=urgent, 4=low)"),
  due_date: isoDateOrDateTime.optional().describe("ISO date or datetime string"),
  labels: z.array(z.string()).optional().describe("Label names — created automatically if they don't exist"),
});

export const updateTaskSchema = z.object({
  task_id: z.string().describe("The task ID to update"),
  title: z.string().optional().describe("New title"),
  description: z.string().optional().describe("New description"),
  status: z.enum(["active", "completed", "cancelled"]).optional().describe("New status — 'completed' recursively completes subtasks"),
  priority: z.number().min(1).max(4).optional().describe("New priority"),
  due_date: isoDateOrDateTime.nullable().optional().describe("New due date or null to clear"),
  project_id: z.string().optional().describe("Move to a different project"),
  add_labels: z.array(z.string()).optional().describe("Label names to add"),
  remove_labels: z.array(z.string()).optional().describe("Label names to remove"),
});

export const deleteTaskSchema = z.object({
  task_id: z.string().describe("The task ID to delete"),
});

export const manageProjectSchema = z.object({
  action: z.enum(["create", "update", "delete"]).describe("Action to perform"),
  project_id: z.string().optional().describe("Required for update/delete"),
  name: z.string().optional().describe("Project name (required for create)"),
  color: z.string().nullable().optional().describe("Project color"),
  view_mode: z.enum(["list", "map"]).optional().describe("Project view mode"),
});
