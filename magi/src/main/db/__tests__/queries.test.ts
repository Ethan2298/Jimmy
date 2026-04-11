import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { initTaskDb, closeTaskDb, getTaskDb } from "../index";
import type { WorkspaceSnapshot } from "../../../shared/workspace";
import {
  projects,
  sections,
  tasks,
  labels,
  taskLabels,
  comments,
  activityLog,
  workspace,
} from "../queries";

describe("queries", () => {
  beforeEach(() => {
    initTaskDb(":memory:");
  });

  afterEach(() => {
    closeTaskDb();
  });

  // ── Projects ──

  describe("projects", () => {
    it("creates a project and returns it", () => {
      const p = projects.create({ name: "Test Project" });
      expect(p.id).toBeTruthy();
      expect(p.name).toBe("Test Project");
      expect(p.is_inbox).toBe(0);
      expect(p.color).toBeNull();
      expect(p.view_mode).toBe("list");
    });

    it("creates a project with all optional fields", () => {
      const p = projects.create({
        name: "Colored",
        color: "#ff0000",
        view_mode: "map",
        sort_order: 5,
      });
      expect(p.color).toBe("#ff0000");
      expect(p.view_mode).toBe("map");
      expect(p.sort_order).toBe(5);
    });

    it("gets a project by id", () => {
      const p = projects.create({ name: "Fetch Me" });
      const fetched = projects.get(p.id);
      expect(fetched).toBeDefined();
      expect(fetched!.name).toBe("Fetch Me");
    });

    it("returns undefined for non-existent project", () => {
      expect(projects.get("nonexistent")).toBeUndefined();
    });

    it("lists all projects including Inbox", () => {
      const list = projects.list();
      expect(list.some((p) => p.is_inbox === 1)).toBe(true);
    });

    it("lists projects ordered by sort_order then name", () => {
      projects.create({ name: "Zebra", sort_order: 1 });
      projects.create({ name: "Alpha", sort_order: 1 });
      const list = projects.list();
      const userProjects = list.filter((p) => p.is_inbox === 0);
      expect(userProjects[0].name).toBe("Alpha");
      expect(userProjects[1].name).toBe("Zebra");
    });

    it("updates a project", () => {
      const p = projects.create({ name: "Old Name" });
      const updated = projects.update(p.id, {
        name: "New Name",
        color: "#00ff00",
        view_mode: "map",
      });
      expect(updated).toBeDefined();
      expect(updated!.name).toBe("New Name");
      expect(updated!.color).toBe("#00ff00");
      expect(updated!.view_mode).toBe("map");
    });

    it("update with no fields returns current project", () => {
      const p = projects.create({ name: "Unchanged" });
      const result = projects.update(p.id, {});
      expect(result).toBeDefined();
      expect(result!.name).toBe("Unchanged");
    });

    it("deletes a project", () => {
      const p = projects.create({ name: "To Delete" });
      projects.delete(p.id);
      expect(projects.get(p.id)).toBeUndefined();
    });

    it("cannot delete the Inbox project", () => {
      projects.delete("inbox");
      const inbox = projects.get("inbox");
      expect(inbox).toBeDefined();
      expect(inbox!.is_inbox).toBe(1);
    });

    it("logs activity on create/update/delete", () => {
      const p = projects.create({ name: "Logged" });
      projects.update(p.id, { name: "Updated" });
      projects.delete(p.id);

      const log = activityLog.query({ entity_type: "project", entity_id: p.id });
      const actions = log.map((e) => e.action);
      expect(actions).toContain("created");
      expect(actions).toContain("updated");
      expect(actions).toContain("deleted");
    });

    it("does not log delete for non-existent project", () => {
      projects.delete("nonexistent-id");
      const log = activityLog.query({ entity_type: "project", entity_id: "nonexistent-id" });
      expect(log).toHaveLength(0);
    });
  });

  // ── Foreign Key Cascades ──

  describe("foreign key cascades", () => {
    it("deleting a project cascades to its sections", () => {
      const p = projects.create({ name: "Cascade Test" });
      sections.create({ project_id: p.id, name: "Section 1" });
      sections.create({ project_id: p.id, name: "Section 2" });

      projects.delete(p.id);
      const remainingSections = sections.list(p.id);
      expect(remainingSections).toHaveLength(0);
    });

    it("deleting a project cascades to its tasks", () => {
      const p = projects.create({ name: "Cascade Tasks" });
      tasks.create({ project_id: p.id, title: "Task 1" });

      projects.delete(p.id);
      const remaining = tasks.list({ project_id: p.id });
      expect(remaining).toHaveLength(0);
    });

    it("deleting a section sets section_id to null on tasks", () => {
      const p = projects.create({ name: "Section Null" });
      const s = sections.create({ project_id: p.id, name: "My Section" });
      const t = tasks.create({ project_id: p.id, section_id: s.id, title: "Task" });

      sections.delete(s.id);
      const updated = tasks.get(t.id);
      expect(updated).toBeDefined();
      expect(updated!.section_id).toBeNull();
    });

    it("deleting a parent task cascades to child tasks", () => {
      const p = projects.create({ name: "Parent Cascade" });
      const parent = tasks.create({ project_id: p.id, title: "Parent" });
      const child = tasks.create({ project_id: p.id, title: "Child", parent_id: parent.id });

      tasks.delete(parent.id);
      expect(tasks.get(child.id)).toBeUndefined();
    });
  });

  // ── Sections ──

  describe("sections", () => {
    let projectId: string;

    beforeEach(() => {
      projectId = projects.create({ name: "Section Project" }).id;
    });

    it("creates a section", () => {
      const s = sections.create({ project_id: projectId, name: "Section A" });
      expect(s.id).toBeTruthy();
      expect(s.name).toBe("Section A");
      expect(s.project_id).toBe(projectId);
    });

    it("lists sections for a project", () => {
      sections.create({ project_id: projectId, name: "A" });
      sections.create({ project_id: projectId, name: "B" });
      const list = sections.list(projectId);
      expect(list).toHaveLength(2);
    });

    it("updates a section", () => {
      const s = sections.create({ project_id: projectId, name: "Old" });
      const updated = sections.update(s.id, { name: "New" });
      expect(updated!.name).toBe("New");
    });

    it("update with no fields returns current section", () => {
      const s = sections.create({ project_id: projectId, name: "Static" });
      const result = sections.update(s.id, {});
      expect(result!.name).toBe("Static");
    });

    it("deletes a section", () => {
      const s = sections.create({ project_id: projectId, name: "Delete Me" });
      sections.delete(s.id);
      const list = sections.list(projectId);
      expect(list).toHaveLength(0);
    });

    it("does not log delete for non-existent section", () => {
      sections.delete("nonexistent-section");
      const log = activityLog.query({ entity_type: "section", entity_id: "nonexistent-section" });
      expect(log).toHaveLength(0);
    });

    it("reorders sections", () => {
      const s1 = sections.create({ project_id: projectId, name: "First", sort_order: 0 });
      const s2 = sections.create({ project_id: projectId, name: "Second", sort_order: 1 });
      sections.reorder([s2.id, s1.id]);

      const list = sections.list(projectId);
      expect(list[0].id).toBe(s2.id);
      expect(list[1].id).toBe(s1.id);
    });
  });

  // ── Tasks ──

  describe("tasks", () => {
    it("creates a task in the Inbox by default", () => {
      const t = tasks.create({ title: "Inbox Task" });
      expect(t.project_id).toBe("inbox");
      expect(t.status).toBe("active");
      expect(t.priority).toBe(4);
    });

    it("creates a task with all optional fields", () => {
      const p = projects.create({ name: "Proj" });
      const s = sections.create({ project_id: p.id, name: "Sec" });
      const t = tasks.create({
        project_id: p.id,
        section_id: s.id,
        title: "Full Task",
        description: "A description",
        priority: 1,
        due_date: "2025-12-31",
        due_is_datetime: 1,
        duration_minutes: 60,
        recurrence: '{"freq":"daily"}',
        sort_order: 3,
      });
      expect(t.project_id).toBe(p.id);
      expect(t.section_id).toBe(s.id);
      expect(t.description).toBe("A description");
      expect(t.priority).toBe(1);
      expect(t.due_date).toBe("2025-12-31");
      expect(t.duration_minutes).toBe(60);
    });

    it("gets a task by id", () => {
      const t = tasks.create({ title: "Get Me" });
      expect(tasks.get(t.id)).toBeDefined();
      expect(tasks.get("nope")).toBeUndefined();
    });

    it("lists tasks with no filter", () => {
      tasks.create({ title: "A" });
      tasks.create({ title: "B" });
      const list = tasks.list();
      expect(list.length).toBeGreaterThanOrEqual(2);
    });

    it("lists tasks filtered by project_id", () => {
      const p = projects.create({ name: "Filter Proj" });
      tasks.create({ project_id: p.id, title: "In project" });
      tasks.create({ title: "In inbox" });
      const list = tasks.list({ project_id: p.id });
      expect(list).toHaveLength(1);
      expect(list[0].title).toBe("In project");
    });

    it("lists tasks filtered by status", () => {
      const t = tasks.create({ title: "To Complete" });
      tasks.complete(t.id);
      const active = tasks.list({ status: "active" });
      const completed = tasks.list({ status: "completed" });
      expect(active.every((task) => task.status === "active")).toBe(true);
      expect(completed.some((task) => task.id === t.id)).toBe(true);
    });

    it("lists tasks filtered by priority", () => {
      tasks.create({ title: "P1", priority: 1 });
      tasks.create({ title: "P4", priority: 4 });
      const list = tasks.list({ priority: 1 });
      expect(list.every((task) => task.priority === 1)).toBe(true);
    });

    it("lists tasks filtered by parent_id null (top-level only)", () => {
      const parent = tasks.create({ title: "Parent" });
      tasks.create({ title: "Child", parent_id: parent.id });
      const topLevel = tasks.list({ parent_id: null });
      expect(topLevel.every((t) => t.parent_id === null)).toBe(true);
    });

    it("lists tasks filtered by parent_id (children only)", () => {
      const parent = tasks.create({ title: "Parent" });
      const child = tasks.create({ title: "Child", parent_id: parent.id });
      const children = tasks.list({ parent_id: parent.id });
      expect(children).toHaveLength(1);
      expect(children[0].id).toBe(child.id);
    });

    it("lists tasks filtered by due_before and due_after", () => {
      tasks.create({ title: "Early", due_date: "2025-01-01" });
      tasks.create({ title: "Late", due_date: "2025-12-31" });
      const before = tasks.list({ due_before: "2025-06-01" });
      expect(before).toHaveLength(1);
      expect(before[0].title).toBe("Early");

      const after = tasks.list({ due_after: "2025-06-01" });
      expect(after).toHaveLength(1);
      expect(after[0].title).toBe("Late");
    });

    it("updates a task", () => {
      const t = tasks.create({ title: "Old Title" });
      const updated = tasks.update(t.id, { title: "New Title", priority: 2 });
      expect(updated!.title).toBe("New Title");
      expect(updated!.priority).toBe(2);
    });

    it("update with no fields returns current task", () => {
      const t = tasks.create({ title: "No Change" });
      const result = tasks.update(t.id, {});
      expect(result!.title).toBe("No Change");
    });

    it("update skips depth validation when no fields to update", () => {
      const t = tasks.create({ title: "Shallow" });
      // This should NOT throw even though depth validation would fail
      // because the early return happens first
      const result = tasks.update(t.id, {});
      expect(result!.title).toBe("Shallow");
    });

    it("deletes a task", () => {
      const t = tasks.create({ title: "Delete Me" });
      tasks.delete(t.id);
      expect(tasks.get(t.id)).toBeUndefined();
    });

    it("does not log delete for non-existent task", () => {
      tasks.delete("nonexistent-task");
      const log = activityLog.query({ entity_type: "task", entity_id: "nonexistent-task" });
      expect(log).toHaveLength(0);
    });

    it("completes a task and its subtasks", () => {
      const parent = tasks.create({ title: "Parent" });
      const child = tasks.create({ title: "Child", parent_id: parent.id });
      const grandchild = tasks.create({ title: "Grandchild", parent_id: child.id });

      tasks.complete(parent.id);

      expect(tasks.get(parent.id)!.status).toBe("completed");
      expect(tasks.get(child.id)!.status).toBe("completed");
      expect(tasks.get(grandchild.id)!.status).toBe("completed");
      expect(tasks.get(parent.id)!.completed_at).not.toBeNull();
    });

    it("complete does not re-complete already completed tasks", () => {
      const t = tasks.create({ title: "Already Done" });
      tasks.complete(t.id);
      const first = tasks.get(t.id)!;

      // Complete again — completed_at should not change
      tasks.complete(t.id);
      const second = tasks.get(t.id)!;
      expect(second.completed_at).toBe(first.completed_at);
    });

    it("complete returns undefined for non-existent task", () => {
      const result = tasks.complete("nonexistent");
      expect(result).toBeUndefined();
    });

    it("reorders tasks", () => {
      const t1 = tasks.create({ title: "First" });
      const t2 = tasks.create({ title: "Second" });
      tasks.reorder([t2.id, t1.id]);

      const list = tasks.list();
      const ids = list.map((t) => t.id);
      expect(ids.indexOf(t2.id)).toBeLessThan(ids.indexOf(t1.id));
    });
  });

  // ── Depth Validation ──

  describe("task depth validation", () => {
    it("allows nesting up to MAX_TASK_DEPTH (5)", () => {
      const t1 = tasks.create({ title: "Level 1" });
      const t2 = tasks.create({ title: "Level 2", parent_id: t1.id });
      const t3 = tasks.create({ title: "Level 3", parent_id: t2.id });
      const t4 = tasks.create({ title: "Level 4", parent_id: t3.id });
      const t5 = tasks.create({ title: "Level 5", parent_id: t4.id });
      expect(t5.parent_id).toBe(t4.id);
    });

    it("throws when creating task deeper than MAX_TASK_DEPTH", () => {
      const t1 = tasks.create({ title: "L1" });
      const t2 = tasks.create({ title: "L2", parent_id: t1.id });
      const t3 = tasks.create({ title: "L3", parent_id: t2.id });
      const t4 = tasks.create({ title: "L4", parent_id: t3.id });
      const t5 = tasks.create({ title: "L5", parent_id: t4.id });

      expect(() => tasks.create({ title: "L6", parent_id: t5.id })).toThrow(
        /Cannot nest tasks deeper than 5 levels/,
      );
    });

    it("throws when moving a task with subtree would exceed depth", () => {
      // Create a chain: t1 -> t2 -> t3
      const t1 = tasks.create({ title: "Chain 1" });
      const t2 = tasks.create({ title: "Chain 2", parent_id: t1.id });
      tasks.create({ title: "Chain 3", parent_id: t2.id });

      // Create another deep chain: a1 -> a2 -> a3
      const a1 = tasks.create({ title: "Alt 1" });
      const a2 = tasks.create({ title: "Alt 2", parent_id: a1.id });
      const a3 = tasks.create({ title: "Alt 3", parent_id: a2.id });

      // Moving t1 (with its subtree depth 2) under a3 (depth 3) would be 3+1+2 = 6 > 5
      expect(() => tasks.update(t1.id, { parent_id: a3.id })).toThrow(
        /Cannot nest tasks deeper than 5 levels/,
      );
    });

    it("allows moving a leaf task to valid depth", () => {
      const t1 = tasks.create({ title: "L1" });
      const t2 = tasks.create({ title: "L2", parent_id: t1.id });
      const leaf = tasks.create({ title: "Leaf" });

      const updated = tasks.update(leaf.id, { parent_id: t2.id });
      expect(updated!.parent_id).toBe(t2.id);
    });

    it("allows setting parent_id to null (no depth validation)", () => {
      const parent = tasks.create({ title: "Parent" });
      const child = tasks.create({ title: "Child", parent_id: parent.id });

      const updated = tasks.update(child.id, { parent_id: null });
      expect(updated!.parent_id).toBeNull();
    });
  });

  // ── Labels ──

  describe("labels", () => {
    it("creates a label", () => {
      const l = labels.create("Bug", "#ff0000");
      expect(l.id).toBeTruthy();
      expect(l.name).toBe("Bug");
      expect(l.color).toBe("#ff0000");
    });

    it("creates a label without color", () => {
      const l = labels.create("Feature");
      expect(l.color).toBeNull();
    });

    it("lists labels ordered by name", () => {
      labels.create("Zebra");
      labels.create("Alpha");
      const list = labels.list();
      expect(list[0].name).toBe("Alpha");
      expect(list[1].name).toBe("Zebra");
    });

    it("deletes a label", () => {
      const l = labels.create("Temp");
      labels.delete(l.id);
      const list = labels.list();
      expect(list.find((x) => x.id === l.id)).toBeUndefined();
    });

    it("rejects duplicate label names", () => {
      labels.create("Unique");
      expect(() => labels.create("Unique")).toThrow();
    });
  });

  // ── Task Labels ──

  describe("taskLabels", () => {
    it("adds and retrieves labels for a task", () => {
      const t = tasks.create({ title: "Labeled Task" });
      const l1 = labels.create("Bug");
      const l2 = labels.create("Feature");

      taskLabels.add(t.id, l1.id);
      taskLabels.add(t.id, l2.id);

      const result = taskLabels.getForTask(t.id);
      expect(result).toHaveLength(2);
      const names = result.map((l) => l.name);
      expect(names).toContain("Bug");
      expect(names).toContain("Feature");
    });

    it("ignores duplicate task-label assignments", () => {
      const t = tasks.create({ title: "Dup Test" });
      const l = labels.create("Tag");
      taskLabels.add(t.id, l.id);
      taskLabels.add(t.id, l.id); // duplicate — should not throw
      expect(taskLabels.getForTask(t.id)).toHaveLength(1);
    });

    it("removes a label from a task", () => {
      const t = tasks.create({ title: "Remove Label" });
      const l = labels.create("Removable");
      taskLabels.add(t.id, l.id);
      taskLabels.remove(t.id, l.id);
      expect(taskLabels.getForTask(t.id)).toHaveLength(0);
    });

    it("cascades when task is deleted", () => {
      const t = tasks.create({ title: "Cascade Task" });
      const l = labels.create("Cascade Label");
      taskLabels.add(t.id, l.id);
      tasks.delete(t.id);

      // The junction row should be gone
      const db = getTaskDb();
      const rows = db.prepare("SELECT * FROM task_labels WHERE task_id = @id").all({ id: t.id });
      expect(rows).toHaveLength(0);
    });

    it("cascades when label is deleted", () => {
      const t = tasks.create({ title: "Label Cascade" });
      const l = labels.create("Del Label");
      taskLabels.add(t.id, l.id);
      labels.delete(l.id);
      expect(taskLabels.getForTask(t.id)).toHaveLength(0);
    });
  });

  // ── Comments ──

  describe("comments", () => {
    it("creates a comment on a task", () => {
      const t = tasks.create({ title: "Commented Task" });
      const c = comments.create({ task_id: t.id, content: "Nice work!" });
      expect(c.id).toBeTruthy();
      expect(c.task_id).toBe(t.id);
      expect(c.content).toBe("Nice work!");
    });

    it("creates a comment on a project", () => {
      const p = projects.create({ name: "Commented Project" });
      const c = comments.create({ project_id: p.id, content: "Project note" });
      expect(c.project_id).toBe(p.id);
      expect(c.task_id).toBeNull();
    });

    it("lists comments filtered by task_id", () => {
      const t = tasks.create({ title: "Task" });
      comments.create({ task_id: t.id, content: "Comment 1" });
      comments.create({ task_id: t.id, content: "Comment 2" });
      const list = comments.list({ task_id: t.id });
      expect(list).toHaveLength(2);
    });

    it("lists comments filtered by project_id", () => {
      const p = projects.create({ name: "Proj" });
      comments.create({ project_id: p.id, content: "Proj comment" });
      const list = comments.list({ project_id: p.id });
      expect(list).toHaveLength(1);
    });

    it("lists all comments when no filter", () => {
      const t = tasks.create({ title: "Task" });
      comments.create({ task_id: t.id, content: "A" });
      comments.create({ task_id: t.id, content: "B" });
      const list = comments.list({});
      expect(list.length).toBeGreaterThanOrEqual(2);
    });

    it("updates a comment", () => {
      const t = tasks.create({ title: "Task" });
      const c = comments.create({ task_id: t.id, content: "Old" });
      const updated = comments.update(c.id, { content: "New" });
      expect(updated!.content).toBe("New");
    });

    it("deletes a comment", () => {
      const t = tasks.create({ title: "Task" });
      const c = comments.create({ task_id: t.id, content: "Delete me" });
      comments.delete(c.id);
      const list = comments.list({ task_id: t.id });
      expect(list).toHaveLength(0);
    });

    it("logs comment_added activity", () => {
      const t = tasks.create({ title: "Task" });
      comments.create({ task_id: t.id, content: "Logged" });
      const log = activityLog.query({ entity_type: "task", entity_id: t.id, action: "comment_added" });
      expect(log).toHaveLength(1);
    });
  });

  // ── Activity Log ──

  describe("activityLog", () => {
    it("logs and queries entries", () => {
      activityLog.log("test_entity", "test-1", "test_action", '{"key":"value"}');
      const entries = activityLog.query({ entity_type: "test_entity" });
      expect(entries).toHaveLength(1);
      expect(entries[0].action).toBe("test_action");
      expect(entries[0].details).toBe('{"key":"value"}');
    });

    it("queries by entity_id", () => {
      activityLog.log("type", "id-1", "action");
      activityLog.log("type", "id-2", "action");
      const entries = activityLog.query({ entity_id: "id-1" });
      expect(entries).toHaveLength(1);
    });

    it("queries by action", () => {
      activityLog.log("type", "id", "created");
      activityLog.log("type", "id", "updated");
      const entries = activityLog.query({ action: "created" });
      expect(entries.every((e) => e.action === "created")).toBe(true);
    });

    it("respects limit", () => {
      for (let i = 0; i < 10; i++) {
        activityLog.log("type", `id-${i}`, "action");
      }
      const entries = activityLog.query({ limit: 3 });
      expect(entries).toHaveLength(3);
    });

    it("orders by created_at DESC", () => {
      const entries = activityLog.query({});
      if (entries.length >= 2) {
        expect(entries[0].created_at >= entries[1].created_at).toBe(true);
      }
    });
  });

  // ── Workspace ──

  describe("workspace", () => {
    it("creates workspace tables in migration v3", () => {
      const db = getTaskDb();
      const tables = db
        .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
        .all() as Array<{ name: string }>;
      const names = tables.map((row) => row.name);
      expect(names).toContain("workspace_items");
      expect(names).toContain("workspace_docs");
      expect(names).toContain("workspace_meta");
    });

    it("round-trips a workspace snapshot through replace and load", () => {
      const snapshot: WorkspaceSnapshot = {
        items: {
          folderA: {
            id: "folderA",
            type: "folder",
            name: "Folder A",
            parentId: null,
            sortOrder: 0,
            collapsed: false,
          },
          docA: {
            id: "docA",
            type: "doc",
            name: "Doc A",
            parentId: "folderA",
            sortOrder: 0,
          },
          projectA: {
            id: "projectA",
            type: "project",
            name: "Project A",
            parentId: null,
            sortOrder: 1,
            projectKind: "dummy",
          },
        },
        docContentById: {
          docA: "# Hello",
        },
        rootIds: ["folderA", "projectA"],
        selectedId: "docA",
        editingId: null,
        mainView: { type: "workspace-item", itemId: "docA" } as const,
      };

      workspace.replaceSnapshot(snapshot);
      const loaded = workspace.loadSnapshot();
      expect(loaded).toBeTruthy();
      expect(loaded!.rootIds).toEqual(["folderA", "projectA"]);
      expect(loaded!.docContentById.docA).toBe("# Hello");
      expect(loaded!.selectedId).toBe("docA");
      expect(loaded!.mainView).toEqual({ type: "workspace-item", itemId: "docA" });
    });

    it("saveDoc updates existing doc markdown", () => {
      workspace.replaceSnapshot({
        items: {
          docA: {
            id: "docA",
            type: "doc",
            name: "Doc A",
            parentId: null,
            sortOrder: 0,
          },
        },
        docContentById: { docA: "Old" },
        rootIds: ["docA"],
        selectedId: "docA",
        editingId: null,
        mainView: { type: "workspace-item", itemId: "docA" },
      });

      workspace.saveDoc("docA", "New body");
      const loaded = workspace.loadSnapshot();
      expect(loaded!.docContentById.docA).toBe("New body");
    });

    it("saveDoc is ignored for non-doc IDs", () => {
      workspace.replaceSnapshot({
        items: {
          folderA: {
            id: "folderA",
            type: "folder",
            name: "Folder A",
            parentId: null,
            sortOrder: 0,
            collapsed: false,
          },
          docA: {
            id: "docA",
            type: "doc",
            name: "Doc A",
            parentId: "folderA",
            sortOrder: 0,
          },
        },
        docContentById: { docA: "Original" },
        rootIds: ["folderA"],
        selectedId: "docA",
        editingId: null,
        mainView: { type: "workspace-item", itemId: "docA" },
      });

      workspace.saveDoc("folderA", "Should not write");
      const loaded = workspace.loadSnapshot();
      expect(loaded!.docContentById.docA).toBe("Original");
      expect(loaded!.docContentById.folderA).toBeUndefined();
    });

    it("replaceSnapshot removes stale docs and items", () => {
      workspace.replaceSnapshot({
        items: {
          docA: {
            id: "docA",
            type: "doc",
            name: "Doc A",
            parentId: null,
            sortOrder: 0,
          },
          docB: {
            id: "docB",
            type: "doc",
            name: "Doc B",
            parentId: null,
            sortOrder: 1,
          },
        },
        docContentById: { docA: "A", docB: "B" },
        rootIds: ["docA", "docB"],
        selectedId: "docA",
        editingId: null,
        mainView: { type: "workspace-item", itemId: "docA" },
      });

      workspace.replaceSnapshot({
        items: {
          docA: {
            id: "docA",
            type: "doc",
            name: "Doc A",
            parentId: null,
            sortOrder: 0,
          },
        },
        docContentById: { docA: "A2" },
        rootIds: ["docA"],
        selectedId: "docA",
        editingId: null,
        mainView: { type: "workspace-item", itemId: "docA" },
      });

      const loaded = workspace.loadSnapshot();
      expect(loaded!.items.docB).toBeUndefined();
      expect(loaded!.docContentById.docB).toBeUndefined();
      expect(loaded!.docContentById.docA).toBe("A2");
    });

    it("preserves empty doc name through round-trip", () => {
      workspace.replaceSnapshot({
        items: {
          docEmpty: {
            id: "docEmpty",
            type: "doc",
            name: "",
            parentId: null,
            sortOrder: 0,
          },
        },
        docContentById: { docEmpty: "# Untitled content" },
        rootIds: ["docEmpty"],
        selectedId: null,
        editingId: null,
        mainView: { type: "workspace-item", itemId: "docEmpty" },
      });

      const loaded = workspace.loadSnapshot();
      expect(loaded!.items.docEmpty.name).toBe("");
    });

    it("preserves empty folder name through round-trip", () => {
      workspace.replaceSnapshot({
        items: {
          folderEmpty: {
            id: "folderEmpty",
            type: "folder",
            name: "",
            parentId: null,
            sortOrder: 0,
            collapsed: false,
          },
        },
        docContentById: {},
        rootIds: ["folderEmpty"],
        selectedId: null,
        editingId: null,
        mainView: { type: "chat" },
      });

      const loaded = workspace.loadSnapshot();
      expect(loaded!.items.folderEmpty.name).toBe("");
    });

    it("normalizes invalid main_view_item_id to chat", () => {
      workspace.replaceSnapshot({
        items: {
          docA: {
            id: "docA",
            type: "doc",
            name: "Doc A",
            parentId: null,
            sortOrder: 0,
          },
        },
        docContentById: { docA: "A" },
        rootIds: ["docA"],
        selectedId: "docA",
        editingId: null,
        mainView: { type: "workspace-item", itemId: "docA" },
      });

      const db = getTaskDb();
      db.prepare("UPDATE workspace_meta SET value = 'missing' WHERE key = 'main_view_item_id'").run();
      const loaded = workspace.loadSnapshot();
      expect(loaded!.mainView).toEqual({ type: "chat" });
    });

    it("toggleCollapsed updates only the collapsed column", () => {
      workspace.replaceSnapshot({
        items: {
          folderA: {
            id: "folderA",
            type: "folder",
            name: "Folder A",
            parentId: null,
            sortOrder: 0,
            collapsed: false,
          },
          docA: {
            id: "docA",
            type: "doc",
            name: "Doc A",
            parentId: "folderA",
            sortOrder: 0,
          },
        },
        docContentById: { docA: "# Hello" },
        rootIds: ["folderA"],
        selectedId: null,
        editingId: null,
        mainView: { type: "chat" },
      });

      workspace.toggleCollapsed({ id: "folderA", collapsed: true });
      const loaded = workspace.loadSnapshot();
      expect(loaded!.items.folderA.collapsed).toBe(true);
      expect(loaded!.items.folderA.name).toBe("Folder A");
      expect(loaded!.docContentById.docA).toBe("# Hello");
    });

    it("toggleCollapsed ignores non-folder items", () => {
      workspace.replaceSnapshot({
        items: {
          docA: {
            id: "docA",
            type: "doc",
            name: "Doc A",
            parentId: null,
            sortOrder: 0,
          },
        },
        docContentById: { docA: "" },
        rootIds: ["docA"],
        selectedId: null,
        editingId: null,
        mainView: { type: "chat" },
      });

      workspace.toggleCollapsed({ id: "docA", collapsed: true });
      const loaded = workspace.loadSnapshot();
      expect(loaded!.items.docA.collapsed).toBeUndefined();
    });

    it("renameItem updates only the name column", () => {
      workspace.replaceSnapshot({
        items: {
          docA: {
            id: "docA",
            type: "doc",
            name: "Old Name",
            parentId: null,
            sortOrder: 0,
          },
        },
        docContentById: { docA: "content" },
        rootIds: ["docA"],
        selectedId: null,
        editingId: null,
        mainView: { type: "chat" },
      });

      workspace.renameItem({ id: "docA", name: "New Name" });
      const loaded = workspace.loadSnapshot();
      expect(loaded!.items.docA.name).toBe("New Name");
      expect(loaded!.docContentById.docA).toBe("content");
    });

    it("addItem inserts a doc with content", () => {
      workspace.replaceSnapshot({
        items: {
          folderA: {
            id: "folderA",
            type: "folder",
            name: "Folder A",
            parentId: null,
            sortOrder: 0,
            collapsed: false,
          },
        },
        docContentById: {},
        rootIds: ["folderA"],
        selectedId: null,
        editingId: null,
        mainView: { type: "chat" },
      });

      workspace.addItem({
        id: "newDoc",
        type: "doc",
        name: "New Doc",
        parentId: "folderA",
        sortOrder: 0,
        docContent: "# Fresh",
      });

      const loaded = workspace.loadSnapshot();
      expect(loaded!.items.newDoc).toBeDefined();
      expect(loaded!.items.newDoc.type).toBe("doc");
      expect(loaded!.items.newDoc.name).toBe("New Doc");
      expect(loaded!.items.newDoc.parentId).toBe("folderA");
      expect(loaded!.docContentById.newDoc).toBe("# Fresh");
    });

    it("addItem inserts a folder", () => {
      workspace.replaceSnapshot({
        items: {
          docA: {
            id: "docA",
            type: "doc",
            name: "Doc A",
            parentId: null,
            sortOrder: 0,
          },
        },
        docContentById: { docA: "" },
        rootIds: ["docA"],
        selectedId: null,
        editingId: null,
        mainView: { type: "chat" },
      });

      workspace.addItem({
        id: "newFolder",
        type: "folder",
        name: "New Folder",
        parentId: null,
        sortOrder: 1,
        collapsed: false,
      });

      const loaded = workspace.loadSnapshot();
      expect(loaded!.items.newFolder).toBeDefined();
      expect(loaded!.items.newFolder.type).toBe("folder");
      expect(loaded!.items.newFolder.collapsed).toBe(false);
    });

    it("addItem uncollapses parent when specified", () => {
      workspace.replaceSnapshot({
        items: {
          folderA: {
            id: "folderA",
            type: "folder",
            name: "Folder A",
            parentId: null,
            sortOrder: 0,
            collapsed: true,
          },
        },
        docContentById: {},
        rootIds: ["folderA"],
        selectedId: null,
        editingId: null,
        mainView: { type: "chat" },
      });

      workspace.addItem({
        id: "newDoc",
        type: "doc",
        name: "Doc",
        parentId: "folderA",
        sortOrder: 0,
        docContent: "",
        uncollapseParentId: "folderA",
      });

      const loaded = workspace.loadSnapshot();
      expect(loaded!.items.folderA.collapsed).toBe(false);
      expect(loaded!.items.newDoc).toBeDefined();
    });

    it("deleteItem removes item and cascades to children", () => {
      workspace.replaceSnapshot({
        items: {
          folderA: {
            id: "folderA",
            type: "folder",
            name: "Folder A",
            parentId: null,
            sortOrder: 0,
            collapsed: false,
          },
          docA: {
            id: "docA",
            type: "doc",
            name: "Doc A",
            parentId: "folderA",
            sortOrder: 0,
          },
          docB: {
            id: "docB",
            type: "doc",
            name: "Doc B",
            parentId: null,
            sortOrder: 1,
          },
        },
        docContentById: { docA: "A", docB: "B" },
        rootIds: ["folderA", "docB"],
        selectedId: null,
        editingId: null,
        mainView: { type: "chat" },
      });

      workspace.deleteItem({ id: "folderA", siblingReorders: [{ id: "docB", sortOrder: 0 }] });
      const loaded = workspace.loadSnapshot();
      expect(loaded!.items.folderA).toBeUndefined();
      expect(loaded!.items.docA).toBeUndefined();
      expect(loaded!.items.docB).toBeDefined();
      expect(loaded!.items.docB.sortOrder).toBe(0);
    });

    it("moveItem changes parentId and reorders siblings", () => {
      workspace.replaceSnapshot({
        items: {
          folderA: {
            id: "folderA",
            type: "folder",
            name: "Folder A",
            parentId: null,
            sortOrder: 0,
            collapsed: false,
          },
          docA: {
            id: "docA",
            type: "doc",
            name: "Doc A",
            parentId: null,
            sortOrder: 1,
          },
          docB: {
            id: "docB",
            type: "doc",
            name: "Doc B",
            parentId: null,
            sortOrder: 2,
          },
        },
        docContentById: { docA: "A", docB: "B" },
        rootIds: ["folderA", "docA", "docB"],
        selectedId: null,
        editingId: null,
        mainView: { type: "chat" },
      });

      workspace.moveItem({
        id: "docA",
        newParentId: "folderA",
        siblingReorders: [
          { id: "docA", sortOrder: 0 },
          { id: "docB", sortOrder: 1 },
        ],
      });

      const loaded = workspace.loadSnapshot();
      expect(loaded!.items.docA.parentId).toBe("folderA");
      expect(loaded!.items.docA.sortOrder).toBe(0);
      expect(loaded!.items.docB.sortOrder).toBe(1);
    });
  });

  // ── Inbox Protection ──

  describe("inbox protection", () => {
    it("Inbox project exists after init", () => {
      const inbox = projects.get("inbox");
      expect(inbox).toBeDefined();
      expect(inbox!.name).toBe("Inbox");
      expect(inbox!.is_inbox).toBe(1);
    });

    it("cannot delete the Inbox project via DELETE", () => {
      projects.delete("inbox");
      expect(projects.get("inbox")).toBeDefined();
    });
  });
});
