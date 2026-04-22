import { DeleteButton } from "@/components/actions/DeleteButton";
import { ToggleActiveButton } from "@/components/actions/ToggleActiveButton";
import { CreateForm } from "@/components/forms/CreateForm";
import { EditButton } from "@/components/forms/EditButton";
import { ProviderForm } from "@/components/forms/ProviderForm";
import { CollapsibleSection } from "@/components/ui/CollapsibleSection";
import { DemoTooltip } from "@/components/ui/DemoTooltip";
import { ModalButton } from "@/components/ui/ModalButton";
import { db } from "@/db";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const [allProviders, allIndustries, allBrands] = await Promise.all([
    db.query.providers.findMany({
      orderBy: (providers, { asc }) => [asc(providers.name)],
    }),
    db.query.industries.findMany({
      orderBy: (industries, { asc }) => [asc(industries.name)],
      with: { brands: true },
    }),
    db.query.brands.findMany({
      orderBy: (brands, { asc }) => [asc(brands.name)],
      with: { industry: true },
    }),
  ]);

  const industryOptions = [
    { value: "", label: "No industry" },
    ...allIndustries.map((ind) => ({ value: ind.id, label: ind.name })),
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold mb-2">Settings</h1>
      <p className="text-[#888] mb-8">
        Configure providers, industries, and brands.
      </p>

      <div className="space-y-4">
        {/* Providers Section */}
        <CollapsibleSection
          title="Providers"
          count={allProviders.length}
          defaultOpen
          actions={
            <DemoTooltip>
              <ModalButton label="Add Provider" title="Add Provider">
                <ProviderForm existingModels={allProviders.map((p) => p.model)} />
              </ModalButton>
            </DemoTooltip>
          }
        >
          {allProviders.length === 0 ? (
            <div className="p-8 text-center text-[#666]">No providers yet.</div>
          ) : (
            <div className="divide-y divide-[#222]">
              {allProviders.map((provider) => (
                <div key={provider.id} className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-medium capitalize">
                        {provider.name}
                      </span>
                      <p className="text-sm text-[#666]">{provider.model}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <DemoTooltip>
                        <ToggleActiveButton
                          endpoint="/api/providers"
                          id={provider.id}
                          isActive={provider.isActive ?? true}
                        />
                      </DemoTooltip>
                      <DemoTooltip>
                        <DeleteButton
                          endpoint="/api/providers"
                          id={provider.id}
                        />
                      </DemoTooltip>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CollapsibleSection>

        {/* Industries Section */}
        <CollapsibleSection
          title="Industries"
          count={allIndustries.length}
          actions={
            <DemoTooltip>
              <ModalButton label="Add Industry" title="Add Industry">
                <CreateForm
                  endpoint="/api/industries"
                  submitLabel="Add"
                  fields={[
                    {
                      name: "name",
                      label: "Name",
                      type: "text",
                      required: true,
                      placeholder: "e.g., Cloud PaaS",
                    },
                    {
                      name: "description",
                      label: "Description",
                      type: "textarea",
                      placeholder: "Platform as a Service providers",
                    },
                  ]}
                />
              </ModalButton>
            </DemoTooltip>
          }
        >
          {allIndustries.length === 0 ? (
            <div className="p-8 text-center text-[#666]">
              No industries yet.
            </div>
          ) : (
            <div className="divide-y divide-[#222]">
              {allIndustries.map((industry) => (
                <div key={industry.id} className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-medium">{industry.name}</span>
                      {industry.description && (
                        <p className="text-sm text-[#666]">
                          {industry.description}
                        </p>
                      )}
                      <p className="text-xs text-[#444] mt-1">
                        {industry.brands.length} brands
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <DemoTooltip>
                        <ToggleActiveButton
                          endpoint="/api/industries"
                          id={industry.id}
                          isActive={industry.isActive ?? true}
                        />
                      </DemoTooltip>
                      <DemoTooltip>
                        <EditButton
                          endpoint="/api/industries"
                          id={industry.id}
                          title="Edit Industry"
                          fields={[
                            {
                              name: "name",
                              label: "Name",
                              type: "text",
                              required: true,
                            },
                            {
                              name: "description",
                              label: "Description",
                              type: "text",
                            },
                          ]}
                          initialValues={{
                            name: industry.name,
                            description: industry.description || "",
                          }}
                        />
                      </DemoTooltip>
                      <DemoTooltip>
                        <DeleteButton
                          endpoint="/api/industries"
                          id={industry.id}
                        />
                      </DemoTooltip>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CollapsibleSection>

        {/* Brands Section */}
        <CollapsibleSection
          title="Brands"
          count={allBrands.length}
          actions={
            <DemoTooltip>
              <ModalButton label="Add Brand" title="Add Brand">
                <CreateForm
                  endpoint="/api/brands"
                  submitLabel="Add"
                  fields={[
                    {
                      name: "name",
                      label: "Name",
                      type: "text",
                      required: true,
                      placeholder: "e.g., Render",
                    },
                    {
                      name: "industryId",
                      label: "Industry",
                      type: "select",
                      options: industryOptions.slice(1),
                    },
                    {
                      name: "aliases",
                      label: "Aliases",
                      type: "text",
                      placeholder: "render.com, Render.com",
                      hint: "Comma-separated",
                      transformType: "comma-list",
                    },
                    {
                      name: "isOwnBrand",
                      label: "This is my brand",
                      type: "checkbox",
                    },
                  ]}
                />
              </ModalButton>
            </DemoTooltip>
          }
        >
          {allBrands.length === 0 ? (
            <div className="p-8 text-center text-[#666]">No brands yet.</div>
          ) : (
            <div className="divide-y divide-[#222]">
              {allBrands.map((brand) => (
                <div
                  key={brand.id}
                  className={`p-4 ${brand.isOwnBrand ? "bg-[#1a1a1a]" : ""}`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-medium">{brand.name}</span>
                      {brand.isOwnBrand && (
                        <span className="ml-2 text-xs border border-white px-1">
                          YOU
                        </span>
                      )}
                      {brand.industry && (
                        <p className="text-sm text-[#666]">
                          {brand.industry.name}
                        </p>
                      )}
                      {brand.aliases && brand.aliases.length > 0 && (
                        <p className="text-xs text-[#444] mt-1">
                          {brand.aliases.join(", ")}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <DemoTooltip>
                        <ToggleActiveButton
                          endpoint="/api/brands"
                          id={brand.id}
                          isActive={brand.isActive ?? true}
                        />
                      </DemoTooltip>
                      <DemoTooltip>
                        <EditButton
                          endpoint="/api/brands"
                          id={brand.id}
                          title="Edit Brand"
                          fields={[
                            {
                              name: "name",
                              label: "Name",
                              type: "text",
                              required: true,
                            },
                            {
                              name: "aliases",
                              label: "Aliases (comma separated)",
                              type: "text",
                            },
                            {
                              name: "industryId",
                              label: "Industry",
                              type: "select",
                              options: industryOptions,
                            },
                            {
                              name: "isOwnBrand",
                              label: "Own Brand",
                              type: "checkbox",
                            },
                          ]}
                          initialValues={{
                            name: brand.name,
                            aliases: brand.aliases?.join(", ") || "",
                            industryId: brand.industryId || "",
                            isOwnBrand: brand.isOwnBrand ?? false,
                          }}
                        />
                      </DemoTooltip>
                      <DemoTooltip>
                        <DeleteButton endpoint="/api/brands" id={brand.id} />
                      </DemoTooltip>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CollapsibleSection>
      </div>
    </div>
  );
}
