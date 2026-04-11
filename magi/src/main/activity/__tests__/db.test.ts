import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { initActivityDb, insertEvent, closeActivityDb, getActivityDb } from "../db";
import { initSession, _resetSession } from "../session";

describe("activity db", () => {
  beforeEach(() => {
    _resetSession();
    initSession();
    initActivityDb(":memory:");
  });

  afterEach(() => {
    closeActivityDb();
  });

  it("creates events table and indexes", () => {
    const db = getActivityDb()!;
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as { name: string }[];
    expect(tables.map((t) => t.name)).toContain("events");

    const indexes = db.prepare("SELECT name FROM sqlite_master WHERE type='index'").all() as { name: string }[];
    const indexNames = indexes.map((i) => i.name);
    expect(indexNames).toContain("idx_events_ts");
    expect(indexNames).toContain("idx_events_kind_ts");
    expect(indexNames).toContain("idx_events_session");
  });

  it("insertEvent stores correct kind, data, session_id, machine", () => {
    insertEvent("clipboard", { text: "hello", length: 5 });

    const db = getActivityDb()!;
    const rows = db.prepare("SELECT * FROM events").all() as {
      id: string;
      ts: number;
      kind: string;
      data: string;
      session_id: string;
      machine: string;
    }[];

    expect(rows).toHaveLength(1);
    const row = rows[0];
    expect(row.kind).toBe("clipboard");
    expect(JSON.parse(row.data)).toEqual({ text: "hello", length: 5 });
    expect(row.session_id).toBeTruthy();
    expect(row.machine).toBeTruthy();
    expect(row.id).toMatch(/^[0-9a-f]{8}-/);
  });

  it("multiple inserts get unique IDs", () => {
    insertEvent("typing_start", {});
    insertEvent("typing_start", {});

    const db = getActivityDb()!;
    const rows = db.prepare("SELECT id FROM events").all() as { id: string }[];
    expect(rows).toHaveLength(2);
    expect(rows[0].id).not.toBe(rows[1].id);
  });

  it("throws if not initialized", () => {
    closeActivityDb();
    expect(() => insertEvent("clipboard", { text: "x", length: 1 })).toThrow("[activity-db] Not initialized");
  });
});
