import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { initTaskDb, closeTaskDb } from "../../db";
import { tasks } from "../../db/queries";
import { createTask, updateTask, listTasks, getOverview } from "../implementations";

function localDateKey(date: Date): string {
  const year = String(date.getFullYear());
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(base: Date, amount: number): Date {
  const next = new Date(base);
  next.setDate(next.getDate() + amount);
  return next;
}

describe("tool implementations", () => {
  beforeEach(() => {
    initTaskDb(":memory:");
  });

  afterEach(() => {
    closeTaskDb();
  });

  it("normalizes due_date inputs on create/update", () => {
    const created = createTask({
      title: "Normalize me",
      due_date: "2026-03-01T08:30:00-05:00",
    });

    const stored = tasks.get(created.created.id);
    expect(stored?.due_date).toMatch(/Z$/);

    updateTask({
      task_id: created.created.id,
      due_date: "2026-03-02",
    });

    const updated = tasks.get(created.created.id);
    expect(updated?.due_date).toBe("2026-03-02");
  });

  it("applies due_before/due_after using normalized day keys", () => {
    const now = new Date();
    const yesterday = localDateKey(addDays(now, -1));
    const today = localDateKey(now);
    const tomorrow = localDateKey(addDays(now, 1));

    createTask({ title: "Yesterday", due_date: yesterday });
    createTask({ title: "Today", due_date: today });
    createTask({ title: "Tomorrow", due_date: tomorrow });

    const beforeToday = listTasks({ due_before: today });
    expect(beforeToday.tasks.map((t) => t.title).sort()).toEqual(["Today", "Yesterday"]);

    const afterToday = listTasks({ due_after: today });
    expect(afterToday.tasks.map((t) => t.title).sort()).toEqual(["Today", "Tomorrow"]);
  });

  it("classifies overview overdue and due_today in local date", () => {
    const now = new Date();
    const yesterday = localDateKey(addDays(now, -1));
    const today = localDateKey(now);
    const tomorrow = localDateKey(addDays(now, 1));

    createTask({ title: "Overdue", due_date: yesterday });
    createTask({ title: "Due Today", due_date: today });
    createTask({ title: "Future", due_date: tomorrow });

    const overview = getOverview();

    expect(overview.stats.overdue).toBe(1);
    expect(overview.stats.due_today).toBe(1);
    expect(overview.overdue_tasks.map((t) => t.title)).toContain("Overdue");
    expect(overview.today_tasks.map((t) => t.title)).toContain("Due Today");
  });
});
