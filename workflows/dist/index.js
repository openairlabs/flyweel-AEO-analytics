import "dotenv/config";
import { ChatAnthropic, tools as anthropicTools } from "@langchain/anthropic";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { ChatOpenAI } from "@langchain/openai";
import { startTaskServer, task } from "@renderinc/sdk/workflows";
import { and, eq, gte, isNull, lt, sql } from "drizzle-orm";
import { Sema } from "async-sema";
const CONCURRENCY = 10;
import { db } from "./db/index.js";
import { analyses, brandLinks, brandMentions, brands, prompts, providers, responses, } from "./db/schema.js";
export const pingLLM = task({
    name: "ping-llm",
    timeoutSeconds: 300, // 5 minutes
    retry: {
        maxRetries: 1,
        waitDurationMs: 2000,
        backoffScaling: 1.5,
    },
}, async function pingLLM(provider, model, prompt) {
    console.log(`[ping-llm] Starting: provider=${provider}, model=${model}`);
    const startTime = Date.now();
    let response;
    switch (provider) {
        case "openai": {
            const llm = new ChatOpenAI({
                model,
                apiKey: process.env.OPENAI_API_KEY,
            });
            // Web search tool using Responses API format (per Python docs pattern)
            const webSearchTool = { type: "web_search_preview" };
            const llmWithSearch = llm.bindTools([webSearchTool]);
            response = await llmWithSearch.invoke(prompt);
            break;
        }
        case "anthropic": {
            const llm = new ChatAnthropic({
                model,
                apiKey: process.env.ANTHROPIC_API_KEY,
                temperature: 1,
            });
            // Bind web search tool and invoke
            response = await llm.invoke(prompt, {
                tools: [anthropicTools.webSearch_20250305()],
            });
            break;
        }
        case "google": {
            const llm = new ChatGoogleGenerativeAI({
                model,
                apiKey: process.env.GOOGLE_API_KEY,
            });
            // Google Search grounding tool (snake_case per API error message)
            const searchTool = { google_search: {} };
            const llmWithSearch = llm.bindTools([searchTool]);
            response = await llmWithSearch.invoke(prompt);
            break;
        }
        default:
            throw new Error(`Unknown provider: ${provider}`);
    }
    // Handle content that might be an array (Gemini) or string
    let content;
    if (typeof response.content === "string") {
        content = response.content;
    }
    else if (Array.isArray(response.content)) {
        content = response.content
            .map((part) => (typeof part === "string" ? part : part.text || ""))
            .join("");
    }
    else {
        content = String(response.content);
    }
    // Detect if web search was used
    let webSearchUsed = false;
    // Debug: log response metadata for detection debugging
    console.log(`[${provider}] Checking web search usage...`);
    console.log(`[${provider}] tool_calls:`, JSON.stringify(response.tool_calls?.slice(0, 2)));
    console.log(`[${provider}] additional_kwargs keys:`, Object.keys(response.additional_kwargs || {}));
    if (provider === "google") {
        console.log(`[${provider}] response_metadata keys:`, Object.keys(response.response_metadata || {}));
    }
    if (provider === "openai") {
        // OpenAI: Check multiple places for web search evidence
        const additionalKwargs = response.additional_kwargs;
        // Log everything for debugging
        console.log(`[${provider}] additional_kwargs:`, JSON.stringify(additionalKwargs, null, 2).substring(0, 500));
        console.log(`[${provider}] content type:`, typeof response.content, Array.isArray(response.content) ? "array" : "");
        if (Array.isArray(response.content)) {
            console.log(`[${provider}] content blocks:`, JSON.stringify(response.content.slice(0, 3).map((c) => typeof c === "object" && c !== null
                ? {
                    type: c.type,
                    name: c.name,
                    hasAnnotations: !!c
                        .annotations,
                    annotationCount: c.annotations?.length,
                }
                : typeof c)));
        }
        // Check content blocks for server_tool_call OR annotations with citations
        if (Array.isArray(response.content)) {
            for (const part of response.content) {
                if (typeof part === "object" && part !== null) {
                    const p = part;
                    // Check for server_tool_call
                    if (p.type === "server_tool_call" && p.name === "web_search") {
                        webSearchUsed = true;
                        break;
                    }
                    // Check for annotations in text blocks (citations from web search)
                    const annotations = p.annotations;
                    if (annotations?.some((a) => a.type === "url_citation" || a.type === "citation" || a.url)) {
                        webSearchUsed = true;
                        break;
                    }
                }
            }
        }
        // Also check tool_outputs for web_search_call (per OpenAI docs)
        if (!webSearchUsed) {
            const toolOutputs = additionalKwargs?.tool_outputs;
            if (toolOutputs?.some((t) => t.type === "web_search_call")) {
                webSearchUsed = true;
            }
        }
        // Check tool_calls for web_search name
        if (!webSearchUsed && response.tool_calls?.length) {
            webSearchUsed = response.tool_calls.some((tc) => tc.name === "web_search");
        }
        // Check annotations for url_citation
        if (!webSearchUsed && additionalKwargs) {
            const annotations = additionalKwargs.annotations;
            if (annotations?.some((a) => a.type === "url_citation")) {
                webSearchUsed = true;
            }
        }
    }
    else if (provider === "anthropic") {
        // Anthropic: Check for web_search_tool_result in content
        if (Array.isArray(response.content)) {
            webSearchUsed = response.content.some((part) => typeof part === "object" &&
                part !== null &&
                "type" in part &&
                (part.type === "web_search_tool_result" ||
                    part.type === "server_tool_use"));
        }
    }
    else if (provider === "google") {
        // Google: Check for groundingMetadata in response_metadata
        const metadata = response.response_metadata;
        // Log everything for debugging
        console.log(`[${provider}] response_metadata:`, JSON.stringify(metadata, null, 2).substring(0, 1000));
        console.log(`[${provider}] content type:`, typeof response.content, Array.isArray(response.content) ? "array" : "");
        if (Array.isArray(response.content)) {
            console.log(`[${provider}] content blocks:`, JSON.stringify(response.content.slice(0, 3).map((c) => typeof c === "object" && c !== null
                ? {
                    type: c.type,
                    name: c.name,
                }
                : typeof c)));
        }
        // Check content blocks for server_tool_call with google_search or annotations with citations
        if (Array.isArray(response.content)) {
            for (const part of response.content) {
                if (typeof part === "object" && part !== null) {
                    const p = part;
                    // Check for server_tool_call
                    if (p.type === "server_tool_call" && p.name === "google_search") {
                        webSearchUsed = true;
                        break;
                    }
                    // Check for annotations with citations
                    const annotations = p.annotations;
                    if (annotations?.some((a) => a.type === "citation")) {
                        webSearchUsed = true;
                        break;
                    }
                }
            }
        }
        // Also check groundingMetadata
        if (!webSearchUsed) {
            const groundingMeta = metadata?.groundingMetadata;
            webSearchUsed =
                !!groundingMeta?.groundingChunks?.length ||
                    !!groundingMeta?.webSearchQueries?.length;
            console.log(`[${provider}] groundingMetadata:`, groundingMeta ? "present" : "absent");
        }
    }
    console.log(`[ping-llm] Done: provider=${provider}, webSearchUsed=${webSearchUsed}, latency=${Date.now() - startTime}ms`);
    return {
        content,
        latencyMs: Date.now() - startTime,
        tokenCount: response.usage_metadata?.total_tokens,
        webSearchUsed,
    };
});
/**
 * Extract URLs from response content (both markdown links and plain URLs)
 */
function extractUrls(content) {
    const results = [];
    const seenUrls = new Set();
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
    const contentWithoutMarkdown = content.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, "");
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
function matchUrlToBrand(url, brands) {
    try {
        const hostname = new URL(url).hostname.replace(/^www\./, "");
        return (brands.find((b) => b.domains?.some((d) => hostname === d || hostname.endsWith(`.${d}`))) || null);
    }
    catch {
        return null;
    }
}
export const analyzeResponse = task({
    name: "analyze-response",
    timeoutSeconds: 300, // 5 minutes
    retry: {
        maxRetries: 1,
        waitDurationMs: 2000,
        backoffScaling: 1.5,
    },
}, async function analyzeResponse(responseId) {
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
    const links = extractedUrls.map((urlData) => {
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
        model: "claude-opus-4-5-20251101",
        apiKey: process.env.ANTHROPIC_API_KEY,
    });
    console.log("Calling Claude for analysis...");
    const llmResponse = await model.invoke(`Analyze this LLM response for mentions of these platforms: ${brandNames.join(", ")}

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
    const content = llmResponse.content;
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
        console.log("Failed to extract JSON from:", content);
        throw new Error("Failed to parse JSON from response");
    }
    const result = JSON.parse(jsonMatch[0]);
    console.log("Parsed result:", result);
    console.log("Links found:", links.length);
    return {
        summary: result.summary,
        mentions: result.mentions,
        links,
    };
});
export const generateDigest = task({ name: "generate-digest" }, async function generateDigest() {
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
            digest: "No own brand configured. Set up your brand in Settings to see insights.",
        };
    }
    if (allMentions.length === 0) {
        return {
            digest: "No data yet. Run some prompts and analyze responses to generate insights.",
        };
    }
    // Aggregate data instead of sending raw mentions (to avoid token limits)
    const brandStats = {};
    const providerStats = {};
    for (const m of allMentions) {
        const brand = m.brand?.name;
        const provider = m.analysis?.response?.provider?.name;
        if (!brand)
            continue;
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
        brandStats[brand][m.sentiment]++;
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
            providerStats[provider][m.sentiment]++;
            if (m.ranking) {
                providerStats[provider].rankings.push(m.ranking);
            }
        }
    }
    // Calculate averages and format for output
    const brandSummary = Object.fromEntries(Object.entries(brandStats).map(([name, stats]) => [
        name,
        {
            mentions: stats.mentions,
            positive: stats.positive,
            negative: stats.negative,
            neutral: stats.neutral,
            avgRanking: stats.rankings.length
                ? (stats.rankings.reduce((a, b) => a + b, 0) /
                    stats.rankings.length).toFixed(1)
                : null,
            isOwnBrand: stats.isOwnBrand,
        },
    ]));
    const providerSummary = Object.fromEntries(Object.entries(providerStats).map(([name, stats]) => [
        name,
        {
            mentions: stats.mentions,
            positive: stats.positive,
            negative: stats.negative,
            neutral: stats.neutral,
            avgRanking: stats.rankings.length
                ? (stats.rankings.reduce((a, b) => a + b, 0) /
                    stats.rankings.length).toFixed(1)
                : null,
        },
    ]));
    const competitors = allBrands
        .filter((b) => !b.isOwnBrand)
        .map((b) => b.name)
        .join(", ");
    if (!process.env.ANTHROPIC_API_KEY) {
        throw new Error("ANTHROPIC_API_KEY is not set");
    }
    const model = new ChatAnthropic({
        model: "claude-opus-4-5-20251101",
        apiKey: process.env.ANTHROPIC_API_KEY,
    });
    console.log("Calling Claude for digest generation...");
    const response = await model.invoke(`You are analyzing competitive intelligence data about how LLMs mention and position different brands.

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
    const digest = response.content;
    console.log("Digest generated:", digest);
    return { digest };
});
// Internal function for direct calls (bypasses SDK subtask handling)
async function pingAllInternal() {
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
    console.log(`Found ${activePrompts.length} prompts and ${activeProviders.length} providers`);
    // Build list of tasks
    const tasks = [];
    for (const prompt of activePrompts) {
        for (const provider of activeProviders) {
            tasks.push({ prompt, provider });
        }
    }
    console.log(`Total combinations to process: ${tasks.length} (${activePrompts.length} prompts × ${activeProviders.length} providers)`);
    // First, filter out already-pinged combinations
    const todaysResponses = await db
        .select({
        promptId: responses.promptId,
        providerId: responses.providerId,
    })
        .from(responses)
        .where(and(gte(responses.createdAt, today), lt(responses.createdAt, tomorrow)));
    const alreadyPinged = new Set(todaysResponses.map((r) => `${r.promptId}-${r.providerId}`));
    const tasksToRun = tasks.filter(({ prompt, provider }) => !alreadyPinged.has(`${prompt.id}-${provider.id}`));
    const skipped = tasks.length - tasksToRun.length;
    console.log(`Skipping ${skipped} already-pinged combinations, running ${tasksToRun.length} new ones`);
    // True concurrency with semaphore (like Python's asyncio.Semaphore)
    const semaphore = new Sema(CONCURRENCY);
    const results = await Promise.all(tasksToRun.map(async ({ prompt, provider }) => {
        await semaphore.acquire();
        try {
            console.log(`Spawning ping for ${provider.name} (${provider.model}) prompt ${prompt.id}`);
            const result = await pingLLM(provider.name, provider.model, prompt.content);
            // Save response to DB
            await db.insert(responses).values({
                promptId: prompt.id,
                providerId: provider.id,
                content: result.content,
                latencyMs: result.latencyMs,
                tokenCount: result.tokenCount,
                webSearchUsed: result.webSearchUsed,
            });
            console.log(`Pinged ${provider.name} for prompt ${prompt.id} successfully`);
            return { success: true };
        }
        catch (error) {
            console.error(`Failed to ping ${provider.name}:`, error);
            return { success: false };
        }
        finally {
            semaphore.release();
        }
    }));
    const pinged = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;
    console.log(`Ping-all complete: ${pinged} pinged, ${skipped} skipped, ${failed} failed`);
    return { pinged, skipped, failed };
}
// Task wrapper for external triggering
export const pingAll = task({ name: "ping-all" }, async function pingAll() {
    return pingAllInternal();
});
// Internal function for direct calls (bypasses SDK subtask handling)
async function analyzeAllInternal() {
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
    await Promise.all(unanalyzedResponses.map(async (response) => {
        await semaphore.acquire();
        try {
            console.log(`Analyzing response ${response.id}...`);
            const result = await analyzeResponse(response.id);
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
        }
        catch (error) {
            console.error(`Failed to analyze response ${response.id}:`, error);
            failed++;
        }
        finally {
            semaphore.release();
        }
    }));
    console.log(`Analyze-all complete: ${analyzed} analyzed, ${failed} failed`);
    return { analyzed, failed };
}
// Task wrapper for external triggering
export const analyzeAll = task({ name: "analyze-all" }, async function analyzeAll() {
    return analyzeAllInternal();
});
export const dailyJob = task({ name: "daily-job" }, async function dailyJob() {
    console.log("[daily-job] Starting...");
    // Step 1: Ping all - call internal function directly (bypasses subtask spawning)
    console.log("[daily-job] Step 1: Starting ping-all...");
    const pingResult = await pingAllInternal();
    console.log(`[daily-job] Step 1: ping-all COMPLETE: ${pingResult.pinged} pinged, ${pingResult.skipped} skipped, ${pingResult.failed} failed`);
    // Step 2: Analyze all (only after ping completes)
    console.log("[daily-job] Step 2: Starting analyze-all...");
    const analyzeResult = await analyzeAllInternal();
    console.log(`[daily-job] Step 2: analyze-all COMPLETE: ${analyzeResult.analyzed} analyzed, ${analyzeResult.failed} failed`);
    // Step 3: Generate digest (only after analyze completes)
    let digestGenerated = false;
    try {
        console.log("[daily-job] Step 3: Starting generate-digest...");
        const digestResult = await generateDigest();
        // Save digest to DB
        if (digestResult?.digest) {
            await db.execute(sql `INSERT INTO digests (id, content, created_at) VALUES (${crypto.randomUUID()}, ${digestResult.digest}, NOW())`);
            digestGenerated = true;
            console.log("[daily-job] Step 3: generate-digest COMPLETE - saved to DB");
        }
        else {
            console.log("[daily-job] Step 3: generate-digest COMPLETE - no digest content");
        }
    }
    catch (error) {
        console.error("[daily-job] Step 3: generate-digest FAILED:", error);
    }
    console.log("[daily-job] All steps complete!");
    return {
        ping: pingResult,
        analyze: analyzeResult,
        digestGenerated,
    };
});
// Start the task server
startTaskServer();
