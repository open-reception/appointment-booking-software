ALTER TABLE "tenant" ALTER COLUMN "setup_state" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "tenant" ALTER COLUMN "setup_state" SET DEFAULT 'SETTINGS'::text;--> statement-breakpoint
DROP TYPE "public"."setup_state";--> statement-breakpoint
CREATE TYPE "public"."setup_state" AS ENUM('SETTINGS', 'AGENTS', 'CHANNELS', 'STAFF', 'READY');--> statement-breakpoint
ALTER TABLE "tenant" ALTER COLUMN "setup_state" SET DEFAULT 'SETTINGS'::"public"."setup_state";--> statement-breakpoint
ALTER TABLE "tenant" ALTER COLUMN "setup_state" SET DATA TYPE "public"."setup_state" USING "setup_state"::"public"."setup_state";