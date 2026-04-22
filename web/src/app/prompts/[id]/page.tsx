import { ResponsesList } from "@/components/ResponsesList";
import { PingButton } from "@/components/actions/PingButton";
import { ToggleActiveButton } from "@/components/actions/ToggleActiveButton";
import { DemoTooltip } from "@/components/ui/DemoTooltip";
import { db } from "@/db";
import { prompts } from "@/db/schema";
import { eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function PromptDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
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
    notFound();
  }

  return (
    <div>
      <div className="mb-6">
        <Link href="/prompts" className="text-sm text-[#666] hover:text-white">
          ← Back
        </Link>
      </div>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">{prompt.name}</h1>
          <div className="flex items-center gap-2 mt-2">
            {prompt.industry && (
              <span className="text-xs border border-[#333] text-[#888] px-2 py-0.5">
                {prompt.industry.name}
              </span>
            )}
            <DemoTooltip>
              <ToggleActiveButton
                endpoint="/api/prompts"
                id={prompt.id}
                isActive={prompt.isActive ?? true}
              />
            </DemoTooltip>
          </div>
        </div>
        <DemoTooltip>
          <PingButton promptId={prompt.id} />
        </DemoTooltip>
      </div>

      <div className="bg-[#111] border border-[#222] p-6 mb-8">
        <p className="text-xs text-[#666] uppercase tracking-wider mb-2">
          Prompt
        </p>
        <p className="text-[#ccc] whitespace-pre-wrap">{prompt.content}</p>
      </div>

      <h2 className="text-sm font-medium text-[#888] uppercase tracking-wider mb-4">
        Responses ({prompt.responses.length})
      </h2>

      {prompt.responses.length === 0 ? (
        <div className="bg-[#111] border border-[#222] p-8 text-center text-[#666]">
          No responses yet.
        </div>
      ) : (
        <ResponsesList
          responses={prompt.responses.map((r) => ({
            id: r.id,
            content: r.content,
            latencyMs: r.latencyMs,
            webSearchUsed: r.webSearchUsed,
            createdAt: r.createdAt,
            provider: r.provider,
            analysis: r.analysis,
          }))}
        />
      )}
    </div>
  );
}
