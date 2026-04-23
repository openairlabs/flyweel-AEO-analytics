export const PROVIDER_MODELS: Record<string, string[]> = {
  openai: ["gpt-5.4", "gpt-5.2"],
  google: ["gemini-3.1-pro-preview", "gemini-3-flash-preview"],
};

export const PROVIDERS = Object.keys(PROVIDER_MODELS) as Array<
  keyof typeof PROVIDER_MODELS
>;
