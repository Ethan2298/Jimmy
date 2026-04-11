export type AIProvider = "anthropic" | "openai";

export const MODEL_CATALOG = {
  openai: ["gpt-5", "gpt-4.1", "gpt-4.1-mini"],
  anthropic: ["claude-sonnet-4-6", "claude-sonnet-4-5", "claude-3-7-sonnet-latest"],
} as const satisfies Record<AIProvider, readonly string[]>;

export const DEFAULT_PROVIDER: AIProvider = "openai";

export const DEFAULT_MODEL_BY_PROVIDER: Record<AIProvider, string> = {
  openai: "gpt-5",
  anthropic: "claude-sonnet-4-6",
};

export type ModelOption = {
  model: string;
  provider: AIProvider;
};

const PROVIDER_ORDER: readonly AIProvider[] = ["openai", "anthropic"];

const MODEL_OPTIONS: readonly ModelOption[] = PROVIDER_ORDER.flatMap((provider) =>
  MODEL_CATALOG[provider].map((model) => ({ model, provider }))
);

export function isValidProvider(value: unknown): value is AIProvider {
  return value === "anthropic" || value === "openai";
}

export function getModelsForProvider(provider: AIProvider): readonly string[] {
  return MODEL_CATALOG[provider];
}

export function isValidModelForProvider(provider: AIProvider, model: string): boolean {
  const models = MODEL_CATALOG[provider] as readonly string[];
  return models.includes(model);
}

export function getAllModelOptions(): readonly ModelOption[] {
  return MODEL_OPTIONS;
}

export function getProviderForModel(model: string): AIProvider | null {
  for (const provider of PROVIDER_ORDER) {
    if (isValidModelForProvider(provider, model)) {
      return provider;
    }
  }
  return null;
}

export function getDefaultModel(provider: AIProvider): string {
  return DEFAULT_MODEL_BY_PROVIDER[provider];
}
