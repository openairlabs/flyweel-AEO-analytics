import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.js";

const connectionString = process.env.DATABASE_URL!;

// Render Postgres requires SSL
const queryClient = postgres(connectionString, {
  ssl: "require",
});
export const db = drizzle(queryClient, { schema });
