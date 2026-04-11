import { describe, expect, it } from "vitest";
import { getThreadVisibility, THREAD_COLLAPSE_LIMIT } from "../thread-visibility";
import type { ChatThread } from "../chat-threads";

function buildThreads(count: number): ChatThread[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `thread-${index + 1}`,
    title: `Thread ${index + 1}`,
    messages: [],
    createdAt: `2026-01-${String((index % 28) + 1).padStart(2, "0")}T10:00:00.000Z`,
    updatedAt: `2026-01-${String((index % 28) + 1).padStart(2, "0")}T11:00:00.000Z`,
  }));
}

describe("thread visibility", () => {
  it("shows all threads and hides toggle when count is at or under the limit", () => {
    const threads = buildThreads(THREAD_COLLAPSE_LIMIT);
    const result = getThreadVisibility(threads, false);

    expect(result.canToggle).toBe(false);
    expect(result.hiddenCount).toBe(0);
    expect(result.visibleThreads).toHaveLength(THREAD_COLLAPSE_LIMIT);
  });

  it("shows only threshold threads when collapsed and over limit", () => {
    const threads = buildThreads(THREAD_COLLAPSE_LIMIT + 4);
    const result = getThreadVisibility(threads, false);

    expect(result.canToggle).toBe(true);
    expect(result.visibleThreads).toHaveLength(THREAD_COLLAPSE_LIMIT);
    expect(result.hiddenCount).toBe(4);
  });

  it("shows all threads when expanded", () => {
    const threads = buildThreads(THREAD_COLLAPSE_LIMIT + 3);
    const expanded = getThreadVisibility(threads, true);
    const collapsed = getThreadVisibility(threads, false);

    expect(expanded.visibleThreads).toHaveLength(THREAD_COLLAPSE_LIMIT + 3);
    expect(expanded.hiddenCount).toBe(0);
    expect(collapsed.visibleThreads).toHaveLength(THREAD_COLLAPSE_LIMIT);
  });
});
