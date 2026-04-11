import { ipcMain } from "electron";
import path from "path";
import fs from "fs";
import { isValidProvider } from "../../shared/ai-provider";
import {
  ensureApiKeysV2,
  getApiKeysStatus,
  getStoredApiKey,
  setStoredApiKey,
} from "./api-keys";

// Store user data in the repo root for git-based cloud sync
const repoRoot = path.resolve(__dirname, "../..");
const dataFilePath = () => path.join(repoRoot, "project-magi-data.json");

// --- API Key ---

ipcMain.handle("apiKey:get", async () => {
  try {
    const state = ensureApiKeysV2();
    if (state.providers.anthropic) return state.providers.anthropic;
    // Fall back to environment variable
    return process.env.ANTHROPIC_API_KEY ?? null;
  } catch {
    return process.env.ANTHROPIC_API_KEY ?? null;
  }
});

ipcMain.handle("apiKey:set", async (_event, key: string) => {
  try {
    setStoredApiKey("anthropic", key);
    return { ok: true };
  } catch (err: unknown) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
});

ipcMain.handle("apiKeys:getStatus", async () => {
  try {
    const status = getApiKeysStatus();
    return { ok: true, ...status };
  } catch (err: unknown) {
    return {
      ok: false,
      anthropicConfigured: false,
      openaiConfigured: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
});

ipcMain.handle(
  "apiKeys:set",
  async (_event, payload: { provider?: unknown; key?: unknown }) => {
    try {
      const provider = payload?.provider;
      const key = payload?.key;
      if (!isValidProvider(provider)) {
        return { ok: false, error: "Invalid provider." };
      }
      if (typeof key !== "string") {
        return { ok: false, error: "Key must be a string." };
      }
      setStoredApiKey(provider, key);
      return { ok: true };
    } catch (err: unknown) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }
);

ipcMain.handle("apiKeys:getForProvider", async (_event, provider: unknown) => {
  try {
    if (!isValidProvider(provider)) {
      return { ok: false, error: "Invalid provider.", key: null };
    }
    const key = getStoredApiKey(provider);
    return { ok: true, key };
  } catch (err: unknown) {
    return {
      ok: false,
      key: null,
      error: err instanceof Error ? err.message : String(err),
    };
  }
});

// --- Data persistence ---

ipcMain.handle("data:load", async () => {
  try {
    const filePath = dataFilePath();
    if (!fs.existsSync(filePath)) return null;
    return fs.readFileSync(filePath, "utf-8");
  } catch {
    return null;
  }
});

ipcMain.handle("data:save", async (_event, json: string) => {
  try {
    fs.writeFileSync(dataFilePath(), json, "utf-8");
  } catch (err) {
    console.error("[data:save]", err);
  }
});
