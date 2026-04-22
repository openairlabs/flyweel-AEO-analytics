-- Add domains column to brands table for URL matching
ALTER TABLE "brands" ADD COLUMN "domains" text[];

-- Create brand_links table for tracking URLs in responses
CREATE TABLE IF NOT EXISTS "brand_links" (
	"id" text PRIMARY KEY NOT NULL,
	"analysis_id" text NOT NULL,
	"brand_id" text,
	"url" text NOT NULL,
	"link_text" text,
	"is_markdown_link" boolean DEFAULT false
);

-- Add foreign key constraints
ALTER TABLE "brand_links" ADD CONSTRAINT "brand_links_analysis_id_analyses_id_fk" FOREIGN KEY ("analysis_id") REFERENCES "public"."analyses"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "brand_links" ADD CONSTRAINT "brand_links_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE no action ON UPDATE no action;
