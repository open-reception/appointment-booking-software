ALTER TABLE "client_tunnel_staff_key_share" DROP CONSTRAINT "client_tun_staff_keyShare_tId_client_app_tId_fk";
--> statement-breakpoint
ALTER TABLE "notification" ALTER COLUMN "type" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "notification" ALTER COLUMN "type" SET DEFAULT 'APPOINTMENT_CONFIRMED'::text;--> statement-breakpoint
DROP TYPE "public"."notification_type";--> statement-breakpoint
CREATE TYPE "public"."notification_type" AS ENUM('APPOINTMENT_CONFIRMED', 'APPOINTMENT_CANCELLED');--> statement-breakpoint
ALTER TABLE "notification" ALTER COLUMN "type" SET DEFAULT 'APPOINTMENT_CONFIRMED'::"public"."notification_type";--> statement-breakpoint
ALTER TABLE "notification" ALTER COLUMN "type" SET DATA TYPE "public"."notification_type" USING "type"::"public"."notification_type";--> statement-breakpoint
ALTER TABLE "client_tunnel_staff_key_share" ADD CONSTRAINT "tunnel_staff_key_share_tid_appointment_tid_fk" FOREIGN KEY ("tunnel_id") REFERENCES "public"."client_appointment_tunnel"("id") ON DELETE no action ON UPDATE no action;