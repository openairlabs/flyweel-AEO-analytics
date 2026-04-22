import { createId } from "@paralleldrive/cuid2";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { PROVIDER_MODELS } from "../lib/models";
import { brands, industries, prompts, providers } from "./schema";

const connectionString = process.env.DATABASE_URL!;
const client = postgres(connectionString);
const db = drizzle(client);

// Sample prompts for developer tools industry (Feb 2026)
const samplePrompts = [
  {
    name: "Best issue tracker 2026",
    content:
      "What is the best issue tracking tool for a software engineering team in 2026?",
  },
  {
    name: "Code hosting options",
    content:
      "What are the best code hosting and repository management platforms available in 2026?",
  },
  {
    name: "Modern Jira alternatives",
    content:
      "What's the best modern alternative to Jira for agile project management in 2026?",
  },
  {
    name: "Documentation tools",
    content:
      "What tools do engineering teams currently use for internal documentation and knowledge bases?",
  },
  {
    name: "Git hosting for startups",
    content:
      "Which git hosting platform should a startup choose this year?",
  },
  {
    name: "Latest project management",
    content:
      "What are the latest and most popular project management tools for software teams?",
  },
  {
    name: "Best dev tools 2026",
    content:
      "What are the must-have developer tools and platforms in 2026?",
  },
  {
    name: "Issue tracking comparison",
    content:
      "Can you compare the top issue tracking tools available today? Include pricing and features.",
  },
  {
    name: "Startup tooling stack",
    content:
      "What's the recommended tooling stack for a new startup's engineering team right now?",
  },
  {
    name: "Code hosting trends",
    content:
      "What are the current trends in code hosting and version control platforms?",
  },
];

async function seed() {
  console.log("🌱 Seeding database (dev mode - configuration only)...");

  // Seed providers from shared model definitions
  for (const [name, models] of Object.entries(PROVIDER_MODELS)) {
    for (const model of models) {
      await db
        .insert(providers)
        .values({ id: createId(), name, model })
        .onConflictDoNothing({ target: providers.model });
    }
  }
  console.log("✅ Providers seeded");

  // Fetch actual providers from DB
  const allProviders = await db.select().from(providers);
  console.log(`   Found ${allProviders.length} providers`);

  // Seed industry
  const industryId = createId();
  await db
    .insert(industries)
    .values({
      id: industryId,
      name: "Developer Tools",
      description: "Tools and platforms for software development workflows",
    })
    .onConflictDoNothing({ target: industries.name });
  console.log("✅ Industry seeded");

  // Fetch actual industry
  const [industry] = await db.select().from(industries).limit(1);
  const actualIndustryId = industry?.id || industryId;

  // Seed brands
  const brandData = [
    {
      name: "SprintHub",
      aliases: ["sprinthub.io", "SprintHub.io"],
      domains: ["sprinthub.io"],
      isOwnBrand: true,
    },
    {
      name: "GitHub",
      aliases: ["github.com", "GitHub.com"],
      domains: ["github.com", "docs.github.com"],
      isOwnBrand: false,
    },
    {
      name: "GitLab",
      aliases: ["gitlab.com", "GitLab.com"],
      domains: ["gitlab.com", "docs.gitlab.com"],
      isOwnBrand: false,
    },
    {
      name: "Linear",
      aliases: ["linear.app", "Linear.app"],
      domains: ["linear.app"],
      isOwnBrand: false,
    },
    {
      name: "Jira",
      aliases: ["jira.atlassian.com", "Jira"],
      domains: ["atlassian.com/software/jira", "jira.atlassian.com"],
      isOwnBrand: false,
    },
    {
      name: "Notion",
      aliases: ["notion.so", "Notion.so"],
      domains: ["notion.so"],
      isOwnBrand: false,
    },
    {
      name: "Bitbucket",
      aliases: ["bitbucket.org", "Bitbucket.org"],
      domains: ["bitbucket.org"],
      isOwnBrand: false,
    },
  ];

  // Check existing brands first to avoid duplicates
  const existingBrands = await db.select().from(brands);
  const existingBrandNames = new Set(existingBrands.map((b) => b.name));

  for (const brand of brandData) {
    if (!existingBrandNames.has(brand.name)) {
      await db
        .insert(brands)
        .values({ id: createId(), ...brand, industryId: actualIndustryId });
    }
  }
  console.log("✅ Brands seeded");

  // Fetch actual brands
  const allBrands = await db.select().from(brands);
  console.log(`   Found ${allBrands.length} brands`);

  // Seed prompts
  for (const prompt of samplePrompts) {
    await db
      .insert(prompts)
      .values({ id: createId(), ...prompt, industryId: actualIndustryId })
      .onConflictDoNothing();
  }
  console.log("✅ Prompts seeded");

  // Fetch actual prompts
  const allPrompts = await db.select().from(prompts);
  console.log(`   Found ${allPrompts.length} prompts`);

  console.log("🎉 Seeding complete!");
  console.log("");
  console.log("ℹ️  Run the workflows to generate real LLM responses and analyses.");
  process.exit(0);
}

seed().catch((err) => {
  console.error("❌ Seeding failed:", err);
  process.exit(1);
});
