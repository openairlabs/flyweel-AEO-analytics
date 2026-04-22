/**
 * Workflow Tasks
 * Defines Render Workflow tasks for AEO Analytics.
 */

import "dotenv/config";
import { ChatAnthropic } from "@langchain/anthropic";
import { task, type Retry } from "@renderinc/sdk/workflows";
import { and, eq, gte, isNull, lt, sql } from "drizzle-orm";
import { Sema } from "async-sema";

import { db } from "./db/index.js";
import {
  analyses,
  brandLinks,
  brandMentions,
  brands,
  prompts,
  providers,
  responses,
} from "./db/schema.js";
import { pingProvider, type PingOutput } from "./llm.js";
import { extractUrls, matchUrlToBrand } from "./utils.js";

const CONCURRENCY = 10;

const retry: Retry = {
  maxRetries: 1,
  waitDurationMs: 2000,
  backoffScaling: 1.5,
};

// ============ PING LLM TASK ============

export const pingLLM = task(
  {
    name: "ping-llm",
    timeoutSeconds: 300, // 5 minutes
    retry,
  },
  async function pingLLM(
    provider: "openai" | "anthropic" | "google",
    model: string,
    prompt: string,
  ): Promise<PingOutput> {
    return pingProvider(provider, model, prompt);
  },
);

// ============ ANALYZE RESPONSE TASK ============

interface Mention {
  brandName: string;
  sentiment: "positive" | "negative" | "neutral";
  ranking: number | null;
  context: string;
}

interface LinkOutput {
  url: string;
  linkText: string | null;
  isMarkdownLink: boolean;
  brandName: string | null;
}

interface AnalyzeOutput {
  summary: string;
  mentions: Mention[];
  links: LinkOutput[];
}

export const analyzeResponse = task(
  {
    name: "analyze-response",
    timeoutSeconds: 300, // 5 minutes
    retry,
  },
  async function analyzeResponse(responseId: string): Promise<AnalyzeOutput> {
    console.log("Starting analyze-response task for responseId:", responseId);

    // Fetch response content from DB
    const response = await db.query.responses.findFirst({
      where: eq(responses.id, responseId),
    });

    if (!response) {
      throw new Error(`Response not found: ${responseId}`);
    }

    console.log("Response content length:", response.content.length);

    // Fetch active brands from DB (including domains for URL matching)
    const activeBrands = await db.query.brands.findMany({
      where: eq(brands.isActive, true),
    });

    const brandNames = activeBrands.map((b) => b.name);
    console.log("Brand names:", brandNames);

    // Extract URLs from response content
    const extractedUrls = extractUrls(response.content);
    console.log("Extracted URLs:", extractedUrls.length);

    // Match URLs to brands
    const links: LinkOutput[] = extractedUrls.map((urlData) => {
      const matchedBrand = matchUrlToBrand(urlData.url, activeBrands);
      return {
        ...urlData,
        brandName: matchedBrand?.name || null,
      };
    });

    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error("ANTHROPIC_API_KEY is not set");
    }

    const model = new ChatAnthropic({
      model: "claude-sonnet-4-20250514",
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    console.log("Calling Claude for analysis...");
    const llmResponse =
      await model.invoke(`Analyze this LLM response for mentions of these platforms: ${brandNames.join(", ")}

For each mentioned platform, determine:
1. Sentiment (positive, negative, or neutral) - based on how the platform is described
2. Ranking position if platforms are compared or listed (1 = first/best mentioned, null if not ranked)
3. The exact context/excerpt where it's mentioned (keep it concise, max 200 chars)

Only include platforms that are actually mentioned in the response.

Provide a brief summary (1-2 sentences) of the overall response.

IMPORTANT: Respond ONLY with valid JSON in this exact format, no other text:
{"summary": "your summary", "mentions": [{"brandName": "Name", "sentiment": "positive", "ranking": 1, "context": "excerpt"}]}

Response to analyze:
${response.content}`);

    console.log("Claude response received");

    const content = llmResponse.content as string;
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.log("Failed to extract JSON from:", content);
      throw new Error("Failed to parse JSON from response");
    }

    const result = JSON.parse(jsonMatch[0]) as {
      summary: string;
      mentions: Mention[];
    };
    console.log("Parsed result:", result);
    console.log("Links found:", links.length);

    return {
      summary: result.summary,
      mentions: result.mentions,
      links,
    };
  },
);

// ============ GENERATE DIGEST TASK ============

interface DigestOutput {
  digest: string;
}

export const generateDigest = task(
  { name: "generate-digest" },
  async function generateDigest(): Promise<DigestOutput> {
    console.log("Starting generate-digest task...");

    // Fetch all data from DB
    const allMentions = await db.query.brandMentions.findMany({
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

    const allBrands = await db.query.brands.findMany({
      where: eq(brands.isActive, true),
    });

    const ownBrand = allBrands.find((b) => b.isOwnBrand);

    if (!ownBrand) {
      return {
        digest:
          "No own brand configured. Set up your brand in Settings to see insights.",
      };
    }

    if (allMentions.length === 0) {
      return {
        digest:
          "No data yet. Run some prompts and analyze responses to generate insights.",
      };
    }

    // Aggregate data instead of sending raw mentions (to avoid token limits)
    const brandStats: Record<
      string,
      {
        mentions: number;
        positive: number;
        negative: number;
        neutral: number;
        rankings: number[];
        isOwnBrand: boolean;
      }
    > = {};
    const providerStats: Record<
      string,
      {
        mentions: number;
        positive: number;
        negative: number;
        neutral: number;
        rankings: number[];
      }
    > = {};

    for (const m of allMentions) {
      const brand = m.brand?.name;
      const provider = m.analysis?.response?.provider?.name;
      if (!brand) continue;

      // Brand aggregation
      if (!brandStats[brand]) {
        brandStats[brand] = {
          mentions: 0,
          positive: 0,
          negative: 0,
          neutral: 0,
          rankings: [],
          isOwnBrand: m.brand?.isOwnBrand || false,
        };
      }
      brandStats[brand].mentions++;
      brandStats[brand][m.sentiment as "positive" | "negative" | "neutral"]++;
      if (m.ranking) {
        brandStats[brand].rankings.push(m.ranking);
      }

      // Provider aggregation for own brand
      if (m.brand?.isOwnBrand && provider) {
        if (!providerStats[provider]) {
          providerStats[provider] = {
            mentions: 0,
            positive: 0,
            negative: 0,
            neutral: 0,
            rankings: [],
          };
        }
        providerStats[provider].mentions++;
        providerStats[provider][
          m.sentiment as "positive" | "negative" | "neutral"
        ]++;
        if (m.ranking) {
          providerStats[provider].rankings.push(m.ranking);
        }
      }
    }

    // Calculate averages and format for output
    const brandSummary = Object.fromEntries(
      Object.entries(brandStats).map(([name, stats]) => [
        name,
        {
          mentions: stats.mentions,
          positive: stats.positive,
          negative: stats.negative,
          neutral: stats.neutral,
          avgRanking: stats.rankings.length
            ? (
                stats.rankings.reduce((a, b) => a + b, 0) / stats.rankings.length
              ).toFixed(1)
            : null,
          isOwnBrand: stats.isOwnBrand,
        },
      ]),
    );

    const providerSummary = Object.fromEntries(
      Object.entries(providerStats).map(([name, stats]) => [
        name,
        {
          mentions: stats.mentions,
          positive: stats.positive,
          negative: stats.negative,
          neutral: stats.neutral,
          avgRanking: stats.rankings.length
            ? (
                stats.rankings.reduce((a, b) => a + b, 0) / stats.rankings.length
              ).toFixed(1)
            : null,
        },
      ]),
    );

    const competitors = allBrands
      .filter((b) => !b.isOwnBrand)
      .map((b) => b.name)
      .join(", ");

    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error("ANTHROPIC_API_KEY is not set");
    }

    const model = new ChatAnthropic({
      model: "claude-sonnet-4-20250514",
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    console.log("Calling Claude for digest generation...");
    const response =
      await model.invoke(`You are analyzing competitive intelligence data about how LLMs mention and position different brands.

Your brand: ${ownBrand.name}
Competitors: ${competitors}

Aggregated brand statistics (mentions, sentiment counts, avg ranking):
${JSON.stringify(brandSummary, null, 2)}

How ${ownBrand.name} performs by LLM provider:
${JSON.stringify(providerSummary, null, 2)}

Generate a concise 4-5 line digest summarizing the key insights. Focus on:
- How ${ownBrand.name} is positioned vs competitors (average ranking)
- Sentiment trends (are LLMs positive/negative about ${ownBrand.name}?)
- Which LLM providers favor or disfavor ${ownBrand.name}
- Any notable patterns or concerns

Use markdown formatting. Be direct and actionable. Start with the most important insight.
Do NOT include a title/header - just the content.`);

    const digest = response.content as string;
    console.log("Digest generated:", digest);

    return { digest };
  },
);

// ============ PING ALL TASK ============

interface PingAllOutput {
  pinged: number;
  skipped: number;
  failed: number;
}

// Internal function for direct calls (bypasses SDK subtask handling)
async function pingAllInternal(): Promise<PingAllOutput> {
  console.log("Starting ping-all task...");

  // Get today's date range for deduplication
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // Fetch active prompts and providers
  const activePrompts = await db.query.prompts.findMany({
    where: eq(prompts.isActive, true),
  });
  const activeProviders = await db.query.providers.findMany({
    where: eq(providers.isActive, true),
  });

  console.log(
    `Found ${activePrompts.length} prompts and ${activeProviders.length} providers`,
  );

  // Build list of tasks
  const tasks: {
    prompt: (typeof activePrompts)[0];
    provider: (typeof activeProviders)[0];
  }[] = [];
  for (const prompt of activePrompts) {
    for (const provider of activeProviders) {
      tasks.push({ prompt, provider });
    }
  }

  console.log(
    `Total combinations to process: ${tasks.length} (${activePrompts.length} prompts × ${activeProviders.length} providers)`,
  );

  // First, filter out already-pinged combinations
  const todaysResponses = await db
    .select({
      promptId: responses.promptId,
      providerId: responses.providerId,
    })
    .from(responses)
    .where(
      and(gte(responses.createdAt, today), lt(responses.createdAt, tomorrow)),
    );

  const alreadyPinged = new Set(
    todaysResponses.map((r) => `${r.promptId}-${r.providerId}`),
  );

  const tasksToRun = tasks.filter(
    ({ prompt, provider }) => !alreadyPinged.has(`${prompt.id}-${provider.id}`),
  );

  const skipped = tasks.length - tasksToRun.length;
  console.log(
    `Skipping ${skipped} already-pinged combinations, running ${tasksToRun.length} new ones`,
  );

  // True concurrency with semaphore (like Python's asyncio.Semaphore)
  const semaphore = new Sema(CONCURRENCY);

  const results = await Promise.all(
    tasksToRun.map(async ({ prompt, provider }) => {
      await semaphore.acquire();
      try {
        console.log(
          `Spawning ping for ${provider.name} (${provider.model}) prompt ${prompt.id}`,
        );
        const result = (await pingLLM(
          provider.name as "openai" | "anthropic" | "google",
          provider.model,
          prompt.content,
        )) as PingOutput;

        // Save response to DB
        await db.insert(responses).values({
          promptId: prompt.id,
          providerId: provider.id,
          content: result.content,
          latencyMs: result.latencyMs,
          tokenCount: result.tokenCount,
          webSearchUsed: result.webSearchUsed,
        });

        console.log(
          `Pinged ${provider.name} for prompt ${prompt.id} successfully`,
        );
        return { success: true };
      } catch (error) {
        console.error(`Failed to ping ${provider.name}:`, error);
        return { success: false };
      } finally {
        semaphore.release();
      }
    }),
  );

  const pinged = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;

  console.log(
    `Ping-all complete: ${pinged} pinged, ${skipped} skipped, ${failed} failed`,
  );
  return { pinged, skipped, failed };
}

// Task wrapper for external triggering
export const pingAll = task(
  { name: "ping-all" },
  async function pingAll(): Promise<PingAllOutput> {
    return pingAllInternal();
  },
);

// ============ ANALYZE ALL TASK ============

interface AnalyzeAllOutput {
  analyzed: number;
  failed: number;
}

// Internal function for direct calls (bypasses SDK subtask handling)
async function analyzeAllInternal(): Promise<AnalyzeAllOutput> {
  console.log("Starting analyze-all task...");

  const unanalyzedResponses = await db
    .select({ id: responses.id })
    .from(responses)
    .leftJoin(analyses, eq(responses.id, analyses.responseId))
    .where(isNull(analyses.id));

  console.log(`Found ${unanalyzedResponses.length} unanalyzed responses`);

  let analyzed = 0;
  let failed = 0;
  const activeBrands = await db.query.brands.findMany({
    where: eq(brands.isActive, true),
  });

  const semaphore = new Sema(CONCURRENCY);
  await Promise.all(
    unanalyzedResponses.map(async (response) => {
      await semaphore.acquire();
      try {
        console.log(`Analyzing response ${response.id}...`);
        const result = (await analyzeResponse(response.id)) as AnalyzeOutput;

        // Save analysis to DB
        const [analysis] = await db
          .insert(analyses)
          .values({
            responseId: response.id,
            summary: result.summary,
          })
          .returning();

        // Save mentions
        for (const mention of result.mentions) {
          const brand = activeBrands.find((b) => b.name === mention.brandName);
          if (brand) {
            await db.insert(brandMentions).values({
              analysisId: analysis.id,
              brandId: brand.id,
              sentiment: mention.sentiment,
              ranking: mention.ranking,
              context: mention.context,
            });
          }
        }

        // Save links
        for (const link of result.links) {
          const brand = link.brandName
            ? activeBrands.find((b) => b.name === link.brandName)
            : null;
          await db.insert(brandLinks).values({
            analysisId: analysis.id,
            brandId: brand?.id || null,
            url: link.url,
            linkText: link.linkText,
            isMarkdownLink: link.isMarkdownLink,
          });
        }

        analyzed++;
        console.log(`Analyzed response ${response.id} successfully`);
      } catch (error) {
        console.error(`Failed to analyze response ${response.id}:`, error);
        failed++;
      } finally {
        semaphore.release();
      }
    }),
  );

  console.log(`Analyze-all complete: ${analyzed} analyzed, ${failed} failed`);
  return { analyzed, failed };
}

// Task wrapper for external triggering
export const analyzeAll = task(
  { name: "analyze-all" },
  async function analyzeAll(): Promise<AnalyzeAllOutput> {
    return analyzeAllInternal();
  },
);

// ============ DAILY JOB TASK ============

interface DailyJobOutput {
  ping: PingAllOutput;
  analyze: AnalyzeAllOutput;
  digestGenerated: boolean;
}

export const dailyJob = task(
  { name: "daily-job" },
  async function dailyJob(): Promise<DailyJobOutput> {
    console.log("[daily-job] Starting...");

    // Step 1: Ping all - call internal function directly (bypasses subtask spawning)
    console.log("[daily-job] Step 1: Starting ping-all...");
    const pingResult = await pingAllInternal();
    console.log(
      `[daily-job] Step 1: ping-all COMPLETE: ${pingResult.pinged} pinged, ${pingResult.skipped} skipped, ${pingResult.failed} failed`,
    );

    // Step 2: Analyze all (only after ping completes)
    console.log("[daily-job] Step 2: Starting analyze-all...");
    const analyzeResult = await analyzeAllInternal();
    console.log(
      `[daily-job] Step 2: analyze-all COMPLETE: ${analyzeResult.analyzed} analyzed, ${analyzeResult.failed} failed`,
    );

    // Step 3: Generate digest (only after analyze completes)
    let digestGenerated = false;
    try {
      console.log("[daily-job] Step 3: Starting generate-digest...");
      const digestResult = await generateDigest();

      // Save digest to DB
      if (digestResult?.digest) {
        await db.execute(
          sql`INSERT INTO digests (id, content, created_at) VALUES (${crypto.randomUUID()}, ${digestResult.digest}, NOW())`,
        );
        digestGenerated = true;
        console.log(
          "[daily-job] Step 3: generate-digest COMPLETE - saved to DB",
        );
      } else {
        console.log(
          "[daily-job] Step 3: generate-digest COMPLETE - no digest content",
        );
      }
    } catch (error) {
      console.error("[daily-job] Step 3: generate-digest FAILED:", error);
    }

    console.log("[daily-job] All steps complete!");
    return {
      ping: pingResult,
      analyze: analyzeResult,
      digestGenerated,
    };
  },
);
