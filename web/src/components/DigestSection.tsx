"use client";

import { DemoTooltip } from "@/components/ui/DemoTooltip";
import { RefreshCw, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";

const THINKING_MESSAGES = [
  "Analyzing mention patterns...",
  "Comparing sentiment across providers...",
  "Evaluating competitive positioning...",
  "Identifying ranking trends...",
  "Synthesizing insights...",
  "Crafting your digest...",
];

export function DigestSection({ hasData }: { hasData: boolean }) {
  const [digest, setDigest] = useState<string | null>(null);
  const [createdAt, setCreatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [thinkingIndex, setThinkingIndex] = useState(0);

  // Load the latest digest on mount
  useEffect(() => {
    async function loadDigest() {
      try {
        const res = await fetch("/api/digest");
        const data = await res.json();
        if (data.digest) {
          setDigest(data.digest);
          setCreatedAt(data.createdAt);
        }
      } catch {
        console.error("Failed to load digest");
      } finally {
        setInitialLoading(false);
      }
    }
    loadDigest();
  }, []);

  // Cycle through thinking messages while loading
  useEffect(() => {
    if (!loading) {
      setThinkingIndex(0);
      return;
    }

    const interval = setInterval(() => {
      setThinkingIndex((i) => (i + 1) % THINKING_MESSAGES.length);
    }, 2000);

    return () => clearInterval(interval);
  }, [loading]);

  async function generateDigest() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/digest", { method: "POST" });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to generate digest");
        return;
      }

      setDigest(data.digest);
      setCreatedAt(data.createdAt);
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  function formatDate(dateStr: string) {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }

  if (initialLoading) {
    return (
      <div className="bg-[#111] border border-[#222] p-6 mb-8">
        <div className="flex items-center gap-3 text-[#666]">
          <Sparkles className="w-5 h-5" />
          <span>Loading insights...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#111] border border-[#222] p-6 mb-8">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-medium text-[#888] uppercase tracking-wider">
            AI Insights
          </h2>
          {createdAt && (
            <span className="text-xs text-[#555]">
              Updated {formatDate(createdAt)}
            </span>
          )}
        </div>
        {digest && (
          <DemoTooltip>
            <button
              type="button"
              onClick={generateDigest}
              disabled={loading}
              className="p-1.5 border border-[#333] text-[#666] hover:border-white hover:text-white disabled:opacity-50 transition-colors"
              title="Regenerate insights"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>
          </DemoTooltip>
        )}
      </div>

      {error && <div className="text-red-500 text-sm mb-4">{error}</div>}

      {!digest && !loading && (
        <div className="flex flex-col items-center justify-center py-4">
          <p className="text-[#666] mb-4">
            {hasData
              ? "Generate an AI-powered analysis of your competitive positioning."
              : "Run some prompts and analyze responses first to generate insights."}
          </p>
          <DemoTooltip>
            <button
              type="button"
              onClick={generateDigest}
              disabled={loading || !hasData}
              className="flex items-center gap-2 px-4 py-2 bg-white text-black font-medium hover:bg-[#ddd] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Sparkles className="w-4 h-4" />
              Generate Insights
            </button>
          </DemoTooltip>
        </div>
      )}

      {loading && (
        <div className="flex items-center gap-3 text-[#888] py-6">
          <Sparkles className="w-5 h-5 animate-pulse text-white" />
          <span className="transition-opacity duration-300">
            {THINKING_MESSAGES[thinkingIndex]}
          </span>
        </div>
      )}

      {digest && !loading && (
        <div className="prose prose-invert prose-sm max-w-none text-[#ccc]">
          <ReactMarkdown
            components={{
              p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
              strong: ({ children }) => (
                <strong className="text-white font-semibold">{children}</strong>
              ),
              em: ({ children }) => <em className="text-[#aaa]">{children}</em>,
              ul: ({ children }) => (
                <ul className="list-disc list-inside mb-2">{children}</ul>
              ),
              li: ({ children }) => <li className="mb-1">{children}</li>,
            }}
          >
            {digest}
          </ReactMarkdown>
        </div>
      )}
    </div>
  );
}
