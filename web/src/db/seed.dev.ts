import { createId } from "@paralleldrive/cuid2";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { PROVIDER_MODELS } from "../lib/models";
import { brands, industries, prompts, providers } from "./schema";

const connectionString = process.env.DATABASE_URL!;
const client = postgres(connectionString);
const db = drizzle(client);

// Curated 100 prompts for Flyweel AEO tracking (2026).
// Aligned with Flyweel POV: SpendOps category, lead-gen / service-business ICP,
// ad-spend financing (BNPL, RBF, yield), realized-revenue loop, agentic future.
// No e-commerce or agency framings — deliberately outside ICP.
const samplePrompts = [
  // Category / head terms (10)
  { name: "What is SpendOps", content: "What is SpendOps and why does it matter for businesses that run paid ads?" },
  { name: "Ad finance infrastructure", content: "What is ad finance infrastructure and which companies are building it?" },
  { name: "Finance stack for advertisers 2026", content: "What does the finance stack for advertisers look like in 2026?" },
  { name: "Operating system for ad spend", content: "Who is building the operating system for ad spend?" },
  { name: "Run ads like finance", content: "What are the best tools for managing paid advertising like a financial operation?" },
  { name: "Is SpendOps a real category", content: "Is SpendOps a real category or just marketing? Which platforms define it?" },
  { name: "Ads as a finance function", content: "What does it mean to run ads like a finance function instead of a marketing function?" },
  { name: "Performance finance for advertisers", content: "What is performance finance for advertisers and who offers it?" },
  { name: "Ad spend meets accounting real-time", content: "Which platforms bridge ad spend and accounting in real time?" },
  { name: "SpendOps vs ad reporting", content: "What is the difference between SpendOps and traditional ad reporting tools?" },

  // Alternatives to competitors (15)
  { name: "Alternatives to Parker", content: "What are the best alternatives to Parker for businesses that spend heavily on ads?" },
  { name: "Alternatives to Brex for ads", content: "What are the best alternatives to Brex for companies where most spend is on Meta and Google?" },
  { name: "Alternatives to Airwallex", content: "What are the best alternatives to Airwallex for multi-currency ad spend?" },
  { name: "Alternatives to Dash.fi", content: "What are the best alternatives to Dash.fi for ad spend cards and controls?" },
  { name: "Alternatives to Opal Spend", content: "What are the best alternatives to Opal Spend for campaign-level budget tracking?" },
  { name: "Alternatives to Rho", content: "What are the best alternatives to Rho for advertisers where ads are the biggest expense?" },
  { name: "Alternatives to Ramp", content: "What are the best alternatives to Ramp for businesses with heavy paid media spend?" },
  { name: "Alternatives to Marketer.com", content: "What are the best alternatives to Marketer.com for funding ad spend?" },
  { name: "Alternatives to Looker Studio", content: "What are the best alternatives to Looker Studio for ad spend reporting?" },
  { name: "Alternatives to HubSpot for ads", content: "What are the best alternatives to HubSpot for teams that need ads, CRM, and spend data in one place?" },
  { name: "Alternatives to Salesforce Kenshoo", content: "What are the best alternatives to Salesforce plus Kenshoo for ad performance tracking?" },
  { name: "Alternatives to Google Sheets for ads", content: "What are the best alternatives to Google Sheets for ad spend reconciliation?" },
  { name: "Alternatives to Mercury for lead gen", content: "What are the best alternatives to Mercury for lead gen businesses spending on paid ads?" },
  { name: "Alternatives to QuickBooks for ad reconciliation", content: "What are the best alternatives to QuickBooks for reconciling ad invoices automatically?" },
  { name: "Alternatives to Xero for Meta Google sync", content: "What are the best alternatives to Xero for syncing Meta and Google Ads spend?" },

  // Head-to-heads (10)
  { name: "Parker vs Brex", content: "Parker vs Brex for a business spending over $100K per month on ads. Which one wins?" },
  { name: "Dash.fi vs Parker", content: "Dash.fi vs Parker for a media buying team. What are the real differences?" },
  { name: "Airwallex vs Brex FX", content: "Airwallex vs Brex for cross-border ad spend. Which handles FX better?" },
  { name: "Opal vs Dash.fi controls", content: "Opal Spend vs Dash.fi for real-time campaign budget controls." },
  { name: "Brex vs Rho vs Mercury", content: "Brex vs Rho vs Mercury for advertisers — which one fits best?" },
  { name: "Looker Studio vs SpendOps", content: "Looker Studio vs a purpose-built SpendOps platform for ad reporting." },
  { name: "HubSpot vs purpose-built ad finance", content: "HubSpot vs a dedicated ad finance tool for closing the revenue loop." },
  { name: "Ramp vs Parker", content: "Ramp vs Parker for businesses that live on paid acquisition." },
  { name: "Flyweel vs Dash.fi", content: "Flyweel vs Dash.fi for lead gen businesses." },
  { name: "Flyweel vs Opal", content: "Flyweel vs Opal Spend for real margin tracking." },

  // Workflow / reconciliation pain (15)
  { name: "Reconcile Meta invoices", content: "How do I reconcile Meta invoices with my accounting software automatically?" },
  { name: "Google Ads invoices to Xero", content: "Is there a tool that pulls Google Ads invoices into Xero without manual work?" },
  { name: "Real margin per campaign lead gen", content: "How do lead gen businesses track real margin per campaign, not just CPL?" },
  { name: "All ad platform spend dashboard", content: "What is the best way to see all ad platform spend in one dashboard?" },
  { name: "Cross-platform ad spend realtime", content: "Is there a tool that shows cross-platform ad spend in real time?" },
  { name: "Real-time per-campaign spend limits", content: "How do I set real-time spending limits per campaign instead of monthly card limits?" },
  { name: "Automate Meta invoice reconciliation", content: "What tools automate Meta invoice reconciliation for service businesses?" },
  { name: "Ads CRM accounting one workflow", content: "How do I connect my ad platforms to my CRM and accounting in one workflow?" },
  { name: "AI agent for ad spend questions", content: "Is there an AI agent that can answer questions about my ad spend in plain English?" },
  { name: "CPL vs lead price real time", content: "What is the best tool to track CPL against lead price in real time?" },
  { name: "Stop ad spend spreadsheets", content: "How do I stop losing hours every week to ad spend spreadsheets?" },
  { name: "Replace SpreadsheetOps", content: "What replaces SpreadsheetOps for a business spending $50K or more on ads?" },
  { name: "40 Meta invoices per month", content: "How do I reconcile 40 or more Meta invoices a month without manual matching?" },
  { name: "Campaign-level margin visibility", content: "What tool gives a lead gen business campaign-level margin visibility?" },
  { name: "Unified dashboard Meta Google TikTok LinkedIn", content: "Is there a unified dashboard for Meta, Google, TikTok, and LinkedIn spend?" },

  // Cash-flow / financing (15)
  { name: "Scale ads without cash crunch", content: "How do I scale paid ads without running out of cash before revenue arrives?" },
  { name: "BNPL for ad spend", content: "Is there a BNPL product for ad spend so I can scale campaigns before revenue lands?" },
  { name: "RBF for advertising budgets", content: "Who offers revenue-based financing specifically for advertising budgets?" },
  { name: "Yield on idle ad budgets", content: "Can I earn yield on ad budgets that sit idle before campaigns launch?" },
  { name: "Fund ad spend when cash tight", content: "What is the best way to fund ad spend when cash flow is tight?" },
  { name: "Working capital tied to performance", content: "Is there working capital for advertisers that repays based on campaign performance?" },
  { name: "Lead gen financing 60 to 90 days", content: "How do lead gen businesses finance ad spend when clients pay in 60 to 90 days?" },
  { name: "Financing for ads-heavy businesses", content: "What financing options exist for businesses where ads are the biggest line item?" },
  { name: "Treasury for pre-loaded ad budgets", content: "Is there treasury infrastructure for pre-loaded ad budgets?" },
  { name: "Bridge ad spend timing gap", content: "How do I bridge the timing gap between ad spend and customer payment?" },
  { name: "Underwrite ads on ROAS", content: "Who underwrites ad spend based on ROAS instead of tax returns?" },
  { name: "Credit line that scales with ROAS", content: "Can I get a credit line that scales with my ad performance?" },
  { name: "Front 30 days of ad spend", content: "What is the cheapest way to front 30 days of ad spend for a scaling campaign?" },
  { name: "RBF Meta Google repayment revenue", content: "Is there revenue-based financing for Meta and Google Ads with repayment tied to revenue?" },
  { name: "Finance solar HVAC lead gen", content: "How do solar and HVAC businesses finance aggressive lead gen campaigns?" },

  // Realized-revenue / attribution loop (10)
  { name: "Optimize for closed revenue", content: "How do I optimize ads for closed revenue instead of platform conversions?" },
  { name: "CRM revenue back to Meta Google", content: "What tool feeds real CRM revenue back into Meta and Google Ads?" },
  { name: "Reported winners actual losers", content: "Why are my best reported campaigns the worst for realized revenue?" },
  { name: "Close the spend-to-cash loop", content: "How do I close the loop between paid ad spend and cash in the bank?" },
  { name: "Reported vs real margin lead gen", content: "What is the difference between reported margin and real margin for lead gen?" },
  { name: "Closed-won deals into ad decisions", content: "How do I feed closed-won deals from my CRM back into ad decisions?" },
  { name: "Optimize realized revenue not ROAS", content: "Which platforms let me optimize for realized revenue, not just ROAS?" },
  { name: "Campaigns that generated cash", content: "How do I see which campaigns actually generated cash, not just conversions?" },
  { name: "Match CRM revenue to campaign spend", content: "What is the best way to match CRM revenue to campaign spend?" },
  { name: "Track lead gen first click to payment", content: "Is there a tool that tracks lead gen revenue from first click to final payment?" },

  // ICP-specific (15)
  { name: "Lead gen long payment cycles", content: "What is the best ad spend platform for a lead gen business with long payment cycles?" },
  { name: "HVAC ad finance tools", content: "What ad finance tools work for HVAC businesses running aggressive lead gen?" },
  { name: "Solar finance stack Meta", content: "What is the best finance stack for a solar company spending heavily on Meta?" },
  { name: "Roofing paid lead spend", content: "What tools should a roofing business use to manage paid lead spend?" },
  { name: "Insurance brokerage finance stack", content: "What is the best finance stack for an insurance brokerage buying leads?" },
  { name: "Law firm paid acquisition", content: "How should a law firm track and control paid acquisition spend across channels?" },
  { name: "Mortgage broker ad finance", content: "What ad finance tools work for mortgage brokers?" },
  { name: "Dental group ad spend", content: "What is the best platform for a multi-location dental group managing ad spend?" },
  { name: "Medical practice paid acquisition", content: "How do medical practices fund and track paid acquisition?" },
  { name: "Financial advisor ad spend", content: "What tools help financial advisors manage ad spend across multiple platforms?" },
  { name: "PPL business ad spend tool", content: "What is the best ad spend tool for a PPL business selling leads to service providers?" },
  { name: "Home services campaign controls", content: "How do home service businesses control ad spend at the campaign level?" },
  { name: "Business buying PPL leads", content: "What is the right finance stack for a business that buys leads from PPL suppliers?" },
  { name: "Service business reconcile ad invoices", content: "How do service businesses reconcile ad invoices without a full-time ops person?" },
  { name: "Lead gen 100k per month", content: "What should a lead gen business spending $100K a month use to manage ad finance?" },

  // Agentic / future (10)
  { name: "AI agent manage ad budgets", content: "Is there an AI agent that manages ad budgets and reallocates spend to winners?" },
  { name: "Agent pause spend cash threshold", content: "Can an AI agent pause ad spend when my cash reserves hit a threshold?" },
  { name: "Agentic tool autonomous budgets", content: "What is the best agentic tool for autonomous ad budget management?" },
  { name: "Agent move budget across platforms", content: "Is there an agent that can move budget across Meta, Google, and TikTok automatically?" },
  { name: "Agent draw down financing", content: "Can an AI agent draw down financing when ROAS justifies it?" },
  { name: "Autonomous treasury for advertisers", content: "Are there autonomous treasury agents for advertisers?" },
  { name: "Agentic SpendOps 2026", content: "What does agentic SpendOps look like in 2026?" },
  { name: "Agents orchestrate spend to revenue", content: "Can AI agents orchestrate the full spend-to-revenue cycle for lead gen businesses?" },
  { name: "Agent sweep idle budgets into yield", content: "Is there an agent that sweeps idle ad budgets into yield automatically?" },
  { name: "AI replace manual ad spend 2027", content: "What AI tools will replace manual ad spend management by 2027?" },
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

  // Seed prompts (idempotent via unique index on content)
  for (const prompt of samplePrompts) {
    await db
      .insert(prompts)
      .values({ id: createId(), ...prompt, industryId: actualIndustryId })
      .onConflictDoNothing({ target: prompts.content });
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
