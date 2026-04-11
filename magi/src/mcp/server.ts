import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import path from "path";
import { initTaskDb } from "../main/db/index";
import {
  getOverviewSchema,
  listTasksSchema,
  getTaskSchema,
  searchTasksSchema,
  createTaskSchema,
  updateTaskSchema,
  deleteTaskSchema,
  manageProjectSchema,
} from "../main/tools/schemas";
import * as impl from "../main/tools/implementations";

function getDbPath(): string {
  return path.join(path.resolve(__dirname, "../.."), "project-magi.db");
}

// Initialize the database
initTaskDb(getDbPath());

const server = new McpServer({
  name: "project-magi-tasks",
  version: "0.1.0",
});

function jsonContent(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

function errorContent(err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  return { content: [{ type: "text" as const, text: JSON.stringify({ error: message }) }], isError: true as const };
}

function wrap<T>(fn: () => T) {
  try {
    return jsonContent(fn());
  } catch (err) {
    return errorContent(err);
  }
}

server.tool("get_overview", "Get an overview of all projects, today's tasks, overdue tasks, recent completions, and stats.", getOverviewSchema.shape, async () => {
  return wrap(() => impl.getOverview());
});

server.tool("list_tasks", "List tasks with optional filters for project, status, priority, due date, or label.", listTasksSchema.shape, async (args) => {
  return wrap(() => impl.listTasks(args));
});

server.tool("get_task", "Get a single task with its labels and subtasks.", getTaskSchema.shape, async (args) => {
  return wrap(() => impl.getTask(args));
});

server.tool("search_tasks", "Search tasks by title or description.", searchTasksSchema.shape, async (args) => {
  return wrap(() => impl.searchTasks(args));
});

server.tool("create_task", "Create a new task with optional labels, due date, priority, project, and parent task.", createTaskSchema.shape, async (args) => {
  return wrap(() => impl.createTask(args));
});

server.tool("update_task", "Update a task's fields, complete it, or add/remove labels.", updateTaskSchema.shape, async (args) => {
  return wrap(() => impl.updateTask(args));
});

server.tool("delete_task", "Delete a task by ID.", deleteTaskSchema.shape, async (args) => {
  return wrap(() => impl.deleteTask(args));
});

server.tool("manage_project", "Create, update, or delete a project.", manageProjectSchema.shape, async (args) => {
  return wrap(() => impl.manageProject(args));
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("[mcp] project-magi-tasks server running on stdio");
}

main().catch((err) => {
  console.error("[mcp] Fatal error:", err);
  process.exit(1);
});
