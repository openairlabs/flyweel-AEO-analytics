"use client";

import { Spinner } from "@/components/ui/Icons";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

interface Progress {
  completed: number;
  total: number;
  successful: number;
  failed: number;
}

export function AnalyzeAllButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [count, setCount] = useState<number | null>(null);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [result, setResult] = useState<{
    successful: number;
    failed: number;
  } | null>(null);

  // Fetch unanalyzed count on mount
  useEffect(() => {
    async function fetchCount() {
      try {
        const res = await fetch("/api/analyze-all");
        const data = await res.json();
        setCount(data.count);
      } catch {
        console.error("Failed to fetch unanalyzed count");
      }
    }
    fetchCount();
  }, []);

  async function handleAnalyzeAll() {
    setLoading(true);
    setError("");
    setResult(null);
    setProgress(null);

    try {
      const response = await fetch("/api/analyze-all", {
        method: "POST",
        headers: {
          Accept: "text/event-stream",
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data.error || "Failed to analyze all");
        setLoading(false);
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) {
        setError("Streaming not supported");
        setLoading(false);
        return;
      }

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));

              if (data.type === "start") {
                setProgress({
                  completed: 0,
                  total: data.total,
                  successful: 0,
                  failed: 0,
                });
              } else if (data.type === "progress") {
                setProgress({
                  completed: data.completed,
                  total: data.total,
                  successful: data.successful,
                  failed: data.failed,
                });
              } else if (data.type === "done") {
                setResult({ successful: data.successful, failed: data.failed });
                setCount(0);
                setProgress(null);
              }
            } catch {
              // Ignore parse errors
            }
          }
        }
      }

      startTransition(() => {
        router.refresh();
      });
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  const isRunning = loading || isPending;
  const hasResponsesToAnalyze = count !== null && count > 0;

  // Determine button text
  let buttonContent: React.ReactNode;
  if (loading && progress) {
    buttonContent = (
      <>
        <Spinner />
        {progress.completed} / {progress.total}
      </>
    );
  } else if (loading) {
    buttonContent = (
      <>
        <Spinner />
        Starting...
      </>
    );
  } else if (isPending) {
    buttonContent = (
      <>
        <Spinner />
        Refreshing...
      </>
    );
  } else {
    buttonContent = (
      <>
        Analyze All
        {count !== null && (
          <span className="bg-[#555] px-1.5 py-0.5 text-xs">{count}</span>
        )}
      </>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={handleAnalyzeAll}
        disabled={isRunning || !hasResponsesToAnalyze}
        className="px-4 py-2 text-sm bg-[#333] text-white font-medium hover:bg-[#444] disabled:opacity-50 transition-colors flex items-center gap-2 min-w-[140px] justify-center"
      >
        {buttonContent}
      </button>
      {error && <span className="text-sm text-red-500">{error}</span>}
      {result && !isRunning && (
        <span className="text-sm text-[#888]">
          {result.successful} analyzed, {result.failed} failed
        </span>
      )}
    </div>
  );
}
