ALTER TABLE "agent" ADD COLUMN "archived" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "channel" ADD COLUMN "archived" boolean DEFAULT false NOT NULL;