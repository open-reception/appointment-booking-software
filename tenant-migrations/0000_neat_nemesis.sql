CREATE TYPE "public"."appointment_status" AS ENUM('NEW', 'CONFIRMED', 'HELD', 'REJECTED', 'NO_SHOW');--> statement-breakpoint
CREATE TYPE "public"."channel_type" AS ENUM('ROOM', 'MACHINE', 'PERSONNEL');--> statement-breakpoint
CREATE TABLE "agent" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"logo" "bytea"
);
--> statement-breakpoint
CREATE TABLE "appointment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"channel_id" uuid NOT NULL,
	"appointment_date" date NOT NULL,
	"expiry_date" date NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"status" "appointment_status" DEFAULT 'NEW' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "channel" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"color" text,
	"description" text,
	"language" text,
	"is_public" boolean,
	"requires_confirmation" boolean
);
--> statement-breakpoint
CREATE TABLE "channel_agent" (
	"channel_id" uuid NOT NULL,
	"agent_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "channel_slot_template" (
	"channel_id" uuid NOT NULL,
	"slot_template_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "client" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"hash_key" text NOT NULL,
	"public_key" text NOT NULL,
	"private_key_share" text NOT NULL,
	"email" text,
	"language" text,
	CONSTRAINT "client_hash_key_unique" UNIQUE("hash_key")
);
--> statement-breakpoint
CREATE TABLE "slotTemplate" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"weekdays" integer,
	"from" time NOT NULL,
	"to" time NOT NULL,
	"duration" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "staff" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"hash_key" text NOT NULL,
	"public_key" text NOT NULL,
	"name" text,
	"position" text,
	"email" text NOT NULL,
	"language" text,
	CONSTRAINT "staff_hash_key_unique" UNIQUE("hash_key")
);
--> statement-breakpoint
ALTER TABLE "appointment" ADD CONSTRAINT "appointment_client_id_client_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."client"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointment" ADD CONSTRAINT "appointment_channel_id_channel_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channel"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_agent" ADD CONSTRAINT "channel_agent_channel_id_channel_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channel"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_agent" ADD CONSTRAINT "channel_agent_agent_id_agent_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agent"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_slot_template" ADD CONSTRAINT "channel_slot_template_channel_id_channel_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channel"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_slot_template" ADD CONSTRAINT "channel_slot_template_slot_template_id_slotTemplate_id_fk" FOREIGN KEY ("slot_template_id") REFERENCES "public"."slotTemplate"("id") ON DELETE no action ON UPDATE no action;