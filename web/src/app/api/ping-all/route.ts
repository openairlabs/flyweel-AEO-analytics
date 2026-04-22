import { db } from "@/db";
import { prompts, providers, responses } from "@/db/schema";
import { WORKFLOW_CONCURRENCY } from "@/lib/config";
import { getRenderClient } from "@/lib/render";
import { and, eq, gte, lt } from "drizzle-orm";
import pLimit from "p-limit";

// Check if a response exists for this prompt/provider today
async function hasResponseToday(promptId: string, providerId: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const existing = await db
    .select({ id: responses.id })
    .from(responses)
    .where(
      and(
        eq(responses.promptId, promptId),
        eq(responses.providerId, providerId),
        gte(responses.createdAt, today),
        lt(responses.createdAt, tomorrow),
      ),
    )
    .limit(1);

  return existing.length > 0;
}

export async function POST(req: Request) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  // Only require auth if Authorization header is provided (external/cron calls)
  // UI calls don't send Authorization header, so they're allowed
  if (authHeader && cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const activePrompts = await db.query.prompts.findMany({
    where: eq(prompts.isActive, true),
  });

  const activeProviders = await db.query.providers.findMany({
    where: eq(providers.isActive, true),
  });

  if (activePrompts.length === 0) {
    return Response.json({ error: "No active prompts" }, { status: 400 });
  }

  if (activeProviders.length === 0) {
    return Response.json({ error: "No active providers" }, { status: 400 });
  }

  const tasks = activePrompts.flatMap((prompt) =>
    activeProviders.map((provider) => ({
      prompt,
      provider,
    })),
  );

  const total = tasks.length;
  console.log(
    `Running ${total} ping tasks (${WORKFLOW_CONCURRENCY} at a time)...`,
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
    let skipped = 0;

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
        const limit = pLimit(WORKFLOW_CONCURRENCY);

        await Promise.all(
          tasks.map(({ prompt, provider }) =>
            limit(async () => {
              try {
                // Skip if already pinged today
                if (await hasResponseToday(prompt.id, provider.id)) {
                  skipped++;
                  completed++;
                  sendEvent({
                    type: "progress",
                    completed,
                    total,
                    successful,
                    failed,
                    skipped,
                  });
                  return;
                }

                const workflowSlug =
                  process.env.RENDER_WORKFLOW_SLUG || "ping-llm";
                const taskResult = await render.workflows.runTask(
                  `${workflowSlug}/ping-llm`,
                  [provider.name, provider.model, prompt.content],
                );

                const result = taskResult.results?.[0] as {
                  content: string;
                  latencyMs: number;
                  tokenCount?: number;
                  webSearchUsed?: boolean;
                };

                await db.insert(responses).values({
                  promptId: prompt.id,
                  providerId: provider.id,
                  content: result.content,
                  latencyMs: result.latencyMs,
                  tokenCount: result.tokenCount,
                  webSearchUsed: result.webSearchUsed,
                });

                successful++;
              } catch (error) {
                console.error(
                  `Failed to ping ${provider.name} for prompt ${prompt.id}:`,
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
                skipped,
              });
            }),
          ),
        );

        // Send completion
        sendEvent({ type: "done", total, successful, failed, skipped });
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

  // Non-streaming fallback (for cron jobs)
  const render = getRenderClient();
  const limit = pLimit(WORKFLOW_CONCURRENCY);

  const results = await Promise.all(
    tasks.map(({ prompt, provider }) =>
      limit(async () => {
        try {
          // Skip if already pinged today
          if (await hasResponseToday(prompt.id, provider.id)) {
            return {
              skipped: true,
              promptId: prompt.id,
              providerId: provider.id,
            };
          }

          const workflowSlug = process.env.RENDER_WORKFLOW_SLUG || "ping-llm";
          const taskResult = await render.workflows.runTask(
            `${workflowSlug}/ping-llm`,
            [provider.name, provider.model, prompt.content],
          );

          const result = taskResult.results?.[0] as {
            content: string;
            latencyMs: number;
            tokenCount?: number;
            webSearchUsed?: boolean;
          };

          await db.insert(responses).values({
            promptId: prompt.id,
            providerId: provider.id,
            content: result.content,
            latencyMs: result.latencyMs,
            tokenCount: result.tokenCount,
            webSearchUsed: result.webSearchUsed,
          });

          return {
            success: true,
            promptId: prompt.id,
            providerId: provider.id,
          };
        } catch (error) {
          console.error(
            `Failed to ping ${provider.name} for prompt ${prompt.id}:`,
            error,
          );
          return {
            success: false,
            promptId: prompt.id,
            providerId: provider.id,
            error: String(error),
          };
        }
      }),
    ),
  );

  const successful = results.filter((r) => "success" in r && r.success).length;
  const failed = results.filter((r) => "success" in r && !r.success).length;
  const skipped = results.filter((r) => "skipped" in r && r.skipped).length;

  return Response.json({
    success: true,
    total: tasks.length,
    successful,
    failed,
    skipped,
    results,
  });
}
