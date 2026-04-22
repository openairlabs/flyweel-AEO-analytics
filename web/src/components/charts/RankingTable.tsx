interface BrandMetrics {
  brandId: string;
  brandName: string;
  isOwnBrand: boolean;
  totalMentions: number;
  positive: number;
  negative: number;
  neutral: number;
  avgRanking: number | null;
  shareOfVoice: number;
  visibilityScore: number;
}

export function RankingTable({ brands }: { brands: BrandMetrics[] }) {
  // Sort by visibility score (highest first)
  const sortedBrands = [...brands].sort(
    (a, b) => b.visibilityScore - a.visibilityScore,
  );

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-[#222]">
            <th className="text-center py-3 px-4 text-xs font-medium text-[#666] uppercase tracking-wider w-12">
              #
            </th>
            <th className="text-left py-3 px-4 text-xs font-medium text-[#666] uppercase tracking-wider">
              Brand
            </th>
            <th className="text-right py-3 px-4 text-xs font-medium text-[#666] uppercase tracking-wider">
              <span title="Combined metric of Share of Voice × Rank Score">
                Visibility
              </span>
            </th>
            <th className="text-right py-3 px-4 text-xs font-medium text-[#666] uppercase tracking-wider">
              <span title="% of responses mentioning this brand">Share</span>
            </th>
            <th className="text-right py-3 px-4 text-xs font-medium text-[#666] uppercase tracking-wider">
              Mentions
            </th>
            <th className="text-right py-3 px-4 text-xs font-medium text-[#666] uppercase tracking-wider">
              Avg Rank
            </th>
            <th className="text-right py-3 px-4 text-xs font-medium text-[#666] uppercase tracking-wider">
              <span className="text-green-500">+</span>
              <span className="mx-1 text-[#444]">/</span>
              <span className="text-[#666]">○</span>
              <span className="mx-1 text-[#444]">/</span>
              <span className="text-red-500">−</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {sortedBrands.map((brand, index) => (
            <tr
              key={brand.brandId}
              className={`border-b border-[#222] ${brand.isOwnBrand ? "bg-[#1a1a1a]" : ""}`}
            >
              <td className="text-center py-3 px-4 text-[#666] font-medium">
                {index + 1}
              </td>
              <td className="py-3 px-4">
                <span className="font-medium">{brand.brandName}</span>
                {brand.isOwnBrand && (
                  <span className="ml-2 text-xs border border-white px-1">
                    YOU
                  </span>
                )}
              </td>
              <td className="text-right py-3 px-4 font-medium">
                {brand.visibilityScore.toFixed(1)}
              </td>
              <td className="text-right py-3 px-4 text-[#888]">
                {brand.shareOfVoice.toFixed(1)}%
              </td>
              <td className="text-right py-3 px-4 text-[#666]">
                {brand.totalMentions}
              </td>
              <td className="text-right py-3 px-4 text-[#888]">
                {brand.avgRanking ? `#${brand.avgRanking.toFixed(1)}` : "—"}
              </td>
              <td className="text-right py-3 px-4 whitespace-nowrap">
                <span className="text-green-500">{brand.positive}</span>
                <span className="mx-1 text-[#333]">/</span>
                <span className="text-[#666]">{brand.neutral}</span>
                <span className="mx-1 text-[#333]">/</span>
                <span className="text-red-500">{brand.negative}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
