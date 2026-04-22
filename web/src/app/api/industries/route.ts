import { db } from "@/db";
import { industries } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET() {
  const allIndustries = await db.query.industries.findMany({
    orderBy: (industries, { asc }) => [asc(industries.name)],
    with: {
      brands: true,
    },
  });
  return Response.json(allIndustries);
}

export async function POST(req: Request) {
  const body = await req.json();
  const { name, description } = body;

  if (!name) {
    return Response.json({ error: "Name is required" }, { status: 400 });
  }

  const [industry] = await db
    .insert(industries)
    .values({ name, description })
    .returning();

  return Response.json(industry, { status: 201 });
}

export async function PUT(req: Request) {
  const body = await req.json();
  const { id, name, description, isActive } = body;

  if (!id) {
    return Response.json({ error: "ID is required" }, { status: 400 });
  }

  const [updated] = await db
    .update(industries)
    .set({ name, description, isActive })
    .where(eq(industries.id, id))
    .returning();

  if (!updated) {
    return Response.json({ error: "Industry not found" }, { status: 404 });
  }

  return Response.json(updated);
}

export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) {
    return Response.json({ error: "ID is required" }, { status: 400 });
  }

  const [deleted] = await db
    .delete(industries)
    .where(eq(industries.id, id))
    .returning();

  if (!deleted) {
    return Response.json({ error: "Industry not found" }, { status: 404 });
  }

  return Response.json({ success: true });
}
