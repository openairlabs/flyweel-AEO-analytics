import { db } from "@/db";
import { brandLinks, brandMentions } from "@/db/schema";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const industryId = searchParams.get("industryId");

  // Get all brand mentions with related data
  const mentions = await db.query.brandMentions.findMany({
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

  // Get all brand links with related data
  const links = await db.query.brandLinks.findMany({
    with: {
      brand: true,
      analysis: {
        with: {
          response: {
            with: {
              provider: true,
            },
          },
        },
      },
    },
  });

  // Filter by industry if specified
  const filteredMentions = industryId
    ? mentions.filter((m) => m.brand.industryId === industryId)
    : mentions;

  const filteredLinks = industryId
    ? links.filter((l) => l.brand?.industryId === industryId)
    : links;

  // Calculate metrics
  const brandMetrics = new Map<
    string,
    {
      brandId: string;
      brandName: string;
      isOwnBrand: boolean;
      totalMentions: number;
      totalLinks: number;
      positive: number;
      negative: number;
      neutral: number;
      avgRanking: number | null;
      rankings: number[];
    }
  >();

  for (const mention of filteredMentions) {
    const brandId = mention.brandId;
    if (!brandMetrics.has(brandId)) {
      brandMetrics.set(brandId, {
        brandId,
        brandName: mention.brand.name,
        isOwnBrand: mention.brand.isOwnBrand ?? false,
        totalMentions: 0,
        totalLinks: 0,
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

  // Add link counts to brand metrics
  for (const link of filteredLinks) {
    if (!link.brandId || !link.brand) continue;
    const brandId = link.brandId;
    if (!brandMetrics.has(brandId)) {
      brandMetrics.set(brandId, {
        brandId,
        brandName: link.brand.name,
        isOwnBrand: link.brand.isOwnBrand ?? false,
        totalMentions: 0,
        totalLinks: 0,
        positive: 0,
        negative: 0,
        neutral: 0,
        avgRanking: null,
        rankings: [],
      });
    }
    brandMetrics.get(brandId)!.totalLinks++;
  }

  // Calculate average rankings
  for (const metrics of brandMetrics.values()) {
    if (metrics.rankings.length > 0) {
      metrics.avgRanking =
        metrics.rankings.reduce((a, b) => a + b, 0) / metrics.rankings.length;
    }
  }

  // Convert to array and sort by total mentions
  const brandInsights = Array.from(brandMetrics.values())
    .map(({ rankings, ...rest }) => rest)
    .sort((a, b) => b.totalMentions - a.totalMentions);

  // Get sentiment over time
  const mentionsOverTime = filteredMentions
    .map((m) => ({
      date: m.analysis.response.createdAt,
      brandName: m.brand.name,
      sentiment: m.sentiment,
      provider: m.analysis.response.provider.name,
    }))
    .sort(
      (a, b) =>
        new Date(a.date ?? 0).getTime() - new Date(b.date ?? 0).getTime(),
    );

  // Get links over time
  const linksOverTime = filteredLinks
    .filter((l) => l.brand)
    .map((l) => ({
      date: l.analysis.response.createdAt,
      brandName: l.brand?.name,
      url: l.url,
      isMarkdownLink: l.isMarkdownLink,
      provider: l.analysis.response.provider.name,
    }))
    .sort(
      (a, b) =>
        new Date(a.date ?? 0).getTime() - new Date(b.date ?? 0).getTime(),
    );

  // Get our brand vs competitors summary
  const ownBrand = brandInsights.find((b) => b.isOwnBrand);
  const competitors = brandInsights.filter((b) => !b.isOwnBrand);

  // Calculate link-to-mention ratio for own brand
  const ownBrandLinkRatio =
    ownBrand && ownBrand.totalMentions > 0
      ? ownBrand.totalLinks / ownBrand.totalMentions
      : 0;

  return Response.json({
    summary: {
      totalMentions: filteredMentions.length,
      totalLinks: filteredLinks.length,
      uniqueBrands: brandMetrics.size,
      ownBrand: ownBrand
        ? {
            name: ownBrand.brandName,
            mentions: ownBrand.totalMentions,
            links: ownBrand.totalLinks,
            linkRatio: Math.round(ownBrandLinkRatio * 100) / 100,
            positiveRate:
              ownBrand.totalMentions > 0
                ? (ownBrand.positive / ownBrand.totalMentions) * 100
                : 0,
            avgRanking: ownBrand.avgRanking,
          }
        : null,
    },
    brandInsights,
    mentionsOverTime,
    linksOverTime,
    competitors: competitors.slice(0, 5), // Top 5 competitors
  });
}
