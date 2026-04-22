"use client";

import { PROVIDER_MODELS } from "@/lib/models";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

interface ProviderFormProps {
  existingModels: string[];
  onSuccess?: () => void;
}

export function ProviderForm({ existingModels, onSuccess }: ProviderFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [loading, setLoading] = useState(false);
  const [provider, setProvider] = useState("");
  const [model, setModel] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const data = { name: provider, model };

    try {
      const res = await fetch("/api/providers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (res.ok) {
        setProvider("");
        setModel("");
        startTransition(() => {
          router.refresh();
        });
        onSuccess?.();
      } else {
        const result = await res.json();
        setError(result.error || "Failed to add provider");
      }
    } catch (err) {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  const allModels = provider ? PROVIDER_MODELS[provider] || [] : [];
  const availableModels = allModels.filter((m) => !existingModels.includes(m));
  const isSubmitting = loading || isPending;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="text-red-500 text-sm border border-red-500 p-2">
          {error}
        </div>
      )}

      <div>
        <label
          htmlFor="name"
          className="block text-xs text-[#888] uppercase tracking-wider mb-1"
        >
          Provider
        </label>
        <select
          id="name"
          name="name"
          required
          value={provider}
          onChange={(e) => {
            setProvider(e.target.value);
            setModel("");
            setError("");
          }}
          className="w-full px-3 py-2 pr-10 bg-black border border-[#333] text-white focus:border-white focus:outline-none"
        >
          <option value="">Select...</option>
          <option value="openai">OpenAI</option>
          <option value="anthropic">Anthropic</option>
          <option value="google">Google</option>
        </select>
      </div>

      <div>
        <label
          htmlFor="model"
          className="block text-xs text-[#888] uppercase tracking-wider mb-1"
        >
          Model
        </label>
        <select
          id="model"
          name="model"
          required
          disabled={!provider || availableModels.length === 0}
          value={model}
          onChange={(e) => {
            setModel(e.target.value);
            setError("");
          }}
          className="w-full px-3 py-2 pr-10 bg-black border border-[#333] text-white focus:border-white focus:outline-none disabled:opacity-50"
        >
          <option value="">
            {!provider
              ? "Select provider first"
              : availableModels.length === 0
                ? "All models added"
                : "Select model..."}
          </option>
          {availableModels.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </div>

      <button
        type="submit"
        disabled={isSubmitting || !provider || !model}
        className="w-full bg-white text-black py-2 px-4 font-medium hover:bg-[#ddd] disabled:opacity-50 transition-colors"
      >
        {isSubmitting ? "Adding..." : "Add"}
      </button>
    </form>
  );
}
