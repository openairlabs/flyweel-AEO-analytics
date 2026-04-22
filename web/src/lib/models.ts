export const PROVIDER_MODELS: Record<string, string[]> = {
  openai: ["gpt-5.2", "gpt-5.1", "gpt-5-mini", "gpt-4o", "gpt-4o-mini"],
  anthropic: ["claude-opus-4-5", "claude-sonnet-4-0", "claude-haiku-4-5"],
  google: ["gemini-3-pro-preview", "gemini-2.5-pro", "gemini-2.5-flash"],
};

export const PROVIDERS = Object.keys(PROVIDER_MODELS) as Array<
  keyof typeof PROVIDER_MODELS
>;
