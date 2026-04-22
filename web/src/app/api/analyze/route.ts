import { db } from "@/db";
import {
  analyses,
  brandLinks,
  brandMentions,
  brands,
  responses,
} from "@/db/schema";
import { getRenderClient, toSdkErrorResponse } from "@/lib/render";
import { eq } from "drizzle-orm";

export async function POST(req: Request) {
  const body = await req.json();
  const { responseId } = body;

  if (!responseId) {
    return Response.json({ error: "responseId is required" }, { status: 400 });
  }

  const response = await db.query.responses.findFirst({
    where: eq(responses.id, responseId),
    with: {
      prompt: {
        with: {
          industry: true,
        },
      },
    },
  });

  if (!response) {
    return Response.json({ error: "Response not found" }, { status: 404 });
  }

  const existingAnalysis = await db.query.analyses.findFirst({
    where: eq(analyses.responseId, responseId),
  });

  if (existingAnalysis) {
    return Response.json(
      { error: "Response already analyzed" },
      { status: 400 },
    );
  }

  // Get brands for storing mentions later
  const industryId = response.prompt?.industryId;
  const brandsToCheck = industryId
    ? await db.query.brands.findMany({
        where: eq(brands.industryId, industryId),
      })
    : await db.query.brands.findMany({
        where: eq(brands.isActive, true),
      });

  const render = getRenderClient();

  const workflowSlug = process.env.RENDER_WORKFLOW_SLUG || "analyze-response";
  const taskPath = `${workflowSlug}/analyze-response`;

  console.log("Calling workflow task:", taskPath);
  console.log("Input: responseId =", responseId);

  let taskResult: { results?: unknown[] };
  try {
    // Workflow fetches data from DB - just pass responseId
    taskResult = await render.workflows.runTask(taskPath, [responseId]);
    console.log("Task result:", JSON.stringify(taskResult, null, 2));
  } catch (error) {
    console.error("Workflow task error:", error);
    const { status, message } = toSdkErrorResponse(error);
    return Response.json({ error: message }, { status });
  }

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

  // Save brand mentions
  for (const mention of analysisResult.mentions) {
    const brand = brandsToCheck.find((b) => b.name === mention.brandName);
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

  // Save brand links
  for (const link of analysisResult.links || []) {
    const brand = link.brandName
      ? brandsToCheck.find((b) => b.name === link.brandName)
      : null;
    await db.insert(brandLinks).values({
      analysisId: analysis.id,
      brandId: brand?.id || null,
      url: link.url,
      linkText: link.linkText,
      isMarkdownLink: link.isMarkdownLink,
    });
  }

  const completeAnalysis = await db.query.analyses.findFirst({
    where: eq(analyses.id, analysis.id),
    with: {
      mentions: {
        with: {
          brand: true,
        },
      },
      links: {
        with: {
          brand: true,
        },
      },
    },
  });

  return Response.json(completeAnalysis);
}
