import fs from "node:fs";
import path from "node:path";
import { app } from "electron";
import type { ContextWindow, FailureClassification, AttemptUsage } from "./chat-reliability";
import type { AIProvider } from "../../shared/ai-provider";

const DEFAULT_FILE_NAME = "chat-reliability.jsonl";
const DEFAULT_MAX_BYTES = 5 * 1024 * 1024;
const DEFAULT_MAX_FILES = 3;

export type DiagnosticsEntry = {
  ts: string;
  streamId: string;
  provider: AIProvider;
  attempt: number;
  model: string;
  messageCount: number;
  contextWindow: ContextWindow;
  classification: FailureClassification;
  retriable: boolean;
  emittedContent: boolean;
  emittedToolCalls: boolean;
  cancelled?: boolean;
  promptCacheKeyApplied?: boolean;
  latencyMs: number;
  error?: string;
  usage?: AttemptUsage;
};

export type DiagnosticsWriter = {
  write: (entry: DiagnosticsEntry) => void;
  logPath: string;
};

function rotateLogs(basePath: string, maxFiles: number): void {
  for (let i = maxFiles - 1; i >= 1; i -= 1) {
    const src = i === 1 ? basePath : `${basePath}.${i - 1}`;
    const dst = `${basePath}.${i}`;
    if (fs.existsSync(dst)) {
      fs.rmSync(dst, { force: true });
    }
    if (fs.existsSync(src)) {
      fs.renameSync(src, dst);
    }
  }
}

export function createChatDiagnosticsWriter(options?: {
  logDir?: string;
  fileName?: string;
  maxBytes?: number;
  maxFiles?: number;
  logger?: Pick<Console, "warn">;
}): DiagnosticsWriter {
  const logDir = options?.logDir ?? app.getPath("userData");
  const fileName = options?.fileName ?? DEFAULT_FILE_NAME;
  const maxBytes = options?.maxBytes ?? DEFAULT_MAX_BYTES;
  const maxFiles = options?.maxFiles ?? DEFAULT_MAX_FILES;
  const logger = options?.logger ?? console;
  const logPath = path.join(logDir, fileName);

  return {
    logPath,
    write(entry) {
      try {
        fs.mkdirSync(logDir, { recursive: true });
        const line = `${JSON.stringify(entry)}\n`;
        const nextBytes = Buffer.byteLength(line);

        if (fs.existsSync(logPath)) {
          const currentSize = fs.statSync(logPath).size;
          if (currentSize + nextBytes > maxBytes) {
            rotateLogs(logPath, maxFiles);
          }
        }

        fs.appendFileSync(logPath, line, "utf8");
      } catch (error) {
        logger.warn("[chat] diagnostics write failed:", error);
      }
    },
  };
}

let sharedWriter: DiagnosticsWriter | null = null;

export function writeChatDiagnosticsEntry(entry: DiagnosticsEntry): void {
  if (!sharedWriter) {
    sharedWriter = createChatDiagnosticsWriter();
  }
  sharedWriter.write(entry);
}
