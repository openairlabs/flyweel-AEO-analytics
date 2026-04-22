import { db } from "@/db";
import {
  analyses,
  brandLinks,
  brandMentions,
  prompts,
  responses,
} from "@/db/schema";
import { eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export async function GET() {
  const allPrompts = await db.query.prompts.findMany({
    orderBy: (prompts, { desc }) => [desc(prompts.createdAt)],
    with: {
      industry: true,
    },
  });
  return Response.json(allPrompts);
}

export async function POST(req: Request) {
  const body = await req.json();
  const { name, content, industryId } = body;

  if (!name || !content) {
    return Response.json(
      { error: "Name and content are required" },
      { status: 400 },
    );
  }

  const [prompt] = await db
    .insert(prompts)
    .values({ name, content, industryId })
    .returning();

  return Response.json(prompt, { status: 201 });
}

export async function PUT(req: Request) {
  const body = await req.json();
  const { id, name, content, industryId, isActive } = body;

  if (!id) {
    return Response.json({ error: "ID is required" }, { status: 400 });
  }

  const [updated] = await db
    .update(prompts)
    .set({ name, content, industryId, isActive })
    .where(eq(prompts.id, id))
    .returning();

  if (!updated) {
    return Response.json({ error: "Prompt not found" }, { status: 404 });
  }

  return Response.json(updated);
}

export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) {
    return Response.json({ error: "ID is required" }, { status: 400 });
  }

  try {
    // Get all responses for this prompt
    const promptResponses = await db
      .select({ id: responses.id })
      .from(responses)
      .where(eq(responses.promptId, id));

    if (promptResponses.length > 0) {
      const responseIds = promptResponses.map((r) => r.id);

      // Get all analyses for these responses
      const responseAnalyses = await db
        .select({ id: analyses.id })
        .from(analyses)
        .where(inArray(analyses.responseId, responseIds));

      if (responseAnalyses.length > 0) {
        const analysisIds = responseAnalyses.map((a) => a.id);

        // Delete brand mentions and links for these analyses
        await db
          .delete(brandMentions)
          .where(inArray(brandMentions.analysisId, analysisIds));
        await db
          .delete(brandLinks)
          .where(inArray(brandLinks.analysisId, analysisIds));

        // Delete analyses
        await db.delete(analyses).where(inArray(analyses.id, analysisIds));
      }

      // Delete responses
      await db.delete(responses).where(inArray(responses.id, responseIds));
    }

    // Finally delete the prompt
    const [deleted] = await db
      .delete(prompts)
      .where(eq(prompts.id, id))
      .returning();

    if (!deleted) {
      return Response.json({ error: "Prompt not found" }, { status: 404 });
    }

    revalidatePath("/prompts");
    return Response.json({ success: true });
  } catch (error) {
    console.error("Failed to delete prompt:", error);
    return Response.json({ error: "Failed to delete prompt" }, { status: 500 });
  }
}
