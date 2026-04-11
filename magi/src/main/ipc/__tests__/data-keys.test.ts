import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  ensureApiKeysV2,
  getApiKeysStatus,
  getStoredApiKey,
  readApiKeys,
  setStoredApiKey,
} from "../api-keys";

const tempDirs: string[] = [];

function makeTempKeyFile(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "magi-keys-"));
  tempDirs.push(dir);
  return path.join(dir, "api-key.json");
}

afterEach(() => {
  for (const dir of tempDirs) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  tempDirs.length = 0;
});

describe("api key storage", () => {
  it("migrates legacy key format to anthropic provider slot", () => {
    const file = makeTempKeyFile();
    fs.writeFileSync(file, JSON.stringify({ key: "sk-ant-legacy" }), "utf8");

    const state = ensureApiKeysV2(file);
    expect(state.version).toBe(2);
    expect(state.providers.anthropic).toBe("sk-ant-legacy");
    expect(state.providers.openai).toBeUndefined();

    const roundTrip = readApiKeys(file);
    expect(roundTrip.providers.anthropic).toBe("sk-ant-legacy");
  });

  it("stores independent provider keys", () => {
    const file = makeTempKeyFile();

    setStoredApiKey("anthropic", "sk-ant-1", file);
    setStoredApiKey("openai", "sk-openai-1", file);

    expect(getStoredApiKey("anthropic", file)).toBe("sk-ant-1");
    expect(getStoredApiKey("openai", file)).toBe("sk-openai-1");
  });

  it("reports configured status per provider", () => {
    const file = makeTempKeyFile();
    setStoredApiKey("openai", "sk-openai-1", file);

    const status = getApiKeysStatus(file);
    expect(status).toEqual({
      anthropicConfigured: false,
      openaiConfigured: true,
    });
  });
});
