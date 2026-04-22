"use client";

import { useRouter, useSearchParams } from "next/navigation";

interface Provider {
  id: string;
  name: string;
  model: string;
}

export function InsightsFilter({ providers }: { providers: Provider[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const selectedProvider = searchParams.get("provider") || "";
  const selectedModel = searchParams.get("model") || "";

  // Get unique provider names
  const providerNames = [...new Set(providers.map((p) => p.name))];

  // Get models for selected provider
  const modelsForProvider = selectedProvider
    ? providers.filter((p) => p.name === selectedProvider).map((p) => p.model)
    : [];

  function updateFilter(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    // Reset model when provider changes
    if (key === "provider") {
      params.delete("model");
    }
    router.push(`/?${params.toString()}`);
  }

  return (
    <div className="flex items-center gap-4 mb-8">
      <div className="flex items-center gap-2">
        <label htmlFor="provider-filter" className="text-sm text-[#888]">
          Provider:
        </label>
        <select
          id="provider-filter"
          value={selectedProvider}
          onChange={(e) => updateFilter("provider", e.target.value)}
          className="px-3 py-1.5 bg-black border border-[#333] text-white text-sm focus:border-white focus:outline-none"
        >
          <option value="">All Providers</option>
          {providerNames.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </div>

      {selectedProvider && modelsForProvider.length > 0 && (
        <div className="flex items-center gap-2">
          <label htmlFor="model-filter" className="text-sm text-[#888]">
            Model:
          </label>
          <select
            id="model-filter"
            value={selectedModel}
            onChange={(e) => updateFilter("model", e.target.value)}
            className="px-3 py-1.5 bg-black border border-[#333] text-white text-sm focus:border-white focus:outline-none"
          >
            <option value="">All Models</option>
            {modelsForProvider.map((model) => (
              <option key={model} value={model}>
                {model}
              </option>
            ))}
          </select>
        </div>
      )}

      {(selectedProvider || selectedModel) && (
        <button
          type="button"
          onClick={() => router.push("/")}
          className="text-sm text-[#888] hover:text-white underline"
        >
          Clear filters
        </button>
      )}
    </div>
  );
}
