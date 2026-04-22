import { db } from "@/db";
import { prompts, providers, responses } from "@/db/schema";
import { WORKFLOW_CONCURRENCY } from "@/lib/config";
import { getRenderClient } from "@/lib/render";
import { and, eq, gte, lt, sql } from "drizzle-orm";
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
  const body = await req.json();
  const { promptId } = body;

  if (!promptId) {
    return Response.json({ error: "promptId is required" }, { status: 400 });
  }

  const prompt = await db.query.prompts.findFirst({
    where: eq(prompts.id, promptId),
  });

  if (!prompt) {
    return Response.json({ error: "Prompt not found" }, { status: 404 });
  }

  const activeProviders = await db.query.providers.findMany({
    where: eq(providers.isActive, true),
  });

  if (activeProviders.length === 0) {
    return Response.json({ error: "No active providers" }, { status: 400 });
  }

  const total = activeProviders.length;

  // Check if client wants streaming
  const acceptHeader = req.headers.get("accept");
  const wantsStream = acceptHeader?.includes("text/event-stream");

  if (wantsStream) {
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
        const workflowSlug = process.env.RENDER_WORKFLOW_SLUG || "ping-llm";
        const limit = pLimit(WORKFLOW_CONCURRENCY);

        // Run all providers in parallel with concurrency limit
        await Promise.all(
          activeProviders.map((provider) =>
            limit(async () => {
              try {
                // Skip if already pinged today
                if (await hasResponseToday(prompt.id, provider.id)) {
                  console.log(
                    `Skipping ${provider.name} - already pinged today`,
                  );
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

                const taskResult = await render.workflows.runTask(
                  `${workflowSlug}/ping-llm`,
                  [provider.name, provider.model, prompt.content],
                );

                // Check if task succeeded
                if (
                  taskResult.status !== "completed" ||
                  !taskResult.results?.[0]
                ) {
                  console.error(
                    `Task failed for ${provider.name}:`,
                    taskResult.error || `status=${taskResult.status}`,
                  );
                  failed++;
                } else {
                  const result = taskResult.results[0] as {
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
                }
              } catch (error) {
                console.error(`Failed to ping ${provider.name}:`, error);
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

  // Non-streaming fallback
  const render = getRenderClient();
  const workflowSlug = process.env.RENDER_WORKFLOW_SLUG || "ping-llm";
  const limit = pLimit(WORKFLOW_CONCURRENCY);

  const results = await Promise.all(
    activeProviders.map((provider) =>
      limit(async () => {
        // Skip if already pinged today
        if (await hasResponseToday(prompt.id, provider.id)) {
          return {
            provider: provider.name,
            skipped: true,
          };
        }

        const taskResult = await render.workflows.runTask(
          `${workflowSlug}/ping-llm`,
          [provider.name, provider.model, prompt.content],
        );

        // Check if task succeeded
        if (taskResult.status !== "completed" || !taskResult.results?.[0]) {
          throw new Error(
            taskResult.error || `Task failed with status=${taskResult.status}`,
          );
        }

        const result = taskResult.results[0] as {
          content: string;
          latencyMs: number;
          tokenCount?: number;
          webSearchUsed?: boolean;
        };

        const [saved] = await db
          .insert(responses)
          .values({
            promptId: prompt.id,
            providerId: provider.id,
            content: result.content,
            latencyMs: result.latencyMs,
            tokenCount: result.tokenCount,
            webSearchUsed: result.webSearchUsed,
          })
          .returning();

        return {
          provider: provider.name,
          response: saved,
        };
      }),
    ),
  );

  const skipped = results.filter((r) => "skipped" in r && r.skipped).length;

  return Response.json({
    success: true,
    promptId: prompt.id,
    results,
    skipped,
  });
}
