ALTER TABLE "tenant" ADD COLUMN "defaultLanguage" text DEFAULT 'en' NOT NULL;--> statement-breakpoint
ALTER TABLE "tenant" ADD COLUMN "links" json DEFAULT '{}'::json NOT NULL;