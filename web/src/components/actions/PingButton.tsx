"use client";

import { Spinner } from "@/components/ui/Icons";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

interface Progress {
  completed: number;
  total: number;
  successful: number;
  failed: number;
}

export function PingButton({ promptId }: { promptId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState<Progress | null>(null);

  async function handlePing() {
    setLoading(true);
    setError("");
    setProgress(null);

    try {
      const response = await fetch("/api/ping", {
        method: "POST",
        headers: {
          Accept: "text/event-stream",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ promptId }),
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data.error || "Failed to ping");
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
    buttonContent = "Ping";
  }

  return (
    <div className="flex items-center gap-2">
      {error && <span className="text-xs text-red-500">{error}</span>}
      <button
        type="button"
        onClick={handlePing}
        disabled={isRunning}
        className="px-3 py-1.5 text-sm bg-white text-black font-medium hover:bg-[#ddd] disabled:opacity-50 transition-colors flex items-center gap-2 min-w-[100px] justify-center"
      >
        {buttonContent}
      </button>
    </div>
  );
}
