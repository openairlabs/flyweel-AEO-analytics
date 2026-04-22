#!/usr/bin/env node

/**
 * Cron job that triggers the daily-job workflow task.
 *
 * This calls the Render Workflows API directly to run the daily-job task,
 * which handles: ping all -> analyze all -> generate digest
 */

const RENDER_API_KEY = process.env.RENDER_API_KEY;
const RENDER_WORKFLOW_SLUG = process.env.RENDER_WORKFLOW_SLUG;

if (!RENDER_API_KEY || !RENDER_WORKFLOW_SLUG) {
  console.error(
    "Missing RENDER_API_KEY or RENDER_WORKFLOW_SLUG environment variables",
  );
  process.exit(1);
}

async function run() {
  console.log(`[${new Date().toISOString()}] Cron job started`);
  console.log(
    `[${new Date().toISOString()}] Triggering daily-job workflow task...`,
  );

  const taskPath = `${RENDER_WORKFLOW_SLUG}/daily-job`;

  try {
    const response = await fetch(
      "https://api.render.com/v1/task-runs",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${RENDER_API_KEY}`,
        },
        body: JSON.stringify({
          task: taskPath,
          input: [],
        }),
      },
    );

    if (!response.ok) {
      const text = await response.text();
      console.error(
        `[${new Date().toISOString()}] Failed to trigger task: ${response.status} ${text}`,
      );
      process.exit(1);
    }

    const result = await response.json();
    console.log(`[${new Date().toISOString()}] Task triggered successfully`);
    console.log(`[${new Date().toISOString()}] Task run ID: ${result.id}`);
    console.log(`[${new Date().toISOString()}] Status: ${result.status}`);

    // Don't wait for completion - the workflow runs independently
    console.log(
      `[${new Date().toISOString()}] Cron job finished (task running in background)`,
    );
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error:`, error.message);
    process.exit(1);
  }
}

run();
