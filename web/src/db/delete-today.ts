/**
 * Delete today's responses (and related analyses/mentions/links)
 * Run with: DATABASE_URL=... npx tsx src/db/delete-today.ts
 */

import { gte, inArray } from "drizzle-orm";
import { db } from "./index";
import { analyses, brandLinks, brandMentions, responses } from "./schema";

async function deleteToday() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  console.log("Finding today's responses...");

  // Get today's responses
  const todayResponses = await db
    .select({ id: responses.id })
    .from(responses)
    .where(gte(responses.createdAt, today));

  console.log(`Found ${todayResponses.length} responses from today`);

  if (todayResponses.length === 0) {
    console.log("Nothing to delete");
    return;
  }

  const responseIds = todayResponses.map((r) => r.id);

  // Get analyses for these responses
  const todayAnalyses = await db
    .select({ id: analyses.id })
    .from(analyses)
    .where(inArray(analyses.responseId, responseIds));

  console.log(`Found ${todayAnalyses.length} analyses`);

  if (todayAnalyses.length > 0) {
    const analysisIds = todayAnalyses.map((a) => a.id);

    // Delete brand mentions
    await db
      .delete(brandMentions)
      .where(inArray(brandMentions.analysisId, analysisIds));
    console.log("Deleted brand mentions");

    // Delete brand links
    await db
      .delete(brandLinks)
      .where(inArray(brandLinks.analysisId, analysisIds));
    console.log("Deleted brand links");

    // Delete analyses
    await db.delete(analyses).where(inArray(analyses.id, analysisIds));
    console.log("Deleted analyses");
  }

  // Delete responses
  await db.delete(responses).where(inArray(responses.id, responseIds));
  console.log(`Deleted ${responseIds.length} responses`);

  console.log("Done!");
}

deleteToday()
  .catch(console.error)
  .finally(() => process.exit());
