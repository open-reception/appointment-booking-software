CREATE TABLE "appointment_progress" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"state" text NOT NULL,
	"group" text DEFAULT 'UNKNOWN' NOT NULL,
	"icon" text DEFAULT 'UNKNOWN' NOT NULL,
	"names" json DEFAULT '{}'::json NOT NULL,
	"is_locked" boolean DEFAULT false,
	CONSTRAINT "appointment_progress_state_unique" UNIQUE("state")
);
--> statement-breakpoint
ALTER TABLE "appointment" ADD COLUMN "progress" text DEFAULT 'NOT_STARTED';--> statement-breakpoint
ALTER TABLE "channel" ADD COLUMN "deadlines" jsonb DEFAULT '{}'::jsonb NOT NULL;

INSERT INTO "appointment_progress" ("id", "state", "group", "icon", "names", "is_locked")
VALUES
('00000000-0000-0000-0000-000000000000', 'NOT_STARTED', 'NOT_STARTED', 'NOT_STARTED', '{"en": "Not here yet", "de": "Noch nicht da"}', true),
('00000000-0000-0000-0000-000000000001', 'WAITING', 'WAITING', 'WAITING', '{"en": "Waiting", "de": "Wartet"}', false),
('00000000-0000-0000-0000-000000000002', 'IN_PROGRESS', 'IN_PROGRESS', 'IN_PROGRESS', '{"en": "In Progress", "de": "Läuft"}', false),
('00000000-0000-0000-0000-000000000003', 'DONE', 'DONE', 'DONE', '{"en": "Done", "de": "Fertig"}', false);