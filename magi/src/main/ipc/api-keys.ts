import fs from "node:fs";
import path from "node:path";
import { app } from "electron";
import type { AIProvider } from "../../shared/ai-provider";

const KEY_FILE_NAME = "api-key.json";

type ProviderKeyMap = Partial<Record<AIProvider, string>>;

export type ApiKeysFileV2 = {
  version: 2;
  providers: ProviderKeyMap;
};

function getDataDir(): string {
  const dir = app.getPath("userData");
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

export function getApiKeysFilePath(customPath?: string): string {
  return customPath ?? path.join(getDataDir(), KEY_FILE_NAME);
}

function tightenFilePermissions(filePath: string): void {
  if (process.platform === "win32") return;
  try {
    fs.chmodSync(filePath, 0o600);
  } catch {
    // Best effort.
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object";
}

function asNonEmptyString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function normalizeV2(input: unknown): ApiKeysFileV2 {
  if (!isRecord(input)) {
    return { version: 2, providers: {} };
  }

  if (input.version === 2 && isRecord(input.providers)) {
    const anthropic = asNonEmptyString(input.providers.anthropic);
    const openai = asNonEmptyString(input.providers.openai);
    return {
      version: 2,
      providers: {
        ...(anthropic ? { anthropic } : {}),
        ...(openai ? { openai } : {}),
      },
    };
  }

  const legacyKey = asNonEmptyString(input.key);
  if (legacyKey) {
    return {
      version: 2,
      providers: { anthropic: legacyKey },
    };
  }

  return { version: 2, providers: {} };
}

export function readApiKeys(filePathArg?: string): ApiKeysFileV2 {
  const filePath = getApiKeysFilePath(filePathArg);
  if (!fs.existsSync(filePath)) {
    return { version: 2, providers: {} };
  }

  try {
    tightenFilePermissions(filePath);
    const raw = fs.readFileSync(filePath, "utf8");
    return normalizeV2(JSON.parse(raw));
  } catch {
    return { version: 2, providers: {} };
  }
}

export function writeApiKeys(data: ApiKeysFileV2, filePathArg?: string): void {
  const filePath = getApiKeysFilePath(filePathArg);
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(filePath, JSON.stringify(data), {
    encoding: "utf8",
    mode: 0o600,
  });
  tightenFilePermissions(filePath);
}

export function ensureApiKeysV2(filePathArg?: string): ApiKeysFileV2 {
  const current = readApiKeys(filePathArg);
  writeApiKeys(current, filePathArg);
  return current;
}

export function setStoredApiKey(
  provider: AIProvider,
  key: string,
  filePathArg?: string
): ApiKeysFileV2 {
  const state = ensureApiKeysV2(filePathArg);
  const trimmed = key.trim();
  const nextProviders = { ...state.providers };
  if (trimmed) {
    nextProviders[provider] = trimmed;
  } else {
    delete nextProviders[provider];
  }
  const nextState: ApiKeysFileV2 = {
    version: 2,
    providers: nextProviders,
  };
  writeApiKeys(nextState, filePathArg);
  return nextState;
}

export function getStoredApiKey(
  provider: AIProvider,
  filePathArg?: string
): string | null {
  const state = readApiKeys(filePathArg);
  return state.providers[provider] ?? null;
}

export function getApiKeysStatus(filePathArg?: string): {
  anthropicConfigured: boolean;
  openaiConfigured: boolean;
} {
  const state = readApiKeys(filePathArg);
  return {
    anthropicConfigured: !!state.providers.anthropic,
    openaiConfigured: !!state.providers.openai,
  };
}
