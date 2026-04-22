import { db } from "@/db";
import {
  analyses,
  brandLinks,
  brandMentions,
  brands,
  responses,
} from "@/db/schema";
import { WORKFLOW_CONCURRENCY } from "@/lib/config";
import { getRenderClient } from "@/lib/render";
import { eq, isNull, sql } from "drizzle-orm";
import pLimit from "p-limit";

export async function GET() {
  // Get count of unanalyzed responses
  const unanalyzedCount = await db
    .select({ count: sql<number>`count(*)` })
    .from(responses)
    .leftJoin(analyses, eq(responses.id, analyses.responseId))
    .where(isNull(analyses.id));

  return Response.json({ count: Number(unanalyzedCount[0]?.count || 0) });
}

export async function POST(req: Request) {
  // Get all responses that don't have an analysis
  const unanalyzedResponses = await db
    .select({
      id: responses.id,
      promptId: responses.promptId,
    })
    .from(responses)
    .leftJoin(analyses, eq(responses.id, analyses.responseId))
    .where(isNull(analyses.id));

  if (unanalyzedResponses.length === 0) {
    return Response.json({ error: "No responses to analyze" }, { status: 400 });
  }

  const total = unanalyzedResponses.length;

  // Get all active brands for storing mentions
  const allBrands = await db.query.brands.findMany({
    where: eq(brands.isActive, true),
  });

  console.log(
    `Analyzing ${total} responses (${WORKFLOW_CONCURRENCY} at a time)...`,
  );

  // Check if client wants streaming
  const acceptHeader = req.headers.get("accept");
  const wantsStream = acceptHeader?.includes("text/event-stream");

  if (wantsStream) {
    // Stream progress via SSE
    const encoder = new TextEncoder();
    let completed = 0;
    let successful = 0;
    let failed = 0;

    const stream = new ReadableStream({
      async start(controller) {
        const sendEvent = (data: object) => {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(data)}\n\n`),
          );
        };

        // Send initial count
        sendEvent({ type: "start", total });

        const render = getRenderClient();
        const workflowSlug =
          process.env.RENDER_WORKFLOW_SLUG || "analyze-response";
        const taskPath = `${workflowSlug}/analyze-response`;
        const limit = pLimit(WORKFLOW_CONCURRENCY);

        await Promise.all(
          unanalyzedResponses.map((response) =>
            limit(async () => {
              try {
                // Workflow fetches data from DB - just pass responseId
                const taskResult = await render.workflows.runTask(taskPath, [
                  response.id,
                ]);

                const analysisResult = taskResult.results?.[0] as {
                  summary: string;
                  mentions: Array<{
                    brandName: string;
                    sentiment: "positive" | "negative" | "neutral";
                    ranking: number | null;
                    context: string;
                  }>;
                  links: Array<{
                    url: string;
                    linkText: string | null;
                    isMarkdownLink: boolean;
                    brandName: string | null;
                  }>;
                };

                const [analysis] = await db
                  .insert(analyses)
                  .values({
                    responseId: response.id,
                    summary: analysisResult.summary,
                  })
                  .returning();

                for (const mention of analysisResult.mentions) {
                  const brand = allBrands.find(
                    (b) => b.name === mention.brandName,
                  );
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
                for (const link of analysisResult.links || []) {
                  const brand = link.brandName
                    ? allBrands.find((b) => b.name === link.brandName)
                    : null;
                  await db.insert(brandLinks).values({
                    analysisId: analysis.id,
                    brandId: brand?.id || null,
                    url: link.url,
                    linkText: link.linkText,
                    isMarkdownLink: link.isMarkdownLink,
                  });
                }

                successful++;
              } catch (error) {
                console.error(
                  `Failed to analyze response ${response.id}:`,
                  error,
                );
                failed++;
              }

              completed++;
              sendEvent({
                type: "progress",
                completed,
                total,
                successful,
                failed,
              });
            }),
          ),
        );

        // Send completion
        sendEvent({ type: "done", total, successful, failed });
        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  }

  // Non-streaming fallback
  const render = getRenderClient();
  const workflowSlug = process.env.RENDER_WORKFLOW_SLUG || "analyze-response";
  const taskPath = `${workflowSlug}/analyze-response`;
  const limit = pLimit(WORKFLOW_CONCURRENCY);

  const results = await Promise.all(
    unanalyzedResponses.map((response) =>
      limit(async () => {
        try {
          // Workflow fetches data from DB - just pass responseId
          const taskResult = await render.workflows.runTask(taskPath, [
            response.id,
          ]);

          const analysisResult = taskResult.results?.[0] as {
            summary: string;
            mentions: Array<{
              brandName: string;
              sentiment: "positive" | "negative" | "neutral";
              ranking: number | null;
              context: string;
            }>;
            links: Array<{
              url: string;
              linkText: string | null;
              isMarkdownLink: boolean;
              brandName: string | null;
            }>;
          };

          const [analysis] = await db
            .insert(analyses)
            .values({
              responseId: response.id,
              summary: analysisResult.summary,
            })
            .returning();

          for (const mention of analysisResult.mentions) {
            const brand = allBrands.find((b) => b.name === mention.brandName);
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
          for (const link of analysisResult.links || []) {
            const brand = link.brandName
              ? allBrands.find((b) => b.name === link.brandName)
              : null;
            await db.insert(brandLinks).values({
              analysisId: analysis.id,
              brandId: brand?.id || null,
              url: link.url,
              linkText: link.linkText,
              isMarkdownLink: link.isMarkdownLink,
            });
          }

          return { success: true, responseId: response.id };
        } catch (error) {
          console.error(`Failed to analyze response ${response.id}:`, error);
          return {
            success: false,
            responseId: response.id,
            error: String(error),
          };
        }
      }),
    ),
  );

  const successful = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;

  return Response.json({
    success: true,
    total,
    successful,
    failed,
    results,
  });
}
