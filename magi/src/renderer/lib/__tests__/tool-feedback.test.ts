import { describe, expect, it } from "vitest";
import type { ToolMessagePart } from "../ai";
import { resolveToolFeedback } from "../tool-feedback/resolve";

function makePart(overrides: Record<string, unknown>): ToolMessagePart {
  return {
    type: "dynamic-tool",
    toolName: "search_tasks",
    toolCallId: "tc1",
    state: "input-available",
    input: {},
    ...overrides,
  } as ToolMessagePart;
}

describe("tool feedback resolver", () => {
  it("renders search tasks as running, done, and failed", () => {
    const running = resolveToolFeedback({
      toolName: "search_tasks",
      part: makePart({
        toolName: "search_tasks",
        state: "input-available",
        input: { query: "budget" },
      }),
    });
    expect(running.tone).toBe("running");
    expect(running.line).toBe("Searching tasks…");

    const done = resolveToolFeedback({
      toolName: "search_tasks",
      part: makePart({
        toolName: "search_tasks",
        state: "output-available",
        input: { query: "budget" },
        output: { count: 12, tasks: [] },
      }),
    });
    expect(done.tone).toBe("done");
    expect(done.line).toBe("Searched 12 tasks");

    const failed = resolveToolFeedback({
      toolName: "search_tasks",
      part: makePart({
        toolName: "search_tasks",
        state: "output-error",
        input: { query: "budget" },
        errorText: "boom",
      }),
    });
    expect(failed.tone).toBe("failed");
    expect(failed.line).toBe("Searching tasks failed");
  });

  it("maps update_task into completing vs editing", () => {
    const completing = resolveToolFeedback({
      toolName: "update_task",
      part: makePart({
        toolName: "update_task",
        state: "input-available",
        input: { task_id: "t1", status: "completed" },
      }),
    });
    expect(completing.line).toBe("Completing task…");

    const completed = resolveToolFeedback({
      toolName: "update_task",
      part: makePart({
        toolName: "update_task",
        state: "output-available",
        input: { task_id: "t1", status: "completed" },
        output: { updated: { id: "t1", title: "Database migration" } },
      }),
    });
    expect(completed.line).toBe('Completed "Database migration"');

    const edited = resolveToolFeedback({
      toolName: "update_task",
      part: makePart({
        toolName: "update_task",
        state: "output-available",
        input: { task_id: "t1", title: "Revise onboarding doc" },
        output: { updated: { id: "t1", title: "Revise onboarding doc" } },
      }),
    });
    expect(edited.line).toBe('Edited "Revise onboarding doc"');
  });

  it("extracts create_task title in success line", () => {
    const created = resolveToolFeedback({
      toolName: "create_task",
      part: makePart({
        toolName: "create_task",
        state: "output-available",
        input: { title: "Q3 budget" },
        output: { created: { id: "t2", title: "Q3 budget" } },
      }),
    });
    expect(created.line).toBe('Created "Q3 budget"');
  });

  it("falls back to delete ID when title is unavailable", () => {
    const deleted = resolveToolFeedback({
      toolName: "delete_task",
      part: makePart({
        toolName: "delete_task",
        state: "output-available",
        input: { task_id: "t3" },
        output: { deleted: "t3" },
      }),
    });
    expect(deleted.line).toBe("Deleted task t3");
  });

  it("maps manage_project action copy", () => {
    const running = resolveToolFeedback({
      toolName: "manage_project",
      part: makePart({
        toolName: "manage_project",
        state: "input-available",
        input: { action: "create", name: "Roadmap" },
      }),
    });
    expect(running.line).toBe("Creating project…");

    const done = resolveToolFeedback({
      toolName: "manage_project",
      part: makePart({
        toolName: "manage_project",
        state: "output-available",
        input: { action: "update", project_id: "p1" },
        output: { updated: { id: "p1", name: "Ops" } },
      }),
    });
    expect(done.line).toBe('Updated project "Ops"');
  });

  it("uses fallback module for unknown tools", () => {
    const running = resolveToolFeedback({
      toolName: "sync_calendar_events",
      part: makePart({
        toolName: "sync_calendar_events",
        state: "input-available",
        input: {},
      }),
    });
    expect(running.line).toBe("Working…");

    const done = resolveToolFeedback({
      toolName: "sync_calendar_events",
      part: makePart({
        toolName: "sync_calendar_events",
        state: "output-available",
        input: {},
        output: {},
      }),
    });
    expect(done.line).toBe("Completed");
  });

  it("overrides with approval state when pending approval exists", () => {
    const feedback = resolveToolFeedback({
      toolName: "update_task",
      part: makePart({
        toolName: "update_task",
        state: "input-available",
        input: { task_id: "t1", title: "Name" },
      }),
      approval: {
        approvalId: "a1",
        destructive: false,
        reason: "Requires confirmation",
      },
    });
    expect(feedback.tone).toBe("approval");
    expect(feedback.line).toBe("Awaiting approval");
  });
});
