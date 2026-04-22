import { NextRequest, NextResponse } from "next/server";

const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === "true";
const CRON_SECRET = process.env.CRON_SECRET;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 30;

const hits = new Map<string, number[]>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const windowStart = now - RATE_LIMIT_WINDOW_MS;

  let timestamps = hits.get(ip) ?? [];
  timestamps = timestamps.filter((t) => t > windowStart);
  timestamps.push(now);
  hits.set(ip, timestamps);

  // Periodically prune stale IPs (every ~100 requests)
  if (Math.random() < 0.01) {
    for (const [key, ts] of hits) {
      if (ts.every((t) => t <= windowStart)) hits.delete(key);
    }
  }

  return timestamps.length > RATE_LIMIT_MAX;
}

function clientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}

export function proxy(req: NextRequest) {
  if (!DEMO_MODE) return NextResponse.next();

  const { pathname } = req.nextUrl;
  if (!pathname.startsWith("/api/")) return NextResponse.next();

  const method = req.method.toUpperCase();

  if (method !== "GET") {
    // Allow authenticated cron job requests through
    if (CRON_SECRET) {
      const auth = req.headers.get("authorization");
      if (auth === `Bearer ${CRON_SECRET}`) {
        return NextResponse.next();
      }
    }

    return NextResponse.json(
      {
        error:
          "This action is disabled on the demo instance. Deploy your own to unlock all features.",
      },
      { status: 403 },
    );
  }

  // Rate limit GET requests
  if (isRateLimited(clientIp(req))) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Please slow down." },
      { status: 429 },
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: "/api/:path*",
};
