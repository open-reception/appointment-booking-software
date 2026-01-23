ALTER TABLE "tenant" ADD COLUMN "domain" text;--> statement-breakpoint
UPDATE "tenant" SET "domain" = CONCAT("short_name", '.open-reception.example.com');
ALTER TABLE "tenant" ALTER COLUMN "domain" SET NOT NULL;
ALTER TABLE "tenant" ADD CONSTRAINT "tenant_domain_unique" UNIQUE("domain");