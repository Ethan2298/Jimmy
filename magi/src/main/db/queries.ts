import crypto from "crypto";
import Database from "better-sqlite3";
import { getTaskDb } from "./index";
import type {
  Project,
  Section,
  Task,
  Label,
  TaskLabel,
  Comment,
  ActivityLogEntry,
  CreateProjectInput,
  UpdateProjectInput,
  CreateSectionInput,
  UpdateSectionInput,
  CreateTaskInput,
  UpdateTaskInput,
  TaskListFilter,
  CreateCommentInput,
  UpdateCommentInput,
  ActivityLogQuery,
  WorkspaceDocRow,
  WorkspaceItemRow,
  WorkspaceMetaRow,
} from "./types";
import type {
  WorkspaceAddItemInput,
  WorkspaceDeleteItemInput,
  WorkspaceMainView,
  WorkspaceMoveItemInput,
  WorkspaceRenameItemInput,
  WorkspaceSaveUiInput,
  WorkspaceSortOrderPair,
  WorkspaceSnapshot,
  WorkspaceToggleCollapsedInput,
} from "../../shared/workspace";

const MAX_TASK_DEPTH = 5;

/** Returns the depth of a task (top-level = 1). */
function getTaskDepth(db: Database.Database, taskId: string): number {
  const row = db.prepare(`
    WITH RECURSIVE ancestors(id, parent_id, depth) AS (
      SELECT id, parent_id, 1 FROM tasks WHERE id = @taskId
      UNION ALL
      SELECT t.id, t.parent_id, a.depth + 1
      FROM tasks t JOIN ancestors a ON t.id = a.parent_id
      WHERE a.parent_id IS NOT NULL
    )
    SELECT MAX(depth) AS depth FROM ancestors
  `).get({ taskId }) as { depth: number } | undefined;
  return row?.depth ?? 0;
}

/** Returns the max depth of the subtree below a task (0 if leaf). */
function getMaxSubtreeDepth(db: Database.Database, taskId: string): number {
  const row = db.prepare(`
    WITH RECURSIVE descendants(id, depth) AS (
      SELECT id, 0 FROM tasks WHERE parent_id = @taskId
      UNION ALL
      SELECT t.id, d.depth + 1
      FROM tasks t JOIN descendants d ON t.parent_id = d.id
    )
    SELECT COALESCE(MAX(depth) + 1, 0) AS depth FROM descendants
  `).get({ taskId }) as { depth: number };
  return row.depth;
}

// ── Projects ──

export const projects = {
  create(input: CreateProjectInput): Project {
    const db = getTaskDb();
    const id = crypto.randomUUID();
    db.prepare(`
      INSERT INTO projects (id, name, color, parent_id, view_mode, is_inbox, sort_order)
      VALUES (@id, @name, @color, @parent_id, @view_mode, @is_inbox, @sort_order)
    `).run({
      id,
      name: input.name,
      color: input.color ?? null,
      parent_id: input.parent_id ?? null,
      view_mode: input.view_mode ?? "list",
      is_inbox: input.is_inbox ?? 0,
      sort_order: input.sort_order ?? 0,
    });
    activityLog.log("project", id, "created");
    return db.prepare("SELECT * FROM projects WHERE id = @id").get({ id }) as Project;
  },

  update(id: string, input: UpdateProjectInput): Project | undefined {
    const db = getTaskDb();
    const fields: string[] = [];
    const params: Record<string, unknown> = { id };

    if (input.name !== undefined) { fields.push("name = @name"); params.name = input.name; }
    if (input.color !== undefined) { fields.push("color = @color"); params.color = input.color; }
    if (input.parent_id !== undefined) { fields.push("parent_id = @parent_id"); params.parent_id = input.parent_id; }
    if (input.view_mode !== undefined) { fields.push("view_mode = @view_mode"); params.view_mode = input.view_mode; }
    if (input.sort_order !== undefined) { fields.push("sort_order = @sort_order"); params.sort_order = input.sort_order; }

    if (fields.length === 0) return projects.get(id);

    db.prepare(`UPDATE projects SET ${fields.join(", ")} WHERE id = @id`).run(params);
    activityLog.log("project", id, "updated");
    return db.prepare("SELECT * FROM projects WHERE id = @id").get({ id }) as Project | undefined;
  },

  delete(id: string): void {
    const db = getTaskDb();
    const result = db.prepare("DELETE FROM projects WHERE id = @id AND is_inbox = 0").run({ id });
    if (result.changes > 0) activityLog.log("project", id, "deleted");
  },

  get(id: string): Project | undefined {
    const db = getTaskDb();
    return db.prepare("SELECT * FROM projects WHERE id = @id").get({ id }) as Project | undefined;
  },

  list(): Project[] {
    const db = getTaskDb();
    return db.prepare("SELECT * FROM projects ORDER BY sort_order, name").all() as Project[];
  },
};

// ── Sections ──

export const sections = {
  create(input: CreateSectionInput): Section {
    const db = getTaskDb();
    const id = crypto.randomUUID();
    db.prepare(`
      INSERT INTO sections (id, project_id, name, sort_order)
      VALUES (@id, @project_id, @name, @sort_order)
    `).run({
      id,
      project_id: input.project_id,
      name: input.name,
      sort_order: input.sort_order ?? 0,
    });
    activityLog.log("section", id, "created");
    return db.prepare("SELECT * FROM sections WHERE id = @id").get({ id }) as Section;
  },

  update(id: string, input: UpdateSectionInput): Section | undefined {
    const db = getTaskDb();
    const fields: string[] = [];
    const params: Record<string, unknown> = { id };

    if (input.name !== undefined) { fields.push("name = @name"); params.name = input.name; }
    if (input.sort_order !== undefined) { fields.push("sort_order = @sort_order"); params.sort_order = input.sort_order; }

    if (fields.length === 0) return db.prepare("SELECT * FROM sections WHERE id = @id").get({ id }) as Section | undefined;

    db.prepare(`UPDATE sections SET ${fields.join(", ")} WHERE id = @id`).run(params);
    activityLog.log("section", id, "updated");
    return db.prepare("SELECT * FROM sections WHERE id = @id").get({ id }) as Section | undefined;
  },

  delete(id: string): void {
    const db = getTaskDb();
    const result = db.prepare("DELETE FROM sections WHERE id = @id").run({ id });
    if (result.changes > 0) activityLog.log("section", id, "deleted");
  },

  list(projectId: string): Section[] {
    const db = getTaskDb();
    return db.prepare("SELECT * FROM sections WHERE project_id = @project_id ORDER BY sort_order, name")
      .all({ project_id: projectId }) as Section[];
  },

  reorder(sectionIds: string[]): void {
    const db = getTaskDb();
    const stmt = db.prepare("UPDATE sections SET sort_order = @sort_order WHERE id = @id");
    db.transaction(() => {
      for (let i = 0; i < sectionIds.length; i++) {
        stmt.run({ id: sectionIds[i], sort_order: i });
      }
    })();
  },
};

// ── Tasks ──

export const tasks = {
  create(input: CreateTaskInput): Task {
    const db = getTaskDb();
    if (input.parent_id) {
      const parentDepth = getTaskDepth(db, input.parent_id);
      if (parentDepth + 1 > MAX_TASK_DEPTH) {
        throw new Error(`Cannot nest tasks deeper than ${MAX_TASK_DEPTH} levels`);
      }
    }
    const id = crypto.randomUUID();
    db.prepare(`
      INSERT INTO tasks (id, project_id, section_id, parent_id, title, description,
                         priority, due_date, due_is_datetime, duration_minutes, recurrence, sort_order)
      VALUES (@id, @project_id, @section_id, @parent_id, @title, @description,
              @priority, @due_date, @due_is_datetime, @duration_minutes, @recurrence, @sort_order)
    `).run({
      id,
      project_id: input.project_id ?? "inbox",
      section_id: input.section_id ?? null,
      parent_id: input.parent_id ?? null,
      title: input.title,
      description: input.description ?? null,
      priority: input.priority ?? 4,
      due_date: input.due_date ?? null,
      due_is_datetime: input.due_is_datetime ?? 0,
      duration_minutes: input.duration_minutes ?? null,
      recurrence: input.recurrence ?? null,
      sort_order: input.sort_order ?? 0,
    });
    activityLog.log("task", id, "created");
    return db.prepare("SELECT * FROM tasks WHERE id = @id").get({ id }) as Task;
  },

  update(id: string, input: UpdateTaskInput): Task | undefined {
    const db = getTaskDb();
    const fields: string[] = [];
    const params: Record<string, unknown> = { id };

    if (input.project_id !== undefined) { fields.push("project_id = @project_id"); params.project_id = input.project_id; }
    if (input.section_id !== undefined) { fields.push("section_id = @section_id"); params.section_id = input.section_id; }
    if (input.parent_id !== undefined) { fields.push("parent_id = @parent_id"); params.parent_id = input.parent_id; }
    if (input.title !== undefined) { fields.push("title = @title"); params.title = input.title; }
    if (input.description !== undefined) { fields.push("description = @description"); params.description = input.description; }
    if (input.status !== undefined) { fields.push("status = @status"); params.status = input.status; }
    if (input.priority !== undefined) { fields.push("priority = @priority"); params.priority = input.priority; }
    if (input.due_date !== undefined) { fields.push("due_date = @due_date"); params.due_date = input.due_date; }
    if (input.due_is_datetime !== undefined) { fields.push("due_is_datetime = @due_is_datetime"); params.due_is_datetime = input.due_is_datetime; }
    if (input.duration_minutes !== undefined) { fields.push("duration_minutes = @duration_minutes"); params.duration_minutes = input.duration_minutes; }
    if (input.recurrence !== undefined) { fields.push("recurrence = @recurrence"); params.recurrence = input.recurrence; }
    if (input.sort_order !== undefined) { fields.push("sort_order = @sort_order"); params.sort_order = input.sort_order; }

    if (fields.length === 0) return tasks.get(id);

    if (input.parent_id !== undefined && input.parent_id !== null) {
      const newParentDepth = getTaskDepth(db, input.parent_id);
      const subtreeBelow = getMaxSubtreeDepth(db, id);
      if (newParentDepth + 1 + subtreeBelow > MAX_TASK_DEPTH) {
        throw new Error(`Cannot nest tasks deeper than ${MAX_TASK_DEPTH} levels`);
      }
    }

    db.prepare(`UPDATE tasks SET ${fields.join(", ")} WHERE id = @id`).run(params);
    activityLog.log("task", id, "updated");
    return db.prepare("SELECT * FROM tasks WHERE id = @id").get({ id }) as Task | undefined;
  },

  complete(id: string): Task | undefined {
    const db = getTaskDb();
    db.transaction(() => {
      db.prepare(`
        WITH RECURSIVE descendants(id) AS (
          SELECT id FROM tasks WHERE id = @id
          UNION ALL
          SELECT t.id FROM tasks t JOIN descendants d ON t.parent_id = d.id
        )
        UPDATE tasks SET status = 'completed', completed_at = datetime('now')
        WHERE id IN (SELECT id FROM descendants)
          AND status != 'completed'
      `).run({ id });
      activityLog.log("task", id, "completed");
    })();
    return db.prepare("SELECT * FROM tasks WHERE id = @id").get({ id }) as Task | undefined;
  },

  delete(id: string): void {
    const db = getTaskDb();
    const result = db.prepare("DELETE FROM tasks WHERE id = @id").run({ id });
    if (result.changes > 0) activityLog.log("task", id, "deleted");
  },

  get(id: string): Task | undefined {
    const db = getTaskDb();
    return db.prepare("SELECT * FROM tasks WHERE id = @id").get({ id }) as Task | undefined;
  },

  list(filter: TaskListFilter = {}): Task[] {
    const db = getTaskDb();
    const conditions: string[] = [];
    const params: Record<string, unknown> = {};

    if (filter.project_id !== undefined) { conditions.push("project_id = @project_id"); params.project_id = filter.project_id; }
    if (filter.section_id !== undefined) { conditions.push("section_id = @section_id"); params.section_id = filter.section_id; }
    if (filter.status !== undefined) { conditions.push("status = @status"); params.status = filter.status; }
    if (filter.priority !== undefined) { conditions.push("priority = @priority"); params.priority = filter.priority; }
    if (filter.due_before !== undefined) { conditions.push("due_date <= @due_before"); params.due_before = filter.due_before; }
    if (filter.due_after !== undefined) { conditions.push("due_date >= @due_after"); params.due_after = filter.due_after; }
    if (filter.parent_id !== undefined) {
      if (filter.parent_id === null) {
        conditions.push("parent_id IS NULL");
      } else {
        conditions.push("parent_id = @parent_id");
        params.parent_id = filter.parent_id;
      }
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    return db.prepare(`SELECT * FROM tasks ${where} ORDER BY sort_order, created_at`).all(params) as Task[];
  },

  reorder(taskIds: string[]): void {
    const db = getTaskDb();
    const stmt = db.prepare("UPDATE tasks SET sort_order = @sort_order WHERE id = @id");
    db.transaction(() => {
      for (let i = 0; i < taskIds.length; i++) {
        stmt.run({ id: taskIds[i], sort_order: i });
      }
    })();
  },

  recentCompleted(limit = 10): Task[] {
    const db = getTaskDb();
    return db.prepare(`
      SELECT * FROM tasks
      WHERE status = 'completed'
      ORDER BY completed_at DESC
      LIMIT @limit
    `).all({ limit }) as Task[];
  },

  search(query: string, limit = 50): Task[] {
    const db = getTaskDb();
    const pattern = `%${query}%`;
    return db.prepare(`
      SELECT * FROM tasks
      WHERE title LIKE @pattern OR description LIKE @pattern
      ORDER BY
        CASE WHEN status = 'active' THEN 0 ELSE 1 END,
        updated_at DESC
      LIMIT @limit
    `).all({ pattern, limit }) as Task[];
  },
};

// ── Labels ──

export const labels = {
  create(name: string, color?: string | null): Label {
    const db = getTaskDb();
    const id = crypto.randomUUID();
    db.prepare(`
      INSERT INTO labels (id, name, color) VALUES (@id, @name, @color)
    `).run({ id, name, color: color ?? null });
    return db.prepare("SELECT * FROM labels WHERE id = @id").get({ id }) as Label;
  },

  delete(id: string): void {
    const db = getTaskDb();
    db.prepare("DELETE FROM labels WHERE id = @id").run({ id });
  },

  list(): Label[] {
    const db = getTaskDb();
    return db.prepare("SELECT * FROM labels ORDER BY name").all() as Label[];
  },
};

// ── Task Labels ──

export const taskLabels = {
  add(taskId: string, labelId: string): void {
    const db = getTaskDb();
    db.prepare(`
      INSERT OR IGNORE INTO task_labels (task_id, label_id) VALUES (@task_id, @label_id)
    `).run({ task_id: taskId, label_id: labelId });
  },

  remove(taskId: string, labelId: string): void {
    const db = getTaskDb();
    db.prepare("DELETE FROM task_labels WHERE task_id = @task_id AND label_id = @label_id")
      .run({ task_id: taskId, label_id: labelId });
  },

  getForTask(taskId: string): Label[] {
    const db = getTaskDb();
    return db.prepare(`
      SELECT l.* FROM labels l
      INNER JOIN task_labels tl ON tl.label_id = l.id
      WHERE tl.task_id = @task_id
      ORDER BY l.name
    `).all({ task_id: taskId }) as Label[];
  },
};

// ── Comments ──

export const comments = {
  create(input: CreateCommentInput): Comment {
    const db = getTaskDb();
    const id = crypto.randomUUID();
    db.prepare(`
      INSERT INTO comments (id, task_id, project_id, content)
      VALUES (@id, @task_id, @project_id, @content)
    `).run({
      id,
      task_id: input.task_id ?? null,
      project_id: input.project_id ?? null,
      content: input.content,
    });
    const entityId = input.task_id ?? input.project_id;
    if (entityId) {
      const entityType = input.task_id ? "task" : "project";
      activityLog.log(entityType, entityId, "comment_added", JSON.stringify({ comment_id: id }));
    }
    return db.prepare("SELECT * FROM comments WHERE id = @id").get({ id }) as Comment;
  },

  update(id: string, input: UpdateCommentInput): Comment | undefined {
    const db = getTaskDb();
    db.prepare("UPDATE comments SET content = @content WHERE id = @id")
      .run({ id, content: input.content });
    return db.prepare("SELECT * FROM comments WHERE id = @id").get({ id }) as Comment | undefined;
  },

  delete(id: string): void {
    const db = getTaskDb();
    db.prepare("DELETE FROM comments WHERE id = @id").run({ id });
  },

  list(opts: { task_id?: string; project_id?: string }): Comment[] {
    const db = getTaskDb();
    const conditions: string[] = [];
    const params: Record<string, unknown> = {};

    if (opts.task_id !== undefined) { conditions.push("task_id = @task_id"); params.task_id = opts.task_id; }
    if (opts.project_id !== undefined) { conditions.push("project_id = @project_id"); params.project_id = opts.project_id; }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    return db.prepare(`SELECT * FROM comments ${where} ORDER BY created_at`).all(params) as Comment[];
  },
};

// ── Activity Log ──

export const activityLog = {
  log(entityType: string, entityId: string, action: string, details?: string): void {
    const db = getTaskDb();
    const id = crypto.randomUUID();
    db.prepare(`
      INSERT INTO activity_log (id, entity_type, entity_id, action, details)
      VALUES (@id, @entity_type, @entity_id, @action, @details)
    `).run({
      id,
      entity_type: entityType,
      entity_id: entityId,
      action,
      details: details ?? null,
    });
  },

  query(opts: ActivityLogQuery = {}): ActivityLogEntry[] {
    const db = getTaskDb();
    const conditions: string[] = [];
    const params: Record<string, unknown> = {};

    if (opts.entity_type) { conditions.push("entity_type = @entity_type"); params.entity_type = opts.entity_type; }
    if (opts.entity_id) { conditions.push("entity_id = @entity_id"); params.entity_id = opts.entity_id; }
    if (opts.action) { conditions.push("action = @action"); params.action = opts.action; }
    if (opts.since) { conditions.push("created_at >= @since"); params.since = opts.since; }
    if (opts.until) { conditions.push("created_at <= @until"); params.until = opts.until; }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const safeLimit = Number.isFinite(opts.limit) ? Math.min(opts.limit!, 10000) : 1000;
    return db.prepare(`SELECT * FROM activity_log ${where} ORDER BY created_at DESC LIMIT ${safeLimit}`)
      .all(params) as ActivityLogEntry[];
  },
};

function normalizeWorkspaceItemType(value: unknown): "folder" | "doc" | "project" {
  if (value === "folder" || value === "doc" || value === "project") return value;
  return "doc";
}

function normalizeWorkspaceMainView(
  value: WorkspaceMainView,
  items: Record<string, WorkspaceSnapshot["items"][string]>
): WorkspaceMainView {
  if (value.type !== "workspace-item") return { type: "chat" };
  const item = items[value.itemId];
  if (!item || (item.type !== "doc" && item.type !== "project")) {
    return { type: "chat" };
  }
  return { type: "workspace-item", itemId: item.id };
}

function sanitizeWorkspaceSnapshot(input: WorkspaceSnapshot): WorkspaceSnapshot {
  const items: WorkspaceSnapshot["items"] = {};

  for (const [id, item] of Object.entries(input.items)) {
    if (!id || typeof id !== "string") continue;
    if (!item || typeof item !== "object") continue;
    const type = normalizeWorkspaceItemType(item.type);
    const name = typeof item.name === "string" ? item.name : "Untitled";
    const sortOrder = Number.isFinite(item.sortOrder) ? Math.floor(item.sortOrder) : 0;
    const parentId = typeof item.parentId === "string" && item.parentId ? item.parentId : null;
    const normalized = {
      id,
      type,
      name,
      parentId,
      sortOrder,
      collapsed: type === "folder" && typeof item.collapsed === "boolean" ? item.collapsed : undefined,
      projectKind: type === "project" ? "dummy" : undefined,
    } satisfies WorkspaceSnapshot["items"][string];
    items[id] = normalized;
  }

  if (Object.keys(items).length === 0) {
    throw new Error("Workspace snapshot has no valid items.");
  }

  const rootIds: string[] = [];
  const seenRootIds = new Set<string>();
  for (const id of input.rootIds) {
    const item = items[id];
    if (!item || item.parentId !== null || seenRootIds.has(id)) continue;
    rootIds.push(id);
    seenRootIds.add(id);
  }
  if (rootIds.length === 0) {
    const computed = Object.values(items)
      .filter((item) => item.parentId === null)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id))
      .map((item) => item.id);
    rootIds.push(...computed);
  }

  const selectedId =
    input.selectedId && items[input.selectedId] ? input.selectedId : null;

  const docContentById: Record<string, string> = {};
  for (const item of Object.values(items)) {
    if (item.type !== "doc") continue;
    const markdown = input.docContentById[item.id];
    docContentById[item.id] = typeof markdown === "string" ? markdown : "";
  }

  const mainView = normalizeWorkspaceMainView(input.mainView, items);

  return {
    items,
    docContentById,
    rootIds,
    selectedId,
    editingId: null,
    mainView,
  };
}

function sortWorkspaceItemsForInsert(
  items: Record<string, WorkspaceSnapshot["items"][string]>
): WorkspaceSnapshot["items"][string][] {
  const pending = new Map<string, WorkspaceSnapshot["items"][string]>(Object.entries(items));
  const inserted = new Set<string>();
  const ordered: WorkspaceSnapshot["items"][string][] = [];

  while (pending.size > 0) {
    let progressed = false;

    for (const [id, item] of pending.entries()) {
      if (!item.parentId || inserted.has(item.parentId) || !items[item.parentId]) {
        ordered.push({
          ...item,
          parentId: item.parentId && items[item.parentId] ? item.parentId : null,
        });
        inserted.add(id);
        pending.delete(id);
        progressed = true;
      }
    }

    if (!progressed) {
      throw new Error("Workspace snapshot contains circular parent references.");
    }
  }

  return ordered;
}

export const workspace = {
  loadSnapshot(): WorkspaceSnapshot | null {
    const db = getTaskDb();
    const itemRows = db.prepare(`
      SELECT id, type, name, parent_id, sort_order, collapsed, project_kind, created_at, updated_at
      FROM workspace_items
      ORDER BY sort_order, id
    `).all() as WorkspaceItemRow[];

    if (itemRows.length === 0) return null;

    const items: WorkspaceSnapshot["items"] = {};
    for (const row of itemRows) {
      const type = normalizeWorkspaceItemType(row.type);
      items[row.id] = {
        id: row.id,
        type,
        name: row.name,
        parentId: row.parent_id,
        sortOrder: row.sort_order,
        collapsed: type === "folder" ? row.collapsed === 1 : undefined,
        projectKind: type === "project" ? "dummy" : undefined,
      };
    }

    const docRows = db.prepare(`
      SELECT doc_id, markdown, updated_at
      FROM workspace_docs
    `).all() as WorkspaceDocRow[];
    const markdownById = new Map(docRows.map((row) => [row.doc_id, row.markdown]));

    const docContentById: Record<string, string> = {};
    for (const item of Object.values(items)) {
      if (item.type !== "doc") continue;
      docContentById[item.id] = markdownById.get(item.id) ?? "";
    }

    const rootIds = Object.values(items)
      .filter((item) => item.parentId === null)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id))
      .map((item) => item.id);

    const metaRows = db.prepare(`
      SELECT key, value
      FROM workspace_meta
      WHERE key IN ('selected_item_id', 'main_view_type', 'main_view_item_id')
    `).all() as WorkspaceMetaRow[];
    const meta = new Map(metaRows.map((row) => [row.key, row.value]));

    const selectedIdRaw = meta.get("selected_item_id");
    const selectedId =
      selectedIdRaw && items[selectedIdRaw] ? selectedIdRaw : null;

    const mainViewType = meta.get("main_view_type");
    const mainViewItemId = meta.get("main_view_item_id");
    const mainView: WorkspaceMainView =
      mainViewType === "workspace-item" && typeof mainViewItemId === "string"
        ? { type: "workspace-item", itemId: mainViewItemId }
        : { type: "chat" };

    return sanitizeWorkspaceSnapshot({
      items,
      docContentById,
      rootIds,
      selectedId,
      editingId: null,
      mainView,
    });
  },

  replaceSnapshot(input: WorkspaceSnapshot): void {
    const db = getTaskDb();
    const snapshot = sanitizeWorkspaceSnapshot(input);
    const orderedItems = sortWorkspaceItemsForInsert(snapshot.items);

    const insertItemStmt = db.prepare(`
      INSERT INTO workspace_items (id, type, name, parent_id, sort_order, collapsed, project_kind)
      VALUES (@id, @type, @name, @parent_id, @sort_order, @collapsed, @project_kind)
    `);
    const insertDocStmt = db.prepare(`
      INSERT INTO workspace_docs (doc_id, markdown)
      VALUES (@doc_id, @markdown)
    `);
    const upsertMetaStmt = db.prepare(`
      INSERT INTO workspace_meta (key, value)
      VALUES (@key, @value)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `);

    db.transaction(() => {
      db.prepare("DELETE FROM workspace_meta").run();
      db.prepare("DELETE FROM workspace_docs").run();
      db.prepare("DELETE FROM workspace_items").run();

      for (const item of orderedItems) {
        insertItemStmt.run({
          id: item.id,
          type: item.type,
          name: item.name,
          parent_id: item.parentId,
          sort_order: item.sortOrder,
          collapsed: item.type === "folder" ? (item.collapsed ? 1 : 0) : null,
          project_kind: item.type === "project" ? "dummy" : null,
        });
      }

      for (const item of Object.values(snapshot.items)) {
        if (item.type !== "doc") continue;
        insertDocStmt.run({
          doc_id: item.id,
          markdown: snapshot.docContentById[item.id] ?? "",
        });
      }

      upsertMetaStmt.run({
        key: "selected_item_id",
        value: snapshot.selectedId ?? "",
      });
      upsertMetaStmt.run({
        key: "main_view_type",
        value: snapshot.mainView.type,
      });
      upsertMetaStmt.run({
        key: "main_view_item_id",
        value: snapshot.mainView.type === "workspace-item" ? snapshot.mainView.itemId : "",
      });
    })();
  },

  saveDoc(docId: string, markdown: string): void {
    const db = getTaskDb();
    const item = db.prepare(`
      SELECT id
      FROM workspace_items
      WHERE id = @id AND type = 'doc'
    `).get({ id: docId }) as { id: string } | undefined;
    if (!item) return;

    db.prepare(`
      INSERT INTO workspace_docs (doc_id, markdown)
      VALUES (@doc_id, @markdown)
      ON CONFLICT(doc_id) DO UPDATE SET markdown = excluded.markdown
    `).run({ doc_id: docId, markdown });
  },

  toggleCollapsed(input: WorkspaceToggleCollapsedInput): void {
    const db = getTaskDb();
    db.prepare(`
      UPDATE workspace_items SET collapsed = @collapsed WHERE id = @id AND type = 'folder'
    `).run({ id: input.id, collapsed: input.collapsed ? 1 : 0 });
  },

  renameItem(input: WorkspaceRenameItemInput): void {
    const db = getTaskDb();
    db.prepare(`
      UPDATE workspace_items SET name = @name WHERE id = @id
    `).run({ id: input.id, name: input.name });
  },

  addItem(input: WorkspaceAddItemInput): void {
    const db = getTaskDb();
    const insertItemStmt = db.prepare(`
      INSERT INTO workspace_items (id, type, name, parent_id, sort_order, collapsed, project_kind)
      VALUES (@id, @type, @name, @parent_id, @sort_order, @collapsed, @project_kind)
    `);
    const insertDocStmt = db.prepare(`
      INSERT INTO workspace_docs (doc_id, markdown)
      VALUES (@doc_id, @markdown)
    `);
    const uncollapseStmt = db.prepare(`
      UPDATE workspace_items SET collapsed = 0 WHERE id = @id
    `);

    db.transaction(() => {
      insertItemStmt.run({
        id: input.id,
        type: input.type,
        name: input.name,
        parent_id: input.parentId,
        sort_order: input.sortOrder,
        collapsed: input.type === "folder" ? (input.collapsed ? 1 : 0) : null,
        project_kind: input.type === "project" ? (input.projectKind ?? "dummy") : null,
      });

      if (input.type === "doc") {
        insertDocStmt.run({
          doc_id: input.id,
          markdown: input.docContent ?? "",
        });
      }

      if (input.uncollapseParentId) {
        uncollapseStmt.run({ id: input.uncollapseParentId });
      }
    })();
  },

  deleteItem(input: WorkspaceDeleteItemInput): void {
    const db = getTaskDb();
    const deleteStmt = db.prepare(`
      DELETE FROM workspace_items WHERE id = @id
    `);
    const reorderStmt = db.prepare(`
      UPDATE workspace_items SET sort_order = @sort_order WHERE id = @id
    `);

    db.transaction(() => {
      deleteStmt.run({ id: input.id });
      for (const sib of input.siblingReorders) {
        reorderStmt.run({ id: sib.id, sort_order: sib.sortOrder });
      }
    })();
  },

  moveItem(input: WorkspaceMoveItemInput): void {
    const db = getTaskDb();
    const moveStmt = db.prepare(`
      UPDATE workspace_items SET parent_id = @parent_id WHERE id = @id
    `);
    const reorderStmt = db.prepare(`
      UPDATE workspace_items SET sort_order = @sort_order WHERE id = @id
    `);

    db.transaction(() => {
      moveStmt.run({ id: input.id, parent_id: input.newParentId });
      for (const sib of input.siblingReorders) {
        reorderStmt.run({ id: sib.id, sort_order: sib.sortOrder });
      }
    })();
  },

  updateUiState(input: WorkspaceSaveUiInput): void {
    const db = getTaskDb();
    const upsertMetaStmt = db.prepare(`
      INSERT INTO workspace_meta (key, value)
      VALUES (@key, @value)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `);

    const selectedRow =
      input.selectedId
        ? (db.prepare("SELECT id FROM workspace_items WHERE id = @id").get({
            id: input.selectedId,
          }) as { id: string } | undefined)
        : undefined;
    const selectedId = selectedRow ? input.selectedId : null;

    let normalizedMainView: WorkspaceMainView = { type: "chat" };
    if (input.mainView.type === "workspace-item") {
      const row = db.prepare("SELECT id, type FROM workspace_items WHERE id = @id").get({
        id: input.mainView.itemId,
      }) as { id: string; type: string } | undefined;
      if (row && (row.type === "doc" || row.type === "project")) {
        normalizedMainView = { type: "workspace-item", itemId: row.id };
      }
    }

    db.transaction(() => {
      upsertMetaStmt.run({ key: "selected_item_id", value: selectedId ?? "" });
      upsertMetaStmt.run({ key: "main_view_type", value: normalizedMainView.type });
      upsertMetaStmt.run({
        key: "main_view_item_id",
        value:
          normalizedMainView.type === "workspace-item"
            ? normalizedMainView.itemId
            : "",
      });
    })();
  },
};
