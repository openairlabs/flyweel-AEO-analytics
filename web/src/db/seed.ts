import { createId } from "@paralleldrive/cuid2";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { PROVIDER_MODELS } from "../lib/models";
import { providers } from "./schema";

const connectionString = process.env.DATABASE_URL!;
const client = postgres(connectionString);
const db = drizzle(client);

async function seed() {
  console.log("🌱 Seeding database...");

  // Seed providers from shared model definitions
  for (const [name, models] of Object.entries(PROVIDER_MODELS)) {
    for (const model of models) {
      await db
        .insert(providers)
        .values({ id: createId(), name, model })
        .onConflictDoNothing({ target: providers.model });
    }
  }

  // Fetch actual providers from DB (in case they already existed)
  const allProviders = await db.select().from(providers);
  console.log(`✅ Providers seeded (${allProviders.length} total)`);

  console.log("🎉 Seeding complete!");
  process.exit(0);
}

seed().catch((err) => {
  console.error("❌ Seeding failed:", err);
  process.exit(1);
});
