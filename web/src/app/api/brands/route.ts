import { db } from "@/db";
import { brands } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET() {
  const allBrands = await db.query.brands.findMany({
    orderBy: (brands, { asc }) => [asc(brands.name)],
    with: {
      industry: true,
    },
  });
  return Response.json(allBrands);
}

export async function POST(req: Request) {
  const body = await req.json();
  const { name, aliases, industryId, isOwnBrand } = body;

  if (!name) {
    return Response.json({ error: "Name is required" }, { status: 400 });
  }

  const [brand] = await db
    .insert(brands)
    .values({ name, aliases, industryId, isOwnBrand })
    .returning();

  return Response.json(brand, { status: 201 });
}

export async function PUT(req: Request) {
  const body = await req.json();
  const { id, name, aliases, industryId, isOwnBrand, isActive } = body;

  if (!id) {
    return Response.json({ error: "ID is required" }, { status: 400 });
  }

  // Handle aliases as comma-separated string or array
  const aliasArray =
    typeof aliases === "string"
      ? aliases
          .split(",")
          .map((a: string) => a.trim())
          .filter(Boolean)
      : aliases;

  const [updated] = await db
    .update(brands)
    .set({
      name,
      aliases: aliasArray?.length > 0 ? aliasArray : null,
      industryId: industryId || null,
      isOwnBrand,
      isActive,
    })
    .where(eq(brands.id, id))
    .returning();

  if (!updated) {
    return Response.json({ error: "Brand not found" }, { status: 404 });
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
    .delete(brands)
    .where(eq(brands.id, id))
    .returning();

  if (!deleted) {
    return Response.json({ error: "Brand not found" }, { status: 404 });
  }

  return Response.json({ success: true });
}
