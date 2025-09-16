CREATE TABLE "agent_absence" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" uuid NOT NULL,
	"start_date" timestamp NOT NULL,
	"end_date" timestamp NOT NULL,
	"absence_type" text DEFAULT '' NOT NULL,
	"description" text
);
--> statement-breakpoint
DROP TABLE "staff" CASCADE;--> statement-breakpoint
ALTER TABLE "agent" RENAME COLUMN "logo" TO "image";--> statement-breakpoint
ALTER TABLE "appointment" RENAME COLUMN "title" TO "name";--> statement-breakpoint
ALTER TABLE "appointment" RENAME COLUMN "description" TO "phone";--> statement-breakpoint
ALTER TABLE "channel" ADD COLUMN "names" json NOT NULL;--> statement-breakpoint
ALTER TABLE "channel" ADD COLUMN "paused" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "channel" ADD COLUMN "descriptions" json;--> statement-breakpoint
ALTER TABLE "channel" ADD COLUMN "languages" json NOT NULL;--> statement-breakpoint
ALTER TABLE "agent_absence" ADD CONSTRAINT "agent_absence_agent_id_agent_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agent"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel" DROP COLUMN "name";--> statement-breakpoint
ALTER TABLE "channel" DROP COLUMN "description";--> statement-breakpoint
ALTER TABLE "channel" DROP COLUMN "language";--> statement-breakpoint
ALTER TABLE "slotTemplate" DROP COLUMN "name";--> statement-breakpoint
DROP TYPE "public"."channel_type";