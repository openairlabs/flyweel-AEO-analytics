import { db } from "@/db";
import { prompts } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const prompt = await db.query.prompts.findFirst({
    where: eq(prompts.id, id),
    with: {
      industry: true,
      responses: {
        orderBy: (responses, { desc }) => [desc(responses.createdAt)],
        with: {
          provider: true,
          analysis: {
            with: {
              mentions: {
                with: {
                  brand: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!prompt) {
    return Response.json({ error: "Prompt not found" }, { status: 404 });
  }

  return Response.json(prompt);
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await req.json();
  const { name, content, industryId, isActive } = body;

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

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const [deleted] = await db
    .delete(prompts)
    .where(eq(prompts.id, id))
    .returning();

  if (!deleted) {
    return Response.json({ error: "Prompt not found" }, { status: 404 });
  }

  return Response.json({ success: true });
}
