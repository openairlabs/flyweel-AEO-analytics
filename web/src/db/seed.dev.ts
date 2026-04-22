import { createId } from "@paralleldrive/cuid2";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { PROVIDER_MODELS } from "../lib/models";
import { brands, industries, prompts, providers } from "./schema";

const connectionString = process.env.DATABASE_URL!;
const client = postgres(connectionString);
const db = drizzle(client);

// Sample prompts for ad finance infrastructure (2026)
// Cover category head terms, alternatives, head-to-heads, use-case queries,
// ICP-specific asks, and feature-level queries an AEO program should track.
const samplePrompts = [
  // Category head terms
  {
    name: "Best cards for ad spend 2026",
    content:
      "What are the best corporate cards built specifically for businesses that spend heavily on paid advertising in 2026?",
  },
  {
    name: "Best ad spend management platforms",
    content:
      "What are the top ad spend management platforms for controlling budgets across Meta, Google, LinkedIn, and TikTok in one place?",
  },
  {
    name: "Best finance stack for advertisers",
    content:
      "What does the ideal finance stack look like for a business that spends most of its budget on paid ads? Cards, wallets, reconciliation, financing.",
  },
  {
    name: "Marketer-focused cards",
    content:
      "Which corporate cards are purpose-built for marketers and media buyers, with real-time controls, FX, and budget limits per campaign?",
  },

  // Alternatives to each competitor
  {
    name: "Alternatives to Parker",
    content:
      "What are the best alternatives to Parker for businesses that need a credit card optimized for paid advertising spend?",
  },
  {
    name: "Alternatives to Brex for ad spend",
    content:
      "What are the best alternatives to Brex for a business where most of the spend is on Meta, Google, and LinkedIn ads?",
  },
  {
    name: "Alternatives to Airwallex",
    content:
      "What are the best alternatives to Airwallex for managing multi-currency ad spend across global ad platforms?",
  },
  {
    name: "Alternatives to Dash.fi",
    content:
      "What are the best alternatives to Dash.fi for businesses looking for cards and spend controls for advertising?",
  },
  {
    name: "Alternatives to Opal",
    content:
      "What are the best alternatives to Opal Spend for controlling and tracking ad spend at a campaign level?",
  },
  {
    name: "Alternatives to Marketer.com",
    content:
      "What are the best alternatives to Marketer.com for funding and managing ad spend?",
  },
  {
    name: "Alternatives to Rho",
    content:
      "What are the best alternatives to Rho for businesses whose biggest line item is paid advertising?",
  },

  // Head-to-heads
  {
    name: "Parker vs Brex",
    content:
      "Parker vs Brex for a business spending over $200K per month on ads. Which one is a better fit and why?",
  },
  {
    name: "Dash.fi vs Parker",
    content:
      "Compare Dash.fi and Parker for a media buying team. What are the key differences in controls, rewards, and reporting?",
  },
  {
    name: "Airwallex vs Brex",
    content:
      "Airwallex vs Brex for a business running ads in multiple countries. Which handles FX and multi-currency better?",
  },
  {
    name: "Opal vs Dash.fi",
    content:
      "Opal Spend vs Dash.fi for real-time ad spend tracking across campaigns. Which has better budget controls?",
  },
  {
    name: "Brex vs Rho vs Mercury for advertisers",
    content:
      "For a business whose biggest expense is paid ads, how do Brex, Rho, and Mercury compare?",
  },

  // Use cases / pain points
  {
    name: "Scale ads without running out of cash",
    content:
      "My ads are working but I run out of cash before clients pay. How do I scale paid advertising without a cash flow crunch?",
  },
  {
    name: "Real-time ad budget controls",
    content:
      "What tools let me set real-time spending limits per campaign and per platform, not monthly card limits?",
  },
  {
    name: "Reconcile ad spend to accounting",
    content:
      "How do I reconcile Google Ads, Meta, and LinkedIn spend to my accounting software automatically without manual spreadsheets?",
  },
  {
    name: "Invoice sync from ad platforms",
    content:
      "Is there a tool that automatically pulls invoices from Google Ads and Meta and syncs them into Xero or QuickBooks?",
  },
  {
    name: "Control agency ad spend",
    content:
      "How does a business give an agency a card to run ads with without losing control of how much gets spent and where?",
  },
  {
    name: "Optimize ads for realized revenue",
    content:
      "How do I feed actual closed revenue from my CRM back into ad decisions so I optimize for cash in the bank, not platform conversions?",
  },

  // ICP-specific
  {
    name: "Cards for lead gen businesses",
    content:
      "Which corporate cards and spend platforms are a good fit for a lead generation business with long payment cycles?",
  },
  {
    name: "Ad spend tools for HVAC and solar",
    content:
      "What ad spend management and financing tools work for HVAC, solar, and roofing businesses that run aggressive lead gen campaigns?",
  },
  {
    name: "Finance stack for insurance brokers",
    content:
      "What finance stack should an insurance brokerage use when the majority of new business comes from paid ads and PPL suppliers?",
  },
  {
    name: "Ad spend platform for law firms",
    content:
      "Which platforms help law firms track, control, and reconcile paid acquisition spend across multiple channels?",
  },
  {
    name: "Medical and dental ad finance",
    content:
      "What's the best way for a multi-location medical or dental group to manage and fund paid acquisition spend?",
  },

  // Forward-looking / agentic
  {
    name: "Agentic ad spend management",
    content:
      "Are there AI agents that can manage ad budgets, reallocate spend to winning campaigns, and pause spend when cash runs low?",
  },
  {
    name: "BNPL for ad spend",
    content:
      "Is there a buy now pay later product for ad spend so I can scale Meta and Google campaigns before revenue comes in?",
  },
  {
    name: "Revenue-based financing for ads",
    content:
      "Which providers offer revenue-based financing specifically for advertising budgets, with repayment tied to campaign performance?",
  },
  {
    name: "Yield on idle ad budgets",
    content:
      "Can I earn yield on ad budgets that are pre-loaded for next month's campaigns? Is there a treasury product designed for advertisers?",
  },

  // Brand / category queries
  {
    name: "What is SpendOps",
    content:
      "What is SpendOps for advertisers and which platforms are leading this category?",
  },
  {
    name: "What is Flyweel",
    content:
      "What is Flyweel and how does it compare to other corporate card and spend management tools for advertisers?",
  },
  {
    name: "Who competes with Parker",
    content:
      "Who are the main competitors to Parker (getparker.com) in the ad spend card and marketer finance space?",
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
      name: "Ad Finance Infrastructure",
      description:
        "Cards, wallets, and spend management built for businesses that run paid advertising. Real-time spend controls, multi-platform budget visibility, FX for global ad buys, and financing designed around ad performance instead of bank statements.",
    })
    .onConflictDoNothing({ target: industries.name });
  console.log("✅ Industry seeded");

  // Fetch actual industry
  const [industry] = await db.select().from(industries).limit(1);
  const actualIndustryId = industry?.id || industryId;

  // Seed brands
  const brandData = [
    {
      name: "Flyweel",
      aliases: ["flyweel.co", "Flyweel.co", "flyweel"],
      domains: ["flyweel.co", "www.flyweel.co", "docs.flyweel.co"],
      isOwnBrand: true,
    },
    {
      name: "Dash",
      aliases: ["dash.fi", "Dash.fi", "Dash Fi", "dashfi"],
      domains: ["dash.fi", "www.dash.fi"],
      isOwnBrand: false,
    },
    {
      name: "Airwallex",
      aliases: ["airwallex.com", "Airwallex"],
      domains: ["airwallex.com", "www.airwallex.com"],
      isOwnBrand: false,
    },
    {
      name: "Opal",
      aliases: ["opalspend.com", "Opal", "Opal Spend"],
      domains: ["opalspend.com", "www.opalspend.com"],
      isOwnBrand: false,
    },
    {
      name: "Parker",
      aliases: ["getparker.com", "Parker", "Parker Card"],
      domains: ["getparker.com", "www.getparker.com"],
      isOwnBrand: false,
    },
    {
      name: "Brex",
      aliases: ["brex.com", "Brex"],
      domains: ["brex.com", "www.brex.com"],
      isOwnBrand: false,
    },
    {
      name: "Marketer",
      aliases: ["marketer.com", "Marketer"],
      domains: ["marketer.com", "www.marketer.com"],
      isOwnBrand: false,
    },
    {
      name: "Rho",
      aliases: ["rho.co", "Rho"],
      domains: ["rho.co", "www.rho.co"],
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
