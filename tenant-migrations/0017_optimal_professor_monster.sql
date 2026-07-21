CREATE TYPE "public"."absence_type" AS ENUM('ONE_TIME', 'RECURRING');--> statement-breakpoint
ALTER TABLE "agent_absence" ADD COLUMN "type" "absence_type" DEFAULT 'ONE_TIME' NOT NULL;--> statement-breakpoint
ALTER TABLE "agent_absence" ADD COLUMN "weekdays" integer;--> statement-breakpoint
ALTER TABLE "agent_absence" ADD COLUMN "from" time;--> statement-breakpoint
ALTER TABLE "agent_absence" ADD COLUMN "to" time;

-- Migrate existing absences
UPDATE "agent_absence" SET "type" = 'ONE_TIME';