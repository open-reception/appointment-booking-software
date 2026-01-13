CREATE TYPE "public"."notification_type" AS ENUM('APPOINTMENT_CONFIRMED', 'APPOINTMENT_CANCELED');--> statement-breakpoint
ALTER TABLE "notification" ADD COLUMN "type" "notification_type" DEFAULT 'APPOINTMENT_CONFIRMED' NOT NULL;--> statement-breakpoint
ALTER TABLE "notification" ADD COLUMN "meta_data" json;--> statement-breakpoint
ALTER TABLE "notification" ADD COLUMN "created_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "notification" DROP COLUMN "title";--> statement-breakpoint
ALTER TABLE "notification" DROP COLUMN "description";