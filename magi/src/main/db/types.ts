// ── Entity types ──

export interface Project {
  id: string;
  name: string;
  color: string | null;
  parent_id: string | null;
  view_mode: "list" | "map";
  is_inbox: number; // 0 | 1
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface Section {
  id: string;
  project_id: string;
  name: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export type TaskStatus = "active" | "completed" | "cancelled";

export interface Task {
  id: string;
  project_id: string;
  section_id: string | null;
  parent_id: string | null;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: number; // 1-4
  due_date: string | null;
  due_is_datetime: number; // 0 | 1
  duration_minutes: number | null;
  recurrence: string | null; // JSON-encoded RecurrenceRule
  sort_order: number;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Label {
  id: string;
  name: string;
  color: string | null;
  created_at: string;
}

export interface TaskLabel {
  task_id: string;
  label_id: string;
}

export interface Comment {
  id: string;
  task_id: string | null;
  project_id: string | null;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface ActivityLogEntry {
  id: string;
  entity_type: string;
  entity_id: string;
  action: string;
  details: string | null; // JSON
  created_at: string;
}

export interface WorkspaceItemRow {
  id: string;
  type: "folder" | "doc" | "project";
  name: string;
  parent_id: string | null;
  sort_order: number;
  collapsed: number | null;
  project_kind: "dummy" | null;
  created_at: string;
  updated_at: string;
}

export interface WorkspaceDocRow {
  doc_id: string;
  markdown: string;
  updated_at: string;
}

export interface WorkspaceMetaRow {
  key: string;
  value: string;
}

export interface RecurrenceRule {
  freq: "daily" | "weekly" | "monthly" | "yearly";
  interval?: number;
  days?: number[]; // 0=Sun … 6=Sat
}

// ── Input types ──

export interface CreateProjectInput {
  name: string;
  color?: string | null;
  parent_id?: string | null;
  view_mode?: "list" | "map";
  is_inbox?: number;
  sort_order?: number;
}

export interface UpdateProjectInput {
  name?: string;
  color?: string | null;
  parent_id?: string | null;
  view_mode?: "list" | "map";
  sort_order?: number;
}

export interface CreateSectionInput {
  project_id: string;
  name: string;
  sort_order?: number;
}

export interface UpdateSectionInput {
  name?: string;
  sort_order?: number;
}

export interface CreateTaskInput {
  project_id?: string;
  section_id?: string | null;
  parent_id?: string | null;
  title: string;
  description?: string | null;
  priority?: number;
  due_date?: string | null;
  due_is_datetime?: number;
  duration_minutes?: number | null;
  recurrence?: string | null;
  sort_order?: number;
}

export interface UpdateTaskInput {
  project_id?: string;
  section_id?: string | null;
  parent_id?: string | null;
  title?: string;
  description?: string | null;
  status?: TaskStatus;
  priority?: number;
  due_date?: string | null;
  due_is_datetime?: number;
  duration_minutes?: number | null;
  recurrence?: string | null;
  sort_order?: number;
}

export interface TaskListFilter {
  project_id?: string;
  section_id?: string;
  status?: TaskStatus;
  priority?: number;
  due_before?: string;
  due_after?: string;
  parent_id?: string | null;
}

export interface CreateCommentInput {
  task_id?: string | null;
  project_id?: string | null;
  content: string;
}

export interface UpdateCommentInput {
  content: string;
}

export interface ActivityLogQuery {
  entity_type?: string;
  entity_id?: string;
  action?: string;
  since?: string;
  until?: string;
  limit?: number;
}
