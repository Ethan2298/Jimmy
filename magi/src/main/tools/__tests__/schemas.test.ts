import { describe, it, expect } from "vitest";
import {
  createTaskSchema,
  listTasksSchema,
  manageProjectSchema,
  updateTaskSchema,
} from "../schemas";

describe("tool schemas date validation", () => {
  it("accepts ISO date and datetime for due_date", () => {
    expect(createTaskSchema.safeParse({ title: "A", due_date: "2026-03-01" }).success).toBe(true);
    expect(
      createTaskSchema.safeParse({
        title: "A",
        due_date: "2026-03-01T12:30:00.000Z",
      }).success
    ).toBe(true);
  });

  it("rejects invalid due_date values", () => {
    expect(createTaskSchema.safeParse({ title: "A", due_date: "03/01/2026" }).success).toBe(false);
    expect(updateTaskSchema.safeParse({ task_id: "t1", due_date: "not-a-date" }).success).toBe(false);
  });

  it("validates due_before and due_after", () => {
    expect(listTasksSchema.safeParse({ due_before: "2026-01-15" }).success).toBe(true);
    expect(listTasksSchema.safeParse({ due_after: "2026-01-15T09:00:00Z" }).success).toBe(true);
    expect(listTasksSchema.safeParse({ due_before: "15-01-2026" }).success).toBe(false);
  });

  it("validates project view_mode for map/list", () => {
    expect(
      manageProjectSchema.safeParse({
        action: "create",
        name: "Atlas",
        view_mode: "map",
      }).success
    ).toBe(true);
    expect(
      manageProjectSchema.safeParse({
        action: "update",
        project_id: "p1",
        view_mode: "list",
      }).success
    ).toBe(true);
    expect(
      manageProjectSchema.safeParse({
        action: "update",
        project_id: "p1",
        view_mode: "board",
      }).success
    ).toBe(false);
  });
});
