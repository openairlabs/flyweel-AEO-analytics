"use client";

import { Markdown } from "@/components/Markdown";
import { AnalyzeButton } from "@/components/actions/AnalyzeButton";
import { DemoTooltip } from "@/components/ui/DemoTooltip";
import { ChevronIcon, LinkIcon } from "@/components/ui/Icons";
import { useState } from "react";

interface Response {
  id: string;
  content: string;
  latencyMs: number;
  webSearchUsed: boolean | null;
  createdAt: string | Date | null;
  provider: {
    name: string;
    model: string;
  } | null;
  analysis: {
    summary: string | null;
    mentions: Array<{
      id: string;
      sentiment: string;
      ranking: number | null;
      brand: { name: string } | null;
    }>;
    links?: Array<{
      id: string;
      url: string;
      linkText: string | null;
      brand: { name: string } | null;
    }>;
  } | null;
}

// Check if content contains URLs (for quick detection before analysis)
function hasUrls(content: string): boolean {
  return /https?:\/\/[^\s]+/.test(content);
}

// Extract domain from URL
function getDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

type SortOption = "recent" | "oldest" | "provider" | "model" | "latency";

interface GroupedResponses {
  label: string;
  responses: Response[];
}

function formatDateLabel(date: Date): string {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today.toDateString()) {
    return "Today";
  }
  if (date.toDateString() === yesterday.toDateString()) {
    return "Yesterday";
  }
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

export function ResponsesList({ responses }: { responses: Response[] }) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<SortOption>("recent");
  const [filterProvider, setFilterProvider] = useState("");
  const [filterModel, setFilterModel] = useState("");

  // Get unique providers and models
  const providers = [
    ...new Set(responses.map((r) => r.provider?.name).filter(Boolean)),
  ];
  const models = filterProvider
    ? [
        ...new Set(
          responses
            .filter((r) => r.provider?.name === filterProvider)
            .map((r) => r.provider?.model)
            .filter(Boolean),
        ),
      ]
    : [...new Set(responses.map((r) => r.provider?.model).filter(Boolean))];

  // Filter responses
  let filtered = responses.filter((r) => {
    if (filterProvider && r.provider?.name !== filterProvider) return false;
    if (filterModel && r.provider?.model !== filterModel) return false;
    return true;
  });

  // Sort responses
  filtered = [...filtered].sort((a, b) => {
    switch (sortBy) {
      case "recent":
        return (
          new Date(b.createdAt || 0).getTime() -
          new Date(a.createdAt || 0).getTime()
        );
      case "oldest":
        return (
          new Date(a.createdAt || 0).getTime() -
          new Date(b.createdAt || 0).getTime()
        );
      case "provider":
        return (a.provider?.name || "").localeCompare(b.provider?.name || "");
      case "model":
        return (a.provider?.model || "").localeCompare(b.provider?.model || "");
      case "latency":
        return a.latencyMs - b.latencyMs;
      default:
        return 0;
    }
  });

  // Group responses based on sort option
  function groupResponses(): GroupedResponses[] {
    if (sortBy === "recent" || sortBy === "oldest") {
      // Group by date
      const groups = new Map<string, Response[]>();
      for (const response of filtered) {
        const date = new Date(response.createdAt || 0);
        const dateKey = date.toDateString();
        if (!groups.has(dateKey)) {
          groups.set(dateKey, []);
        }
        groups.get(dateKey)!.push(response);
      }
      return Array.from(groups.entries()).map(([dateKey, items]) => ({
        label: formatDateLabel(new Date(dateKey)),
        responses: items,
      }));
    }

    if (sortBy === "provider") {
      // Group by provider
      const groups = new Map<string, Response[]>();
      for (const response of filtered) {
        const key = response.provider?.name || "Unknown";
        if (!groups.has(key)) {
          groups.set(key, []);
        }
        groups.get(key)!.push(response);
      }
      return Array.from(groups.entries()).map(([key, items]) => ({
        label: key,
        responses: items,
      }));
    }

    if (sortBy === "model") {
      // Group by model
      const groups = new Map<string, Response[]>();
      for (const response of filtered) {
        const key = response.provider?.model || "Unknown";
        if (!groups.has(key)) {
          groups.set(key, []);
        }
        groups.get(key)!.push(response);
      }
      return Array.from(groups.entries()).map(([key, items]) => ({
        label: key,
        responses: items,
      }));
    }

    // For latency sort, no grouping - return all as single group
    return [{ label: "", responses: filtered }];
  }

  const grouped = groupResponses();

  function toggleExpanded(id: string) {
    const newSet = new Set(expandedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setExpandedIds(newSet);
  }

  function expandAll() {
    setExpandedIds(new Set(filtered.map((r) => r.id)));
  }

  function collapseAll() {
    setExpandedIds(new Set());
  }

  return (
    <div>
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-4 mb-4">
        <div className="flex items-center gap-2">
          <label htmlFor="sort" className="text-sm text-[#888]">
            Sort:
          </label>
          <select
            id="sort"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            className="px-2 py-1 bg-black border border-[#333] text-white text-sm focus:border-white focus:outline-none"
          >
            <option value="recent">Recent first</option>
            <option value="oldest">Oldest first</option>
            <option value="provider">Provider</option>
            <option value="model">Model</option>
            <option value="latency">Fastest</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label htmlFor="provider" className="text-sm text-[#888]">
            Provider:
          </label>
          <select
            id="provider"
            value={filterProvider}
            onChange={(e) => {
              setFilterProvider(e.target.value);
              setFilterModel("");
            }}
            className="px-2 py-1 bg-black border border-[#333] text-white text-sm focus:border-white focus:outline-none"
          >
            <option value="">All</option>
            {providers.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label htmlFor="model" className="text-sm text-[#888]">
            Model:
          </label>
          <select
            id="model"
            value={filterModel}
            onChange={(e) => setFilterModel(e.target.value)}
            className="px-2 py-1 bg-black border border-[#333] text-white text-sm focus:border-white focus:outline-none"
          >
            <option value="">All</option>
            {models.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2 ml-auto">
          <button
            type="button"
            onClick={expandAll}
            className="text-xs text-[#666] hover:text-white"
          >
            Expand all
          </button>
          <span className="text-[#333]">|</span>
          <button
            type="button"
            onClick={collapseAll}
            className="text-xs text-[#666] hover:text-white"
          >
            Collapse all
          </button>
        </div>
      </div>

      {/* Results count */}
      <p className="text-xs text-[#666] mb-3">
        Showing {filtered.length} of {responses.length} responses
      </p>

      {/* Responses list */}
      {filtered.length === 0 ? (
        <div className="bg-[#111] border border-[#222] p-8 text-center text-[#666]">
          No responses match filters.
        </div>
      ) : (
        <div className="space-y-4">
          {grouped.map((group) => (
            <div key={group.label || "all"}>
              {/* Group header */}
              {group.label && (
                <div className="text-xs text-[#666] uppercase tracking-wider mb-2 flex items-center gap-2">
                  <span>{group.label}</span>
                  <span className="text-[#444]">
                    ({group.responses.length})
                  </span>
                </div>
              )}
              {/* Group items */}
              <div className="bg-[#111] border border-[#222] divide-y divide-[#222]">
                {group.responses.map((response) => {
                  const isExpanded = expandedIds.has(response.id);
                  // Show provider/model in header based on sort type
                  const showProviderInHeader = sortBy !== "provider";
                  const showModelInHeader = sortBy !== "model";
                  const showDateInHeader =
                    sortBy !== "recent" && sortBy !== "oldest";
                  return (
                    <div key={response.id}>
                      {/* Collapsed header - always visible */}
                      <button
                        type="button"
                        onClick={() => toggleExpanded(response.id)}
                        className="w-full p-4 flex items-center justify-between hover:bg-[#1a1a1a] transition-colors text-left"
                      >
                        <div className="flex items-center gap-4">
                          <ChevronIcon
                            className={`w-4 h-4 text-[#666] transition-transform ${isExpanded ? "rotate-90" : ""}`}
                          />
                          {showProviderInHeader && (
                            <span className="font-medium">
                              {response.provider?.name}
                            </span>
                          )}
                          {showModelInHeader && (
                            <span
                              className={
                                showProviderInHeader
                                  ? "text-sm text-[#666]"
                                  : "font-medium"
                              }
                            >
                              {response.provider?.model}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-4">
                          {/* Analysis badges */}
                          {response.analysis && (
                            <div className="flex gap-1">
                              {[...response.analysis.mentions]
                                .sort((a, b) => {
                                  // Sort by ranking (lowest first, unranked last)
                                  const rankA =
                                    a.ranking != null
                                      ? Number(a.ranking)
                                      : Number.POSITIVE_INFINITY;
                                  const rankB =
                                    b.ranking != null
                                      ? Number(b.ranking)
                                      : Number.POSITIVE_INFINITY;
                                  return rankA - rankB;
                                })
                                .map((mention) => (
                                  <span
                                    key={mention.id}
                                    className={`text-xs px-1.5 py-0.5 ${
                                      mention.sentiment === "positive"
                                        ? "border border-green-500 text-green-500"
                                        : mention.sentiment === "negative"
                                          ? "border border-red-500 text-red-500"
                                          : "border border-[#444] text-[#888]"
                                    }`}
                                  >
                                    {mention.brand?.name}
                                    {mention.ranking && ` #${mention.ranking}`}
                                  </span>
                                ))}
                            </div>
                          )}
                          {/* Link badges */}
                          {response.analysis?.links &&
                            response.analysis.links.length > 0 && (
                              <div className="flex gap-1 items-center">
                                <LinkIcon className="w-3 h-3 text-blue-400" />
                                {response.analysis.links
                                  .slice(0, 3)
                                  .map((link) => (
                                    <span
                                      key={link.id}
                                      className="text-xs px-1.5 py-0.5 border border-blue-500 text-blue-400"
                                    >
                                      {link.brand?.name || getDomain(link.url)}
                                    </span>
                                  ))}
                                {response.analysis.links.length > 3 && (
                                  <span className="text-xs text-[#666]">
                                    +{response.analysis.links.length - 3}
                                  </span>
                                )}
                              </div>
                            )}
                          {/* URL indicator - always show if content has links */}
                          {hasUrls(response.content) && (
                            <span title="Has links">
                              <LinkIcon className="w-3 h-3 text-blue-400" />
                            </span>
                          )}
                          {/* Web search indicator */}
                          {response.webSearchUsed && (
                            <span
                              className="text-xs px-1.5 py-0.5 border border-cyan-500 text-cyan-400"
                              title="Used web search"
                            >
                              WEB
                            </span>
                          )}
                          <span className="text-sm text-[#666]">
                            {response.latencyMs}ms
                          </span>
                          {showDateInHeader && (
                            <span className="text-sm text-[#666]">
                              {new Date(
                                response.createdAt || 0,
                              ).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </button>

                      {/* Expanded content */}
                      {isExpanded && (
                        <div className="px-4 pb-4 border-t border-[#222]">
                          <div className="bg-black border border-[#222] p-4 my-4 text-sm max-h-96 overflow-y-auto">
                            <Markdown content={response.content} />
                          </div>

                          {response.analysis ? (
                            <div>
                              <p className="text-xs text-[#666] uppercase tracking-wider mb-2">
                                Analysis
                              </p>
                              {response.analysis.summary && (
                                <p className="text-sm text-[#888] mb-3">
                                  {response.analysis.summary}
                                </p>
                              )}
                              {/* Mentions */}
                              {response.analysis.mentions.length > 0 && (
                                <div className="mb-3">
                                  <p className="text-xs text-[#555] mb-1">
                                    Mentions
                                  </p>
                                  <div className="flex flex-wrap gap-2">
                                    {[...response.analysis.mentions]
                                      .sort((a, b) => {
                                        const rankA =
                                          a.ranking != null
                                            ? Number(a.ranking)
                                            : Number.POSITIVE_INFINITY;
                                        const rankB =
                                          b.ranking != null
                                            ? Number(b.ranking)
                                            : Number.POSITIVE_INFINITY;
                                        return rankA - rankB;
                                      })
                                      .map((mention) => (
                                        <span
                                          key={mention.id}
                                          className={`text-xs px-2 py-1 ${
                                            mention.sentiment === "positive"
                                              ? "border border-green-500 text-green-500"
                                              : mention.sentiment === "negative"
                                                ? "border border-red-500 text-red-500"
                                                : "border border-[#444] text-[#888]"
                                          }`}
                                        >
                                          {mention.brand?.name}
                                          {mention.ranking &&
                                            ` #${mention.ranking}`}
                                        </span>
                                      ))}
                                  </div>
                                </div>
                              )}
                              {/* Links */}
                              {response.analysis.links &&
                                response.analysis.links.length > 0 && (
                                  <div>
                                    <p className="text-xs text-[#555] mb-1">
                                      Links
                                    </p>
                                    <div className="flex flex-wrap gap-2">
                                      {response.analysis.links.map((link) => (
                                        <a
                                          key={link.id}
                                          href={link.url}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="text-xs px-2 py-1 border border-blue-500 text-blue-400 hover:bg-blue-500/10 flex items-center gap-1"
                                        >
                                          <LinkIcon className="w-3 h-3" />
                                          {link.brand?.name ||
                                            getDomain(link.url)}
                                          {link.linkText && (
                                            <span className="text-[#666] ml-1">
                                              "{link.linkText}"
                                            </span>
                                          )}
                                        </a>
                                      ))}
                                    </div>
                                  </div>
                                )}
                            </div>
                          ) : (
                            <DemoTooltip>
                              <AnalyzeButton responseId={response.id} />
                            </DemoTooltip>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
