import { db } from "@/db";
import { digests } from "@/db/schema";
import { getRenderClient, toSdkErrorResponse } from "@/lib/render";
import { desc } from "drizzle-orm";

export async function GET() {
  // Get the latest digest
  const latest = await db.query.digests.findFirst({
    orderBy: [desc(digests.createdAt)],
  });

  if (!latest) {
    return Response.json({ digest: null });
  }

  return Response.json({
    digest: latest.content,
    createdAt: latest.createdAt,
  });
}

export async function POST() {
  const render = getRenderClient();

  const workflowSlug = process.env.RENDER_WORKFLOW_SLUG || "analyze-response";
  const taskPath = `${workflowSlug}/generate-digest`;

  console.log("Calling workflow task:", taskPath);

  let taskResult: { results?: unknown[] };
  try {
    // No input required - workflow fetches all data from DB
    taskResult = await render.workflows.runTask(taskPath, []);
    console.log("Task result:", JSON.stringify(taskResult, null, 2));
  } catch (error) {
    console.error("Workflow task error:", error);
    const { status, message } = toSdkErrorResponse(error);
    return Response.json({ error: message }, { status });
  }

  const result = taskResult.results?.[0] as { digest: string } | undefined;

  if (!result?.digest) {
    return Response.json({ error: "No digest generated" }, { status: 500 });
  }

  // Save the digest to the database
  const [saved] = await db
    .insert(digests)
    .values({ content: result.digest })
    .returning();

  return Response.json({
    digest: saved.content,
    createdAt: saved.createdAt,
  });
}
