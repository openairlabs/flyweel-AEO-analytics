import { createId } from "@paralleldrive/cuid2";
import { relations } from "drizzle-orm";
import { boolean, integer, pgEnum, pgTable, text, timestamp, } from "drizzle-orm/pg-core";
// --- Enums ---
export const sentimentEnum = pgEnum("sentiment", [
    "positive",
    "negative",
    "neutral",
]);
// --- Core Tables ---
export const providers = pgTable("providers", {
    id: text("id")
        .primaryKey()
        .$defaultFn(() => createId()),
    name: text("name").notNull(), // openai, anthropic, google
    model: text("model").notNull().unique(), // gpt-5.2, claude-opus-4.5, etc.
    isActive: boolean("is_active").default(true),
    createdAt: timestamp("created_at").defaultNow(),
});
export const industries = pgTable("industries", {
    id: text("id")
        .primaryKey()
        .$defaultFn(() => createId()),
    name: text("name").notNull().unique(), // "Cloud PaaS", "CI/CD", etc.
    description: text("description"),
    isActive: boolean("is_active").default(true),
    createdAt: timestamp("created_at").defaultNow(),
});
export const brands = pgTable("brands", {
    id: text("id")
        .primaryKey()
        .$defaultFn(() => createId()),
    name: text("name").notNull(), // "Render", "Railway", "Vercel"
    aliases: text("aliases").array(), // ["render.com", "Render.com"]
    domains: text("domains").array(), // ["render.com", "docs.render.com"] for URL matching
    industryId: text("industry_id").references(() => industries.id),
    isOwnBrand: boolean("is_own_brand").default(false),
    isActive: boolean("is_active").default(true),
    createdAt: timestamp("created_at").defaultNow(),
});
export const prompts = pgTable("prompts", {
    id: text("id")
        .primaryKey()
        .$defaultFn(() => createId()),
    name: text("name").notNull(),
    content: text("content").notNull(),
    industryId: text("industry_id").references(() => industries.id),
    isActive: boolean("is_active").default(true),
    createdAt: timestamp("created_at").defaultNow(),
});
export const responses = pgTable("responses", {
    id: text("id")
        .primaryKey()
        .$defaultFn(() => createId()),
    promptId: text("prompt_id")
        .references(() => prompts.id)
        .notNull(),
    providerId: text("provider_id")
        .references(() => providers.id)
        .notNull(),
    content: text("content").notNull(),
    latencyMs: integer("latency_ms").notNull(),
    tokenCount: integer("token_count"),
    webSearchUsed: boolean("web_search_used").default(false),
    createdAt: timestamp("created_at").defaultNow(),
});
// --- Analysis Tables ---
export const analyses = pgTable("analyses", {
    id: text("id")
        .primaryKey()
        .$defaultFn(() => createId()),
    responseId: text("response_id")
        .references(() => responses.id)
        .notNull()
        .unique(),
    summary: text("summary"), // LLM-generated analysis summary
    createdAt: timestamp("created_at").defaultNow(),
});
export const brandMentions = pgTable("brand_mentions", {
    id: text("id")
        .primaryKey()
        .$defaultFn(() => createId()),
    analysisId: text("analysis_id")
        .references(() => analyses.id)
        .notNull(),
    brandId: text("brand_id")
        .references(() => brands.id)
        .notNull(),
    sentiment: sentimentEnum("sentiment").notNull(),
    ranking: integer("ranking"), // Position if ranked (1 = top)
    context: text("context"), // Excerpt where brand mentioned
});
export const brandLinks = pgTable("brand_links", {
    id: text("id")
        .primaryKey()
        .$defaultFn(() => createId()),
    analysisId: text("analysis_id")
        .references(() => analyses.id)
        .notNull(),
    brandId: text("brand_id").references(() => brands.id), // nullable - URL may not match any brand
    url: text("url").notNull(),
    linkText: text("link_text"), // Anchor text for markdown links
    isMarkdownLink: boolean("is_markdown_link").default(false),
});
export const digests = pgTable("digests", {
    id: text("id")
        .primaryKey()
        .$defaultFn(() => createId()),
    content: text("content").notNull(),
    createdAt: timestamp("created_at").defaultNow(),
});
// --- Relations ---
export const providersRelations = relations(providers, ({ many }) => ({
    responses: many(responses),
}));
export const industriesRelations = relations(industries, ({ many }) => ({
    brands: many(brands),
    prompts: many(prompts),
}));
export const brandsRelations = relations(brands, ({ one, many }) => ({
    industry: one(industries, {
        fields: [brands.industryId],
        references: [industries.id],
    }),
    mentions: many(brandMentions),
    links: many(brandLinks),
}));
export const promptsRelations = relations(prompts, ({ one, many }) => ({
    industry: one(industries, {
        fields: [prompts.industryId],
        references: [industries.id],
    }),
    responses: many(responses),
}));
export const responsesRelations = relations(responses, ({ one }) => ({
    prompt: one(prompts, {
        fields: [responses.promptId],
        references: [prompts.id],
    }),
    provider: one(providers, {
        fields: [responses.providerId],
        references: [providers.id],
    }),
    analysis: one(analyses),
}));
export const analysesRelations = relations(analyses, ({ one, many }) => ({
    response: one(responses, {
        fields: [analyses.responseId],
        references: [responses.id],
    }),
    mentions: many(brandMentions),
    links: many(brandLinks),
}));
export const brandMentionsRelations = relations(brandMentions, ({ one }) => ({
    analysis: one(analyses, {
        fields: [brandMentions.analysisId],
        references: [analyses.id],
    }),
    brand: one(brands, {
        fields: [brandMentions.brandId],
        references: [brands.id],
    }),
}));
export const brandLinksRelations = relations(brandLinks, ({ one }) => ({
    analysis: one(analyses, {
        fields: [brandLinks.analysisId],
        references: [analyses.id],
    }),
    brand: one(brands, {
        fields: [brandLinks.brandId],
        references: [brands.id],
    }),
}));
