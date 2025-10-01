ALTER TABLE "agent" RENAME COLUMN "description" TO "descriptions";--> statement-breakpoint
ALTER TABLE "channel" ALTER COLUMN "descriptions" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "channel" DROP COLUMN "languages";