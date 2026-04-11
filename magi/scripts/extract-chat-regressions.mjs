#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const inputPath =
  process.argv[2] ?? path.join(repoRoot, "project-magi-data.json");
const outputPath =
  process.argv[3] ??
  path.join(
    repoRoot,
    "src/main/ipc/__tests__/fixtures/chat-regressions.generated.json"
  );

function isRegressionText(text) {
  return (
    /no output generated/i.test(text) ||
    /^error:/i.test(text) ||
    /^error \[[a-z_]+\]:/i.test(text)
  );
}

function truncate(text, max = 320) {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}

function collectCases(data) {
  const rows = [];
  const threads = Array.isArray(data?.threads) ? data.threads : [];

  for (const thread of threads) {
    const threadId = typeof thread?.id === "string" ? thread.id : null;
    const messages = Array.isArray(thread?.messages) ? thread.messages : [];
    for (const message of messages) {
      if (message?.role !== "ai" || typeof message?.text !== "string") continue;
      const text = message.text.trim();
      if (!text || !isRegressionText(text)) continue;
      rows.push({
        threadId,
        messageId: typeof message?.id === "string" ? message.id : null,
        text: truncate(text),
      });
    }
  }

  return rows;
}

const raw = fs.readFileSync(inputPath, "utf8");
const parsed = JSON.parse(raw);
const cases = collectCases(parsed);

const out = {
  generatedAt: new Date().toISOString(),
  source: path.relative(repoRoot, inputPath),
  count: cases.length,
  cases,
};

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(out, null, 2)}\n`, "utf8");
console.log(`Wrote ${cases.length} regression cases to ${outputPath}`);
