"""Utility functions for workflow tasks."""

import re
from urllib.parse import urlparse


def log(msg: str):
    """Print with flush for immediate log output."""
    print(msg, flush=True)


def extract_urls(content: str) -> list[dict]:
    """Extract URLs from response content (both markdown links and plain URLs)."""
    results = []
    seen_urls = set()

    # Markdown links: [text](url)
    markdown_pattern = r"\[([^\]]+)\]\((https?://[^\s)]+)\)"
    for match in re.finditer(markdown_pattern, content):
        url = match.group(2)
        if url not in seen_urls:
            seen_urls.add(url)
            results.append(
                {"url": url, "linkText": match.group(1), "isMarkdownLink": True}
            )

    # Plain URLs (exclude those already in markdown)
    # Remove markdown links from content first to avoid duplicates
    content_without_markdown = re.sub(markdown_pattern, "", content)
    url_pattern = r"https?://[^\s\)>\]]+"
    for match in re.finditer(url_pattern, content_without_markdown):
        url = match.group(0).rstrip(".,;:!?")  # Remove trailing punctuation
        if url not in seen_urls:
            seen_urls.add(url)
            results.append({"url": url, "linkText": None, "isMarkdownLink": False})

    return results


def match_url_to_brand(url: str, brands: list[dict]) -> dict | None:
    """Match URL to brand via domain."""
    try:
        hostname = urlparse(url).hostname or ""
        hostname = hostname.removeprefix("www.")

        for brand in brands:
            domains = brand.get("domains") or []
            for domain in domains:
                if hostname == domain or hostname.endswith("." + domain):
                    return brand
        return None
    except Exception:
        return None
