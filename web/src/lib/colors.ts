// Hex values for recharts (can't use Tailwind classes in JS)
// These match Tailwind's color-500 values

// Brand colors for charts - each competitor gets a distinct color
export const BRAND_COLORS: Record<string, string> = {
  // PaaS competitors
  Railway: "#a855f7", // purple-500
  Vercel: "#3b82f6", // blue-500
  "Fly.io": "#f97316", // orange-500
  Heroku: "#ec4899", // pink-500
  Netlify: "#06b6d4", // cyan-500
  DigitalOcean: "#0ea5e9", // sky-500
  Northflank: "#84cc16", // lime-500
  Cloudflare: "#f59e0b", // amber-500

  // Major clouds
  AWS: "#eab308", // yellow-500
  GCP: "#22c55e", // green-500
  Azure: "#6366f1", // indigo-500
};

// Extended fallback colors for any new brands
const FALLBACK_COLORS = [
  "#14b8a6", // teal-500
  "#ef4444", // red-500
  "#8b5cf6", // violet-500
  "#f43f5e", // rose-500
  "#10b981", // emerald-500
  "#64748b", // slate-500
  "#d946ef", // fuchsia-500
  "#fb923c", // orange-400
  "#4ade80", // green-400
  "#a78bfa", // violet-400
  "#fbbf24", // amber-400
  "#38bdf8", // sky-400
];

// Track which fallback colors have been assigned to avoid duplicates
const assignedFallbackColors = new Map<string, string>();
let fallbackIndex = 0;

export function getBrandColor(brandName: string, isOwnBrand?: boolean): string {
  if (isOwnBrand) return "#ffffff"; // white for own brand

  // Check explicit colors first
  if (BRAND_COLORS[brandName]) {
    return BRAND_COLORS[brandName];
  }

  // Check if we already assigned a fallback color to this brand
  if (assignedFallbackColors.has(brandName)) {
    return assignedFallbackColors.get(brandName)!;
  }

  // Assign next fallback color
  const color = FALLBACK_COLORS[fallbackIndex % FALLBACK_COLORS.length];
  assignedFallbackColors.set(brandName, color);
  fallbackIndex++;

  return color;
}

// Provider colors
export const PROVIDER_COLORS: Record<string, string> = {
  openai: "#10b981", // emerald-500
  anthropic: "#f59e0b", // amber-500
  google: "#3b82f6", // blue-500
};

export function getProviderColor(providerName: string): string {
  return PROVIDER_COLORS[providerName.toLowerCase()] || "#888";
}
