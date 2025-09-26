ALTER TABLE "agent" ALTER COLUMN "description" SET DATA TYPE json;--> statement-breakpoint
ALTER TABLE "agent" ADD COLUMN "languages" json NOT NULL;