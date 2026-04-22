/**
 * Script to clean up duplicate responses (same prompt/provider on same day)
 * Keeps only the latest response per prompt/provider/day
 *
 * Run with: DATABASE_URL=... npx tsx src/db/cleanup-duplicates.ts
 */

import { eq, inArray, sql } from "drizzle-orm";
import { db } from "./index";
import { analyses, brandLinks, brandMentions, responses } from "./schema";

async function cleanupDuplicates() {
  console.log("Finding duplicate responses...\n");

  // Find all responses grouped by prompt_id, provider_id, and date
  // Keep only the latest one (max created_at) for each group
  const duplicates = await db.execute(sql`
    WITH ranked AS (
      SELECT 
        id,
        prompt_id,
        provider_id,
        DATE(created_at) as response_date,
        created_at,
        ROW_NUMBER() OVER (
          PARTITION BY prompt_id, provider_id, DATE(created_at) 
          ORDER BY created_at DESC
        ) as rn
      FROM responses
    )
    SELECT id, prompt_id, provider_id, response_date, created_at
    FROM ranked
    WHERE rn > 1
    ORDER BY response_date, prompt_id, provider_id
  `);

  // Handle both array result and { rows: [] } format
  interface DuplicateRow {
    id: string;
    prompt_id: string;
    provider_id: string;
    response_date: string;
    created_at: string;
  }
  const result = duplicates as unknown as
    | DuplicateRow[]
    | { rows: DuplicateRow[] };
  const rows = Array.isArray(result) ? result : result.rows || [];
  const duplicateIds = rows.map((r) => r.id);

  if (duplicateIds.length === 0) {
    console.log("No duplicates found!");
    return;
  }

  console.log(`Found ${duplicateIds.length} duplicate responses to remove:\n`);

  // Group by date for display
  const byDate = new Map<string, number>();
  for (const row of rows) {
    const date = row.response_date;
    byDate.set(date, (byDate.get(date) || 0) + 1);
  }

  for (const [date, count] of byDate) {
    console.log(`  ${date}: ${count} duplicates`);
  }

  console.log("\nDeleting associated data...");

  // First, find analyses linked to these responses
  const linkedAnalyses = await db
    .select({ id: analyses.id })
    .from(analyses)
    .where(inArray(analyses.responseId, duplicateIds));

  const analysisIds = linkedAnalyses.map((a) => a.id);

  if (analysisIds.length > 0) {
    // Delete brand mentions linked to these analyses
    await db
      .delete(brandMentions)
      .where(inArray(brandMentions.analysisId, analysisIds));
    console.log(`  Deleted brand mentions for ${analysisIds.length} analyses`);

    // Delete brand links linked to these analyses (if table exists)
    try {
      await db
        .delete(brandLinks)
        .where(inArray(brandLinks.analysisId, analysisIds));
      console.log(`  Deleted brand links for ${analysisIds.length} analyses`);
    } catch (e: unknown) {
      const error = e as { code?: string };
      if (error.code === "42P01") {
        console.log("  (brand_links table not found, skipping)");
      } else {
        throw e;
      }
    }

    // Delete the analyses
    await db.delete(analyses).where(inArray(analyses.id, analysisIds));
    console.log(`  Deleted ${analysisIds.length} analyses`);
  }

  // Finally, delete the duplicate responses
  await db.delete(responses).where(inArray(responses.id, duplicateIds));
  console.log(`  Deleted ${duplicateIds.length} duplicate responses`);

  console.log("\nCleanup complete!");
}

cleanupDuplicates()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Error:", err);
    process.exit(1);
  });
