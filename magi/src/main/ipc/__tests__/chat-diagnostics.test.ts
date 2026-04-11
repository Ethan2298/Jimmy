import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createChatDiagnosticsWriter, type DiagnosticsEntry } from "../chat-diagnostics";

function makeEntry(attempt: number): DiagnosticsEntry {
  return {
    ts: new Date("2026-02-26T00:00:00.000Z").toISOString(),
    streamId: "stream-1",
    provider: "anthropic",
    attempt,
    model: "claude-sonnet-4-6",
    messageCount: 30,
    contextWindow: "full",
    classification: "unknown",
    retriable: false,
    emittedContent: true,
    emittedToolCalls: false,
    latencyMs: 120,
    usage: {
      inputTokens: 1200,
      outputTokens: 80,
      totalTokens: 1280,
      cacheReadTokens: 100,
      cacheWriteTokens: 20,
    },
  };
}

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  tempDirs.length = 0;
});

describe("chat diagnostics writer", () => {
  it("writes one JSONL line per entry", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "magi-diag-"));
    tempDirs.push(dir);

    const writer = createChatDiagnosticsWriter({ logDir: dir });
    writer.write(makeEntry(1));

    const contents = fs.readFileSync(writer.logPath, "utf8").trim();
    const parsed = JSON.parse(contents) as DiagnosticsEntry;
    expect(parsed.attempt).toBe(1);
    expect(parsed.model).toBe("claude-sonnet-4-6");
  });

  it("rotates logs at configured max size and keeps up to 3 files", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "magi-diag-"));
    tempDirs.push(dir);

    const writer = createChatDiagnosticsWriter({
      logDir: dir,
      maxBytes: 300,
      maxFiles: 3,
    });

    for (let i = 1; i <= 10; i += 1) {
      writer.write(makeEntry(i));
    }

    expect(fs.existsSync(writer.logPath)).toBe(true);
    expect(fs.existsSync(`${writer.logPath}.1`)).toBe(true);
    expect(fs.existsSync(`${writer.logPath}.2`)).toBe(true);
    expect(fs.existsSync(`${writer.logPath}.3`)).toBe(false);
  });

  it("fails open when writes error", () => {
    const logger = { warn: vi.fn() };
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "magi-diag-"));
    tempDirs.push(dir);

    const asFile = path.join(dir, "not-a-directory");
    fs.writeFileSync(asFile, "x", "utf8");

    const writer = createChatDiagnosticsWriter({
      logDir: asFile,
      logger,
    });

    expect(() => writer.write(makeEntry(1))).not.toThrow();
    expect(logger.warn).toHaveBeenCalled();
  });
});
