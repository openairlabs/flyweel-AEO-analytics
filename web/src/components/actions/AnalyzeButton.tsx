"use client";

import { Spinner } from "@/components/ui/Icons";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export function AnalyzeButton({ responseId }: { responseId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleAnalyze() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ responseId }),
      });

      if (res.ok) {
        startTransition(() => {
          router.refresh();
        });
      } else {
        const data = await res.json();
        setError(data.error || "Failed to analyze");
      }
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  const isLoading = loading || isPending;

  return (
    <div className="flex items-center gap-2">
      {error && <span className="text-xs text-red-500">{error}</span>}
      <button
        type="button"
        onClick={handleAnalyze}
        disabled={isLoading}
        className="px-3 py-1.5 text-sm border border-[#333] text-[#888] hover:border-white hover:text-white disabled:opacity-50 transition-colors flex items-center gap-2"
      >
        {isLoading ? (
          <>
            <Spinner />
            Analyzing...
          </>
        ) : (
          "Analyze"
        )}
      </button>
    </div>
  );
}
