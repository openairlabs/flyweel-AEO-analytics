import { DigestSection } from "@/components/DigestSection";
import { InsightsFilter } from "@/components/InsightsFilter";
import { MentionChart } from "@/components/charts/MentionChart";
import { RankingOverTimeChart } from "@/components/charts/RankingOverTimeChart";
import { RankingTable } from "@/components/charts/RankingTable";
import { SentimentByProviderChart } from "@/components/charts/SentimentByProviderChart";
import { SentimentChart } from "@/components/charts/SentimentChart";
import { ShareOfVoiceChart } from "@/components/charts/ShareOfVoiceChart";
import { VisibilityScoreChart } from "@/components/charts/VisibilityScoreChart";
import { InfoTooltip } from "@/components/ui/InfoTooltip";
import { db } from "@/db";
import {
  analyses,
  brandMentions,
  brands,
  providers,
  responses,
} from "@/db/schema";
import {
  type BrandMention,
  calculateShareOfVoice,
  calculateShareOfVoiceOverTime,
  calculateVisibilityOverTime,
  calculateVisibilityScore,
} from "@/lib/metrics";
import { avg, count, eq, sql } from "drizzle-orm";
import { Suspense } from "react";

export const dynamic = "force-dynamic";

// Section navigation component
function SectionNav() {
  return (
    <nav className="sticky top-0 z-10 bg-black py-3 mb-6 border-b border-[#222] flex gap-6">
      <a href="#overview" className="text-sm text-[#888] hover:text-white">
        Overview
      </a>
      <a href="#trends" className="text-sm text-[#888] hover:text-white">
        Trends
      </a>
      <a href="#mentions" className="text-sm text-[#888] hover:text-white">
        Mentions
      </a>
      <a href="#sentiment" className="text-sm text-[#888] hover:text-white">
        Sentiment
      </a>
      <a href="#rankings" className="text-sm text-[#888] hover:text-white">
        Rankings
      </a>
    </nav>
  );
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ provider?: string; model?: string }>;
}) {
  const params = await searchParams;
  const providerFilter = params.provider || "";
  const modelFilter = params.model || "";

  // Get own brand
  const ownBrand = await db.query.brands.findFirst({
    where: eq(brands.isOwnBrand, true),
  });

  if (!ownBrand) {
    return (
      <div>
        <h1 className="text-2xl font-bold mb-2">Dashboard</h1>
        <p className="text-[#888] mb-8">
          Configure your brand in Settings to see insights.
        </p>
      </div>
    );
  }

  // Get all providers for filter
  const allProviders = await db.query.providers.findMany();

  // Get all mentions with full data
  const allMentions = await db.query.brandMentions.findMany({
    with: {
      brand: true,
      analysis: {
        with: {
          response: {
            with: {
              provider: true,
              prompt: true,
            },
          },
        },
      },
    },
  });

  // Filter mentions by provider/model
  const mentions = allMentions.filter((mention) => {
    const provider = mention.analysis?.response?.provider;
    if (!provider) return false;
    if (providerFilter && provider.name !== providerFilter) return false;
    if (modelFilter && provider.model !== modelFilter) return false;
    return true;
  });

  // Build brand metrics
  const brandMetrics = new Map<
    string,
    {
      brandId: string;
      brandName: string;
      isOwnBrand: boolean;
      totalMentions: number;
      positive: number;
      negative: number;
      neutral: number;
      avgRanking: number | null;
      rankings: number[];
    }
  >();

  for (const mention of mentions) {
    const brandId = mention.brandId;
    if (!brandMetrics.has(brandId)) {
      brandMetrics.set(brandId, {
        brandId,
        brandName: mention.brand.name,
        isOwnBrand: mention.brand.isOwnBrand ?? false,
        totalMentions: 0,
        positive: 0,
        negative: 0,
        neutral: 0,
        avgRanking: null,
        rankings: [],
      });
    }
    const metrics = brandMetrics.get(brandId)!;
    metrics.totalMentions++;
    metrics[mention.sentiment]++;
    if (mention.ranking) {
      metrics.rankings.push(mention.ranking);
    }
  }

  for (const metrics of brandMetrics.values()) {
    if (metrics.rankings.length > 0) {
      metrics.avgRanking =
        metrics.rankings.reduce((a, b) => a + b, 0) / metrics.rankings.length;
    }
  }

  // Sort by mentions (highest first)
  const brandInsights = Array.from(brandMetrics.values())
    .map(({ rankings, ...rest }) => rest)
    .sort((a, b) => b.totalMentions - a.totalMentions);

  const ownBrandMetrics = brandInsights.find((b) => b.isOwnBrand);
  const competitors = brandInsights.filter((b) => !b.isOwnBrand);

  // Chart data - own brand first, then sorted by mentions
  const sentimentData = brandInsights.map((b) => ({
    name: b.brandName,
    positive: b.positive,
    negative: b.negative,
    neutral: b.neutral,
  }));

  const mentionData = brandInsights.map((b) => ({
    name: b.brandName,
    mentions: b.totalMentions,
    isOwnBrand: b.isOwnBrand,
  }));

  // Mentions by provider (for own brand)
  const mentionsByProviderMap = new Map<string, number>();
  for (const mention of mentions) {
    if (mention.brand.isOwnBrand) {
      const providerName = mention.analysis?.response?.provider?.name;
      if (providerName) {
        mentionsByProviderMap.set(
          providerName,
          (mentionsByProviderMap.get(providerName) || 0) + 1,
        );
      }
    }
  }
  const mentionsByProviderData = Array.from(mentionsByProviderMap.entries())
    .map(([name, mentions]) => ({ name, mentions, isOwnBrand: true }))
    .sort((a, b) => b.mentions - a.mentions);

  // Count total responses
  const [responseCount] = await db.select({ count: count() }).from(responses);

  // Coverage calculation
  const uniqueResponseIds = new Set(
    mentions
      .filter((m) => m.brand.isOwnBrand)
      .map((m) => m.analysis?.response?.id)
      .filter(Boolean),
  );
  const coverage =
    responseCount.count > 0
      ? Math.round((uniqueResponseIds.size / responseCount.count) * 100)
      : 0;

  // Get all brands for trend chart (deduplicated by name)
  const allBrands = await db.query.brands.findMany();
  const seenBrandNames = new Set<string>();
  const brandInfoList = allBrands
    .filter((b) => {
      if (seenBrandNames.has(b.name)) return false;
      seenBrandNames.add(b.name);
      return true;
    })
    .map((b) => ({
      name: b.name,
      isOwnBrand: b.isOwnBrand ?? false,
    }));

  // Ranking over time (by day) for ALL brands
  const rankingByDateAllBrands = await db
    .select({
      date: sql<string>`DATE(${analyses.createdAt})`.as("date"),
      brandId: brandMentions.brandId,
      brandName: brands.name,
      avgRank: avg(brandMentions.ranking).as("avg_rank"),
    })
    .from(brandMentions)
    .innerJoin(analyses, eq(brandMentions.analysisId, analyses.id))
    .innerJoin(brands, eq(brandMentions.brandId, brands.id))
    .groupBy(
      sql`DATE(${analyses.createdAt})`,
      brandMentions.brandId,
      brands.name,
    )
    .orderBy(sql`DATE(${analyses.createdAt})`);

  const dateMap = new Map<
    string,
    { date: string; [brand: string]: string | number }
  >();
  for (const row of rankingByDateAllBrands) {
    const dateLabel = new Date(row.date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
    if (!dateMap.has(dateLabel)) {
      dateMap.set(dateLabel, { date: dateLabel });
    }
    dateMap.get(dateLabel)![row.brandName] = Number(row.avgRank) || 0;
  }
  const rankingOverTimeData = Array.from(dateMap.values());

  // Sentiment by provider (for own brand)
  const sentimentByProvider = await db
    .select({
      providerName: providers.name,
      sentiment: brandMentions.sentiment,
      count: count(),
    })
    .from(brandMentions)
    .innerJoin(analyses, eq(brandMentions.analysisId, analyses.id))
    .innerJoin(responses, eq(analyses.responseId, responses.id))
    .innerJoin(providers, eq(responses.providerId, providers.id))
    .where(eq(brandMentions.brandId, ownBrand.id))
    .groupBy(providers.name, brandMentions.sentiment);

  const sentimentByProviderMap = new Map<
    string,
    { positive: number; neutral: number; negative: number }
  >();
  for (const row of sentimentByProvider) {
    if (!sentimentByProviderMap.has(row.providerName)) {
      sentimentByProviderMap.set(row.providerName, {
        positive: 0,
        neutral: 0,
        negative: 0,
      });
    }
    sentimentByProviderMap.get(row.providerName)![
      row.sentiment as "positive" | "neutral" | "negative"
    ] = row.count;
  }
  const sentimentByProviderData = Array.from(sentimentByProviderMap.entries())
    .map(([provider, sentiments]) => ({ provider, ...sentiments }))
    .sort((a, b) => {
      const totalA = a.positive + a.neutral + a.negative;
      const totalB = b.positive + b.neutral + b.negative;
      return totalB - totalA;
    });

  const filterLabel = providerFilter
    ? modelFilter
      ? `${providerFilter} / ${modelFilter}`
      : providerFilter
    : "All Providers";

  // Prepare data for metrics calculations
  // IMPORTANT: Use response.createdAt for date, not analysis.createdAt
  // to ensure dates match with responsesByDate
  const mentionsForMetrics: BrandMention[] = mentions.map((m) => ({
    brandId: m.brandId,
    brandName: m.brand.name,
    isOwnBrand: m.brand.isOwnBrand ?? false,
    ranking: m.ranking,
    responseId: m.analysis?.response?.id || "",
    date: new Date(
      m.analysis?.response?.createdAt || m.analysis?.createdAt || 0,
    ).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    }),
  }));

  // Calculate total responses by date for time-based metrics
  const responsesByDate = new Map<string, number>();
  const allResponses = await db.query.responses.findMany();
  for (const response of allResponses) {
    const dateLabel = new Date(response.createdAt || 0).toLocaleDateString(
      "en-US",
      { month: "short", day: "numeric" },
    );
    responsesByDate.set(dateLabel, (responsesByDate.get(dateLabel) || 0) + 1);
  }

  // Calculate Share of Voice
  const shareOfVoiceData = calculateShareOfVoice(
    mentionsForMetrics,
    responseCount.count,
    brandInfoList,
  );

  const shareOfVoiceOverTime = calculateShareOfVoiceOverTime(
    mentionsForMetrics,
    responsesByDate,
    brandInfoList,
  );

  // Calculate Visibility Score
  const visibilityScoreData = calculateVisibilityScore(
    mentionsForMetrics,
    responseCount.count,
    brandInfoList,
  );

  const visibilityOverTime = calculateVisibilityOverTime(
    mentionsForMetrics,
    responsesByDate,
    brandInfoList,
  );

  // Merge brandInsights with Share of Voice and Visibility Score for Rankings table
  const brandInsightsWithMetrics = brandInsights.map((brand) => {
    const sov = shareOfVoiceData.find((s) => s.name === brand.brandName);
    const vis = visibilityScoreData.find((v) => v.name === brand.brandName);
    return {
      ...brand,
      shareOfVoice: sov?.shareOfVoice ?? 0,
      visibilityScore: vis?.score ?? 0,
    };
  });

  return (
    <div>
      <h1 className="text-2xl font-bold mb-2">Dashboard</h1>
      <p className="text-[#888] mb-4">
        Track how LLMs mention and position {ownBrand.name} vs competitors.
      </p>

      <DigestSection hasData={allMentions.length > 0} />

      <SectionNav />

      {/* Filter */}
      <Suspense fallback={<div className="h-10 mb-8" />}>
        <InsightsFilter providers={allProviders} />
      </Suspense>

      {providerFilter || modelFilter ? (
        <p className="text-sm text-[#888] mb-4">
          Filtered by <span className="text-white">{filterLabel}</span>
        </p>
      ) : null}

      {mentions.length === 0 ? (
        <div className="bg-[#111] border border-[#222] p-8 text-center">
          <p className="text-[#666]">
            {allMentions.length === 0
              ? "No data yet. Run some prompts to get started."
              : `No mentions found for ${filterLabel}.`}
          </p>
        </div>
      ) : (
        <>
          {/* Overview Section */}
          <section id="overview" className="mb-12">
            <h2 className="text-lg font-medium mb-4">Overview</h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <StatCard
                title="Your Avg Rank"
                value={
                  ownBrandMetrics?.avgRanking
                    ? `#${ownBrandMetrics.avgRanking.toFixed(1)}`
                    : "—"
                }
                info="Average ranking position when your brand is mentioned. #1 = top recommendation. Lower is better."
              />
              <StatCard
                title="Positive Rate"
                value={
                  ownBrandMetrics && ownBrandMetrics.totalMentions > 0
                    ? `${Math.round((ownBrandMetrics.positive / ownBrandMetrics.totalMentions) * 100)}%`
                    : "—"
                }
                info="Percentage of mentions with positive sentiment. Higher is better."
              />
              <StatCard
                title="Total Mentions"
                value={ownBrandMetrics?.totalMentions.toString() || "0"}
                subtitle={`out of ${responseCount.count} responses`}
                info="How many times your brand was mentioned across all LLM responses."
              />
              <StatCard
                title="Coverage"
                value={`${coverage}%`}
                subtitle="of responses"
                info="Percentage of LLM responses that mention your brand at least once."
              />
            </div>
          </section>

          {/* Trends Section */}
          <section id="trends" className="mb-12">
            <h2 className="text-lg font-medium mb-4">Trends</h2>
            <div className="grid grid-cols-1 gap-4">
              {/* Share of Voice */}
              <div className="bg-[#111] border border-[#222] p-6">
                <ShareOfVoiceChart
                  data={shareOfVoiceData}
                  overTimeData={shareOfVoiceOverTime}
                  brands={brandInfoList}
                />
              </div>

              {/* Visibility Score */}
              <div className="bg-[#111] border border-[#222] p-6">
                <VisibilityScoreChart
                  data={visibilityScoreData}
                  overTimeData={visibilityOverTime}
                  brands={brandInfoList}
                />
              </div>

              {/* Average Rank When Mentioned - commented out as it's misleading without mention volume context
              <div className="bg-[#111] border border-[#222] p-6">
                <RankingOverTimeChart
                  data={rankingOverTimeData}
                  brands={brandInfoList}
                />
              </div>
*/}
            </div>
          </section>

          {/* Mentions Section */}
          <section id="mentions" className="mb-12">
            <h2 className="text-lg font-medium mb-4">Mentions</h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="bg-[#111] border border-[#222] p-6">
                <h3 className="text-sm font-medium text-[#888] uppercase tracking-wider mb-2">
                  Your Brand by Provider
                </h3>
                <p className="text-xs text-[#666] mb-4">
                  How often each LLM mentions you
                </p>
                <MentionChart data={mentionsByProviderData} />
              </div>
              <div className="bg-[#111] border border-[#222] p-6">
                <h3 className="text-sm font-medium text-[#888] uppercase tracking-wider mb-2">
                  All Brands
                </h3>
                <p className="text-xs text-[#666] mb-4">
                  Total mentions across all providers
                </p>
                <MentionChart data={mentionData} />
              </div>
            </div>
          </section>

          {/* Sentiment Section */}
          <section id="sentiment" className="mb-12">
            <h2 className="text-lg font-medium mb-4">Sentiment</h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="bg-[#111] border border-[#222] p-6">
                <h3 className="text-sm font-medium text-[#888] uppercase tracking-wider mb-2">
                  Your Brand by Provider
                </h3>
                <p className="text-xs text-[#666] mb-4">
                  How each LLM feels about you
                </p>
                <SentimentByProviderChart data={sentimentByProviderData} />
              </div>
              <div className="bg-[#111] border border-[#222] p-6">
                <h3 className="text-sm font-medium text-[#888] uppercase tracking-wider mb-2">
                  All Brands
                </h3>
                <p className="text-xs text-[#666] mb-4">
                  Sentiment breakdown for each brand
                </p>
                <SentimentChart data={sentimentData} />
              </div>
            </div>
          </section>

          {/* Rankings Section */}
          <section id="rankings">
            <h2 className="text-lg font-medium mb-4">Rankings</h2>
            <div className="bg-[#111] border border-[#222] p-6">
              <RankingTable brands={brandInsightsWithMetrics} />
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function StatCard({
  title,
  value,
  subtitle,
  info,
}: {
  title: string;
  value: string;
  subtitle?: string;
  info?: string;
}) {
  return (
    <div className="bg-[#111] border border-[#222] p-6">
      <div className="flex items-center gap-1 mb-1">
        <p className="text-xs text-[#666] uppercase tracking-wider">{title}</p>
        {info && <InfoTooltip content={info} />}
      </div>
      <p className="text-3xl font-bold">{value}</p>
      {subtitle && <p className="text-xs text-[#666] mt-1">{subtitle}</p>}
    </div>
  );
}
