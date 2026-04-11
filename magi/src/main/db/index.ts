import Database from "better-sqlite3";
import fs from "fs";
import path from "path";

let db: Database.Database | null = null;

const MIGRATIONS: ((db: Database.Database) => void)[] = [
  // Version 1: initial schema
  (db) => {
    db.exec(`
      -- Projects
      CREATE TABLE projects (
        id          TEXT PRIMARY KEY,
        name        TEXT NOT NULL,
        color       TEXT,
        parent_id   TEXT REFERENCES projects(id) ON DELETE SET NULL,
        is_inbox    INTEGER NOT NULL DEFAULT 0,
        sort_order  INTEGER NOT NULL DEFAULT 0,
        created_at  TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX idx_projects_parent ON projects(parent_id);

      -- Sections
      CREATE TABLE sections (
        id          TEXT PRIMARY KEY,
        project_id  TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        name        TEXT NOT NULL,
        sort_order  INTEGER NOT NULL DEFAULT 0,
        created_at  TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX idx_sections_project ON sections(project_id);

      -- Tasks
      CREATE TABLE tasks (
        id                TEXT PRIMARY KEY,
        project_id        TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        section_id        TEXT REFERENCES sections(id) ON DELETE SET NULL,
        parent_id         TEXT REFERENCES tasks(id) ON DELETE CASCADE,
        title             TEXT NOT NULL,
        description       TEXT,
        status            TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','completed','cancelled')),
        priority          INTEGER NOT NULL DEFAULT 4 CHECK(priority BETWEEN 1 AND 4),
        due_date          TEXT,
        due_is_datetime   INTEGER NOT NULL DEFAULT 0,
        duration_minutes  INTEGER,
        recurrence        TEXT,
        sort_order        INTEGER NOT NULL DEFAULT 0,
        completed_at      TEXT,
        created_at        TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at        TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX idx_tasks_project   ON tasks(project_id);
      CREATE INDEX idx_tasks_section   ON tasks(section_id);
      CREATE INDEX idx_tasks_parent    ON tasks(parent_id);
      CREATE INDEX idx_tasks_status    ON tasks(status);
      CREATE INDEX idx_tasks_priority  ON tasks(priority);
      CREATE INDEX idx_tasks_due       ON tasks(due_date);

      -- Labels
      CREATE TABLE labels (
        id          TEXT PRIMARY KEY,
        name        TEXT NOT NULL UNIQUE,
        color       TEXT,
        created_at  TEXT NOT NULL DEFAULT (datetime('now'))
      );

      -- Task-Label junction
      CREATE TABLE task_labels (
        task_id   TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
        label_id  TEXT NOT NULL REFERENCES labels(id) ON DELETE CASCADE,
        PRIMARY KEY (task_id, label_id)
      );
      CREATE INDEX idx_task_labels_label ON task_labels(label_id);

      -- Comments
      CREATE TABLE comments (
        id          TEXT PRIMARY KEY,
        task_id     TEXT REFERENCES tasks(id) ON DELETE CASCADE,
        project_id  TEXT REFERENCES projects(id) ON DELETE CASCADE,
        content     TEXT NOT NULL,
        created_at  TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX idx_comments_task    ON comments(task_id);
      CREATE INDEX idx_comments_project ON comments(project_id);

      -- Activity log
      CREATE TABLE activity_log (
        id          TEXT PRIMARY KEY,
        entity_type TEXT NOT NULL,
        entity_id   TEXT NOT NULL,
        action      TEXT NOT NULL,
        details     TEXT,
        created_at  TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX idx_activity_entity ON activity_log(entity_type, entity_id);
      CREATE INDEX idx_activity_date   ON activity_log(created_at);

      -- Auto-update triggers (WHEN guard prevents infinite recursion)
      CREATE TRIGGER trg_projects_updated AFTER UPDATE ON projects
      WHEN NEW.updated_at = OLD.updated_at
      BEGIN
        UPDATE projects SET updated_at = datetime('now') WHERE id = NEW.id;
      END;

      CREATE TRIGGER trg_sections_updated AFTER UPDATE ON sections
      WHEN NEW.updated_at = OLD.updated_at
      BEGIN
        UPDATE sections SET updated_at = datetime('now') WHERE id = NEW.id;
      END;

      CREATE TRIGGER trg_tasks_updated AFTER UPDATE ON tasks
      WHEN NEW.updated_at = OLD.updated_at
      BEGIN
        UPDATE tasks SET updated_at = datetime('now') WHERE id = NEW.id;
      END;

      CREATE TRIGGER trg_comments_updated AFTER UPDATE ON comments
      WHEN NEW.updated_at = OLD.updated_at
      BEGIN
        UPDATE comments SET updated_at = datetime('now') WHERE id = NEW.id;
      END;
    `);

    // Seed the Inbox project
    db.prepare(`
      INSERT OR IGNORE INTO projects (id, name, is_inbox, sort_order)
      VALUES ('inbox', 'Inbox', 1, 0)
    `).run();
  },

  // Version 2: persist project view mode (list or map)
  (db) => {
    db.exec(`
      ALTER TABLE projects
      ADD COLUMN view_mode TEXT NOT NULL DEFAULT 'list'
      CHECK(view_mode IN ('list', 'map'));
    `);
  },

  // Version 3: workspace docs persistence tables
  (db) => {
    db.exec(`
      CREATE TABLE workspace_items (
        id            TEXT PRIMARY KEY,
        type          TEXT NOT NULL CHECK(type IN ('folder','doc','project')),
        name          TEXT NOT NULL,
        parent_id     TEXT REFERENCES workspace_items(id) ON DELETE CASCADE,
        sort_order    INTEGER NOT NULL DEFAULT 0,
        collapsed     INTEGER,
        project_kind  TEXT,
        created_at    TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX idx_workspace_items_parent_sort
      ON workspace_items(parent_id, sort_order);

      CREATE TABLE workspace_docs (
        doc_id       TEXT PRIMARY KEY REFERENCES workspace_items(id) ON DELETE CASCADE,
        markdown     TEXT NOT NULL DEFAULT '',
        updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE workspace_meta (
        key     TEXT PRIMARY KEY,
        value   TEXT NOT NULL
      );

      CREATE TRIGGER trg_workspace_items_updated AFTER UPDATE ON workspace_items
      WHEN NEW.updated_at = OLD.updated_at
      BEGIN
        UPDATE workspace_items SET updated_at = datetime('now') WHERE id = NEW.id;
      END;

      CREATE TRIGGER trg_workspace_docs_updated AFTER UPDATE ON workspace_docs
      WHEN NEW.updated_at = OLD.updated_at
      BEGIN
        UPDATE workspace_docs SET updated_at = datetime('now') WHERE doc_id = NEW.doc_id;
      END;
    `);
  },
];

function runMigrations(db: Database.Database): void {
  const currentVersion = db.pragma("user_version", { simple: true }) as number;

  for (let i = currentVersion; i < MIGRATIONS.length; i++) {
    console.log(`[task-db] Running migration ${i + 1}`);
    db.transaction(() => {
      MIGRATIONS[i](db);
      db.pragma(`user_version = ${i + 1}`);
    })();
  }
}

export function initTaskDb(dbPath: string): void {
  if (db) return;

  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("synchronous = NORMAL");
  db.pragma("foreign_keys = ON");

  runMigrations(db);
  console.log("[task-db] Initialized:", dbPath);
}

export function getTaskDb(): Database.Database {
  if (!db) throw new Error("[task-db] Not initialized — call initTaskDb() first");
  return db;
}

export function closeTaskDb(): void {
  if (db) {
    db.close();
    db = null;
    console.log("[task-db] Closed");
  }
}
