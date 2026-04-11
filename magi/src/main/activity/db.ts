import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import type { EventKind, EventData } from "./types";
import { getSessionId, getMachine } from "./session";

let db: Database.Database | null = null;
let insertStmt: Database.Statement | null = null;

export function initActivityDb(dbPath: string): void {
  if (db) return;

  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("synchronous = NORMAL");

  db.exec(`
    CREATE TABLE IF NOT EXISTS events (
      id         TEXT PRIMARY KEY,
      ts         INTEGER NOT NULL,
      kind       TEXT NOT NULL,
      data       TEXT NOT NULL,
      session_id TEXT NOT NULL,
      goal_id    TEXT,
      machine    TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_events_ts ON events(ts);
    CREATE INDEX IF NOT EXISTS idx_events_kind_ts ON events(kind, ts);
    CREATE INDEX IF NOT EXISTS idx_events_session ON events(session_id);
  `);

  insertStmt = db.prepare(
    `INSERT INTO events (id, ts, kind, data, session_id, machine) VALUES (?, ?, ?, ?, ?, ?)`
  );

  console.log("[activity-db] Initialized:", dbPath);
}

export function insertEvent(kind: EventKind, data: EventData): void {
  if (!insertStmt) throw new Error("[activity-db] Not initialized");
  insertStmt.run(
    randomUUID(),
    Date.now(),
    kind,
    JSON.stringify(data),
    getSessionId(),
    getMachine()
  );
}

export interface RawActivityEvent {
  kind: string;
  ts: number;
  data: string;
}

export function queryRecentEvents(sinceMs: number, limit = 50): RawActivityEvent[] {
  if (!db) return [];
  const stmt = db.prepare(
    `SELECT kind, ts, data FROM events WHERE ts > ? ORDER BY ts DESC LIMIT ?`
  );
  return stmt.all(sinceMs, limit) as RawActivityEvent[];
}

export function getActivityDb(): Database.Database | null {
  return db;
}

export function closeActivityDb(): void {
  if (db) {
    insertStmt = null;
    db.close();
    db = null;
    console.log("[activity-db] Closed");
  }
}
