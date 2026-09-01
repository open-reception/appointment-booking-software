CREATE TABLE "cache_schedule" (
	"date" date NOT NULL,
	"channel" uuid NOT NULL,
	"timezone" text NOT NULL,
	"data" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "cache_schedule_date_timezone_channel_pk" PRIMARY KEY("date","timezone","channel")
);
--> statement-breakpoint
ALTER TABLE "appointment" ADD COLUMN "reminded_at" timestamp;--> statement-breakpoint
ALTER TABLE "cache_schedule" ADD CONSTRAINT "cache_schedule_channel_channel_id_fk" FOREIGN KEY ("channel") REFERENCES "public"."channel"("id") ON DELETE no action ON UPDATE no action;