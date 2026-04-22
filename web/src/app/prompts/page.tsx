import { AnalyzeAllButton } from "@/components/actions/AnalyzeAllButton";
import { DeleteButton } from "@/components/actions/DeleteButton";
import { PingAllButton } from "@/components/actions/PingAllButton";
import { PingButton } from "@/components/actions/PingButton";
import { ToggleActiveButton } from "@/components/actions/ToggleActiveButton";
import { CreateForm } from "@/components/forms/CreateForm";
import { EditButton } from "@/components/forms/EditButton";
import { DemoTooltip } from "@/components/ui/DemoTooltip";
import { ModalButton } from "@/components/ui/ModalButton";
import { db } from "@/db";
import { prompts } from "@/db/schema";
import { desc } from "drizzle-orm";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function PromptsPage() {
  const allPrompts = await db.query.prompts.findMany({
    orderBy: [desc(prompts.createdAt)],
    with: {
      industry: true,
      responses: true,
    },
  });

  const industries = await db.query.industries.findMany();

  const industryOptions = [
    { value: "", label: "No industry" },
    ...industries.map((ind) => ({ value: ind.id, label: ind.name })),
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold mb-2">Prompts</h1>
          <p className="text-[#888]">
            Manage prompts to send to LLM providers.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <DemoTooltip>
            <ModalButton label="New Prompt" title="New Prompt">
              <CreateForm
                endpoint="/api/prompts"
                submitLabel="Create"
                fields={[
                  {
                    name: "name",
                    label: "Name",
                    type: "text",
                    required: true,
                    placeholder: "e.g., Best PaaS for Node.js",
                  },
                  {
                    name: "content",
                    label: "Prompt",
                    type: "textarea",
                    required: true,
                    placeholder:
                      "What is the best platform to deploy a Node.js application?",
                  },
                  {
                    name: "industryId",
                    label: "Industry",
                    type: "select",
                    options: industries.map((i) => ({
                      value: i.id,
                      label: i.name,
                    })),
                  },
                ]}
              />
            </ModalButton>
          </DemoTooltip>
          <DemoTooltip>
            <PingAllButton />
          </DemoTooltip>
          <DemoTooltip>
            <AnalyzeAllButton />
          </DemoTooltip>
        </div>
      </div>

      <div className="bg-[#111] border border-[#222]">
        {allPrompts.length === 0 ? (
          <div className="p-8 text-center text-[#666]">No prompts yet.</div>
        ) : (
          <div className="divide-y divide-[#222]">
            {allPrompts.map((prompt) => (
              <div
                key={prompt.id}
                className="p-4 hover:bg-[#1a1a1a] transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <Link
                      href={`/prompts/${prompt.id}`}
                      className="font-medium text-white hover:underline"
                    >
                      {prompt.name}
                    </Link>
                    <p className="text-sm text-[#666] mt-1 line-clamp-2">
                      {prompt.content}
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      {prompt.industry && (
                        <span className="text-xs border border-[#333] text-[#888] px-2 py-0.5">
                          {prompt.industry.name}
                        </span>
                      )}
                      <span className="text-xs text-[#666]">
                        {prompt.responses.length} responses
                      </span>
                      <DemoTooltip>
                        <ToggleActiveButton
                          endpoint="/api/prompts"
                          id={prompt.id}
                          isActive={prompt.isActive ?? true}
                        />
                      </DemoTooltip>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <DemoTooltip>
                      <PingButton promptId={prompt.id} />
                    </DemoTooltip>
                    <DemoTooltip>
                      <EditButton
                        endpoint="/api/prompts"
                        id={prompt.id}
                        title="Edit Prompt"
                        fields={[
                          {
                            name: "name",
                            label: "Name",
                            type: "text",
                            required: true,
                          },
                          {
                            name: "content",
                            label: "Content",
                            type: "textarea",
                            required: true,
                          },
                          {
                            name: "industryId",
                            label: "Industry",
                            type: "select",
                            options: industryOptions,
                          },
                        ]}
                        initialValues={{
                          name: prompt.name,
                          content: prompt.content,
                          industryId: prompt.industryId || "",
                        }}
                      />
                    </DemoTooltip>
                    <DemoTooltip>
                      <DeleteButton endpoint="/api/prompts" id={prompt.id} />
                    </DemoTooltip>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
