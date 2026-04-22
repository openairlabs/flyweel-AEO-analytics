import { db } from "@/db";
import { analyses, brandMentions, providers, responses } from "@/db/schema";
import { eq, inArray } from "drizzle-orm";

export async function GET() {
  const allProviders = await db.query.providers.findMany({
    orderBy: (providers, { asc }) => [asc(providers.name)],
  });
  return Response.json(allProviders);
}

export async function POST(req: Request) {
  const body = await req.json();
  const { name, model } = body;

  if (!name || !model) {
    return Response.json(
      { error: "Name and model are required" },
      { status: 400 },
    );
  }

  // Check if model already exists
  const existing = await db.query.providers.findFirst({
    where: eq(providers.model, model),
  });

  if (existing) {
    return Response.json({ error: "Model already exists" }, { status: 409 });
  }

  const [provider] = await db
    .insert(providers)
    .values({ name, model })
    .returning();

  return Response.json(provider, { status: 201 });
}

export async function PUT(req: Request) {
  const body = await req.json();
  const { id, name, model, isActive } = body;

  if (!id) {
    return Response.json({ error: "ID is required" }, { status: 400 });
  }

  const [updated] = await db
    .update(providers)
    .set({ name, model, isActive })
    .where(eq(providers.id, id))
    .returning();

  if (!updated) {
    return Response.json({ error: "Provider not found" }, { status: 404 });
  }

  return Response.json(updated);
}

export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) {
    return Response.json({ error: "ID is required" }, { status: 400 });
  }

  // Get all responses for this provider
  const providerResponses = await db.query.responses.findMany({
    where: eq(responses.providerId, id),
    columns: { id: true },
  });

  const responseIds = providerResponses.map((r) => r.id);

  if (responseIds.length > 0) {
    // Get all analyses for these responses
    const responseAnalyses = await db.query.analyses.findMany({
      where: inArray(analyses.responseId, responseIds),
      columns: { id: true },
    });

    const analysisIds = responseAnalyses.map((a) => a.id);

    // Delete brand mentions for these analyses
    if (analysisIds.length > 0) {
      await db
        .delete(brandMentions)
        .where(inArray(brandMentions.analysisId, analysisIds));
    }

    // Delete analyses
    if (analysisIds.length > 0) {
      await db.delete(analyses).where(inArray(analyses.id, analysisIds));
    }

    // Delete responses
    await db.delete(responses).where(inArray(responses.id, responseIds));
  }

  // Finally delete the provider
  const [deleted] = await db
    .delete(providers)
    .where(eq(providers.id, id))
    .returning();

  if (!deleted) {
    return Response.json({ error: "Provider not found" }, { status: 404 });
  }

  return Response.json({
    success: true,
    deleted: {
      responses: responseIds.length,
    },
  });
}
