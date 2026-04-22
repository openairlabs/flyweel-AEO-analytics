"use client";

import { WorkflowVisualizer } from "workflow-visualizer";
import { citationsTrackerWorkflow } from "@/components/workflows/workflowConfig";

export default function WorkflowsPage() {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white mb-2">
          {citationsTrackerWorkflow.title}
        </h1>
        <p className="text-[#888]">{citationsTrackerWorkflow.subtitle}</p>
      </div>

      {/* Introduction */}
      <div className="bg-[#111] border border-[#222] p-6 space-y-4">
        <h2 className="text-lg font-medium text-white">
          What are Render Workflows?
        </h2>
        <p className="text-[#888] text-sm leading-relaxed">
          Render Workflows let you run background tasks that can be triggered by
          cron schedules, API calls, or manual actions. Tasks can coordinate
          with each other, run in parallel with concurrency limits, and handle
          retries automatically.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
          <div className="border border-[#222] p-4">
            <div className="text-white font-mono text-sm mb-2">Triggers</div>
            <p className="text-[#666] text-xs">
              Cron schedules, API calls, or manual button clicks can start a
              workflow.
            </p>
          </div>
          <div className="border border-[#222] p-4">
            <div className="text-white font-mono text-sm mb-2">Tasks</div>
            <p className="text-[#666] text-xs">
              Individual units of work with configurable timeouts, retries, and
              error handling.
            </p>
          </div>
          <div className="border border-[#222] p-4">
            <div className="text-white font-mono text-sm mb-2">
              Orchestration
            </div>
            <p className="text-[#666] text-xs">
              Tasks can spawn other tasks, run in sequence, or execute in
              parallel with limits.
            </p>
          </div>
        </div>
      </div>

      {/* Visualizer */}
      <div>
        <h2 className="text-lg font-medium text-white mb-4">
          How This App Uses Workflows
        </h2>
        <p className="text-[#888] text-sm mb-6">
          Watch how the daily job orchestrates the entire pipeline: pinging
          LLMs, analyzing responses, and generating digests. Use the controls to
          step through each phase.
        </p>
        <WorkflowVisualizer
          config={citationsTrackerWorkflow}
          defaultSelectedNode="cron" // Shows detail panel for this node on load
        />
      </div>

      {/* Technical details */}
      <div className="bg-[#111] border border-[#222] p-6 space-y-4">
        <h2 className="text-lg font-medium text-white">Under the Hood</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
          <div>
            <h3 className="text-white font-mono mb-2">Triggering Tasks</h3>
            <p className="text-[#666] mb-2">
              Tasks are triggered via the Render API:
            </p>
            <pre className="bg-black p-3 text-xs text-[#888] overflow-x-auto">
              {`POST https://api.render.com/v1/task-runs
{
  "task": "workflow-slug/task-name",
  "input": { ... }
}`}
            </pre>
          </div>
          <div>
            <h3 className="text-white font-mono mb-2">Concurrency Control</h3>
            <p className="text-[#666] mb-2">
              Batch tasks use semaphores to limit parallel execution:
            </p>
            <pre className="bg-black p-3 text-xs text-[#888] overflow-x-auto">
              {`const CONCURRENCY = 10;
const sema = new Sema(CONCURRENCY);

await Promise.all(items.map(async (item) => {
  await sema.acquire();
  try {
    await processItem(item);
  } finally {
    sema.release();
  }
}));`}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}
