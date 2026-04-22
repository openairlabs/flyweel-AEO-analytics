/**
 * Utility functions for workflow tasks.
 */

export interface ExtractedUrl {
  url: string;
  linkText: string | null;
  isMarkdownLink: boolean;
}

export interface BrandWithDomains {
  id: string;
  name: string;
  domains: string[] | null;
}

/**
 * Extract URLs from response content (both markdown links and plain URLs)
 */
export function extractUrls(content: string): ExtractedUrl[] {
  const results: ExtractedUrl[] = [];
  const seenUrls = new Set<string>();

  // Markdown links: [text](url)
  const markdownRegex = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;
  for (const match of content.matchAll(markdownRegex)) {
    const url = match[2];
    if (!seenUrls.has(url)) {
      seenUrls.add(url);
      results.push({ url, linkText: match[1], isMarkdownLink: true });
    }
  }

  // Plain URLs (not already captured in markdown)
  // Remove markdown links from content first to avoid duplicates
  const contentWithoutMarkdown = content.replace(
    /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
    "",
  );
  const urlRegex = /https?:\/\/[^\s\)>\]]+/g;
  for (const match of contentWithoutMarkdown.matchAll(urlRegex)) {
    const url = match[0].replace(/[.,;:!?]+$/, ""); // Remove trailing punctuation
    if (!seenUrls.has(url)) {
      seenUrls.add(url);
      results.push({ url, linkText: null, isMarkdownLink: false });
    }
  }

  return results;
}

/**
 * Match URL to brand via domain
 */
export function matchUrlToBrand(
  url: string,
  brands: BrandWithDomains[],
): BrandWithDomains | null {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, "");
    return (
      brands.find((b) =>
        b.domains?.some((d) => hostname === d || hostname.endsWith(`.${d}`)),
      ) || null
    );
  } catch {
    return null;
  }
}
