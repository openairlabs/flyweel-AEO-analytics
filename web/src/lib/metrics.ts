// Types for metric calculations

export interface BrandMention {
  brandId: string;
  brandName: string;
  isOwnBrand: boolean;
  ranking: number | null;
  responseId: string;
  date: string;
}

export interface BrandLink {
  brandId: string | null;
  brandName: string | null;
  isOwnBrand: boolean;
  responseId: string;
  date: string;
  isMarkdownLink: boolean;
}

export interface BrandInfo {
  name: string;
  isOwnBrand: boolean;
}

export interface ShareOfVoiceData {
  name: string;
  shareOfVoice: number; // 0-100%
  isOwnBrand: boolean;
}

export interface ShareOfVoiceOverTimeData {
  date: string;
  [brand: string]: string | number;
}

export interface VisibilityScoreData {
  name: string;
  score: number; // 0-100
  isOwnBrand: boolean;
}

export interface VisibilityOverTimeData {
  date: string;
  [brand: string]: string | number;
}

/**
 * Calculate Share of Voice for each brand
 * Share of Voice = (unique responses mentioning brand / total responses) × 100
 */
export function calculateShareOfVoice(
  mentions: BrandMention[],
  totalResponses: number,
  brands: BrandInfo[],
): ShareOfVoiceData[] {
  if (totalResponses === 0) return [];

  // Count unique responses per brand
  const brandResponseCounts = new Map<string, Set<string>>();

  for (const mention of mentions) {
    if (!brandResponseCounts.has(mention.brandName)) {
      brandResponseCounts.set(mention.brandName, new Set());
    }
    brandResponseCounts.get(mention.brandName)!.add(mention.responseId);
  }

  // Calculate share of voice for each brand
  return brands
    .map((brand) => {
      const uniqueResponses = brandResponseCounts.get(brand.name)?.size || 0;
      const shareOfVoice = (uniqueResponses / totalResponses) * 100;

      return {
        name: brand.name,
        shareOfVoice: Math.round(shareOfVoice * 10) / 10, // Round to 1 decimal
        isOwnBrand: brand.isOwnBrand,
      };
    })
    .sort((a, b) => b.shareOfVoice - a.shareOfVoice);
}

/**
 * Calculate Share of Voice over time (by date)
 */
export function calculateShareOfVoiceOverTime(
  mentions: BrandMention[],
  totalResponsesByDate: Map<string, number>,
  brands: BrandInfo[],
): ShareOfVoiceOverTimeData[] {
  // Group mentions by date and brand
  const dateMap = new Map<string, Map<string, Set<string>>>();

  for (const mention of mentions) {
    if (!dateMap.has(mention.date)) {
      dateMap.set(mention.date, new Map());
    }
    const brandMap = dateMap.get(mention.date)!;
    if (!brandMap.has(mention.brandName)) {
      brandMap.set(mention.brandName, new Set());
    }
    brandMap.get(mention.brandName)!.add(mention.responseId);
  }

  // Build result array
  const result: ShareOfVoiceOverTimeData[] = [];

  for (const [date, brandMap] of dateMap) {
    const totalForDate = totalResponsesByDate.get(date) || 1;
    const dataPoint: ShareOfVoiceOverTimeData = { date };

    for (const brand of brands) {
      const uniqueResponses = brandMap.get(brand.name)?.size || 0;
      dataPoint[brand.name] =
        Math.round((uniqueResponses / totalForDate) * 1000) / 10;
    }

    result.push(dataPoint);
  }

  return result.sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  );
}

/**
 * Calculate Visibility Score for each brand
 * Visibility Score = Share of Voice × Rank Score
 * where Rank Score = (maxBrands - avgRank + 1) / maxBrands × 100
 *
 * A brand mentioned in every response at #1 scores 100
 * A brand never mentioned scores 0
 */
export function calculateVisibilityScore(
  mentions: BrandMention[],
  totalResponses: number,
  brands: BrandInfo[],
): VisibilityScoreData[] {
  if (totalResponses === 0) return [];

  const maxBrands = brands.length;

  // Calculate per-brand metrics
  const brandMetrics = new Map<
    string,
    { responseIds: Set<string>; rankings: number[]; isOwnBrand: boolean }
  >();

  for (const brand of brands) {
    brandMetrics.set(brand.name, {
      responseIds: new Set(),
      rankings: [],
      isOwnBrand: brand.isOwnBrand,
    });
  }

  for (const mention of mentions) {
    const metrics = brandMetrics.get(mention.brandName);
    if (metrics) {
      metrics.responseIds.add(mention.responseId);
      if (mention.ranking !== null) {
        metrics.rankings.push(mention.ranking);
      }
    }
  }

  // Calculate visibility score
  return Array.from(brandMetrics.entries())
    .map(([name, metrics]) => {
      const shareOfVoice = (metrics.responseIds.size / totalResponses) * 100;

      // Average rank (default to maxBrands if no rankings)
      const avgRank =
        metrics.rankings.length > 0
          ? metrics.rankings.reduce((a, b) => a + b, 0) /
            metrics.rankings.length
          : maxBrands;

      // Rank score: higher is better (inverse of rank)
      const rankScore = ((maxBrands - avgRank + 1) / maxBrands) * 100;

      // Combined visibility score
      const score = (shareOfVoice * rankScore) / 100;

      return {
        name,
        score: Math.round(score * 10) / 10,
        isOwnBrand: metrics.isOwnBrand,
      };
    })
    .sort((a, b) => b.score - a.score);
}

/**
 * Calculate Visibility Score over time (by date)
 */
export function calculateVisibilityOverTime(
  mentions: BrandMention[],
  totalResponsesByDate: Map<string, number>,
  brands: BrandInfo[],
): VisibilityOverTimeData[] {
  const maxBrands = brands.length;

  // Group mentions by date
  const dateMap = new Map<
    string,
    Map<string, { responseIds: Set<string>; rankings: number[] }>
  >();

  for (const mention of mentions) {
    if (!dateMap.has(mention.date)) {
      dateMap.set(mention.date, new Map());
    }
    const brandMap = dateMap.get(mention.date)!;
    if (!brandMap.has(mention.brandName)) {
      brandMap.set(mention.brandName, { responseIds: new Set(), rankings: [] });
    }
    const metrics = brandMap.get(mention.brandName)!;
    metrics.responseIds.add(mention.responseId);
    if (mention.ranking !== null) {
      metrics.rankings.push(mention.ranking);
    }
  }

  // Build result array
  const result: VisibilityOverTimeData[] = [];

  for (const [date, brandMap] of dateMap) {
    const totalForDate = totalResponsesByDate.get(date) || 1;
    const dataPoint: VisibilityOverTimeData = { date };

    for (const brand of brands) {
      const metrics = brandMap.get(brand.name) || {
        responseIds: new Set(),
        rankings: [],
      };
      const shareOfVoice = (metrics.responseIds.size / totalForDate) * 100;

      const avgRank =
        metrics.rankings.length > 0
          ? metrics.rankings.reduce((a, b) => a + b, 0) /
            metrics.rankings.length
          : maxBrands;

      const rankScore = ((maxBrands - avgRank + 1) / maxBrands) * 100;
      const score = (shareOfVoice * rankScore) / 100;

      dataPoint[brand.name] = Math.round(score * 10) / 10;
    }

    result.push(dataPoint);
  }

  return result.sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  );
}

// ============ LINK METRICS ============

export interface LinkShareOfVoiceData {
  name: string;
  linkShareOfVoice: number; // 0-100%
  isOwnBrand: boolean;
}

export interface LinkToMentionRatioData {
  name: string;
  mentions: number;
  links: number;
  ratio: number; // links / mentions (higher = more links per mention)
  isOwnBrand: boolean;
}

/**
 * Calculate Link Share of Voice for each brand
 * Link Share of Voice = (unique responses with brand link / total responses) × 100
 */
export function calculateLinkShareOfVoice(
  links: BrandLink[],
  totalResponses: number,
  brands: BrandInfo[],
): LinkShareOfVoiceData[] {
  if (totalResponses === 0) return [];

  // Count unique responses per brand
  const brandResponseCounts = new Map<string, Set<string>>();

  for (const link of links) {
    if (!link.brandName) continue;
    if (!brandResponseCounts.has(link.brandName)) {
      brandResponseCounts.set(link.brandName, new Set());
    }
    brandResponseCounts.get(link.brandName)!.add(link.responseId);
  }

  // Calculate link share of voice for each brand
  return brands
    .map((brand) => {
      const uniqueResponses = brandResponseCounts.get(brand.name)?.size || 0;
      const linkShareOfVoice = (uniqueResponses / totalResponses) * 100;

      return {
        name: brand.name,
        linkShareOfVoice: Math.round(linkShareOfVoice * 10) / 10,
        isOwnBrand: brand.isOwnBrand,
      };
    })
    .sort((a, b) => b.linkShareOfVoice - a.linkShareOfVoice);
}

/**
 * Calculate Link-to-Mention Ratio for each brand
 * Higher ratio = brand gets linked more often when mentioned (stronger endorsement)
 */
export function calculateLinkToMentionRatio(
  mentions: BrandMention[],
  links: BrandLink[],
  brands: BrandInfo[],
): LinkToMentionRatioData[] {
  // Count mentions and links per brand
  const mentionCounts = new Map<string, number>();
  const linkCounts = new Map<string, number>();

  for (const mention of mentions) {
    mentionCounts.set(
      mention.brandName,
      (mentionCounts.get(mention.brandName) || 0) + 1,
    );
  }

  for (const link of links) {
    if (!link.brandName) continue;
    linkCounts.set(link.brandName, (linkCounts.get(link.brandName) || 0) + 1);
  }

  return brands
    .map((brand) => {
      const mentionCount = mentionCounts.get(brand.name) || 0;
      const linkCount = linkCounts.get(brand.name) || 0;
      const ratio = mentionCount > 0 ? linkCount / mentionCount : 0;

      return {
        name: brand.name,
        mentions: mentionCount,
        links: linkCount,
        ratio: Math.round(ratio * 100) / 100,
        isOwnBrand: brand.isOwnBrand,
      };
    })
    .sort((a, b) => b.ratio - a.ratio);
}
