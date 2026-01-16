CREATE TABLE "appointment_key_share" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"appointment_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"encrypted_key" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth_challenge" (
	"id" text PRIMARY KEY NOT NULL,
	"challenge" text NOT NULL,
	"email_hash" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL,
	"consumed" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "client_appointment_tunnel" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email_hash" text NOT NULL,
	"client_public_key" text NOT NULL,
	"private_key_share" text NOT NULL,
	"client_key_share" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "client_appointment_tunnel_email_hash_unique" UNIQUE("email_hash")
);
--> statement-breakpoint
CREATE TABLE "client_tunnel_staff_key_share" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tunnel_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"encrypted_tunnel_key" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "staff_crypto" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"public_key" text NOT NULL,
	"private_key_share" text NOT NULL,
	"passkey_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
ALTER TABLE "appointment" DROP CONSTRAINT "appointment_client_id_client_id_fk";
--> statement-breakpoint
ALTER TABLE "agent" ALTER COLUMN "image" SET DATA TYPE varchar(250000);--> statement-breakpoint
ALTER TABLE "appointment" ALTER COLUMN "appointment_date" SET DATA TYPE timestamp;--> statement-breakpoint
ALTER TABLE "appointment" ALTER COLUMN "expiry_date" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "appointment" ALTER COLUMN "status" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "channel" ALTER COLUMN "descriptions" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "agent" ADD COLUMN "descriptions" json NOT NULL;--> statement-breakpoint
ALTER TABLE "appointment" ADD COLUMN "tunnel_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "appointment" ADD COLUMN "encrypted_data" text;--> statement-breakpoint
ALTER TABLE "appointment" ADD COLUMN "data_key" text;--> statement-breakpoint
ALTER TABLE "appointment" ADD COLUMN "encrypted_payload" text;--> statement-breakpoint
ALTER TABLE "appointment" ADD COLUMN "iv" text;--> statement-breakpoint
ALTER TABLE "appointment" ADD COLUMN "auth_tag" text;--> statement-breakpoint
ALTER TABLE "appointment" ADD COLUMN "created_at" timestamp DEFAULT now();--> statement-breakpoint
ALTER TABLE "appointment" ADD COLUMN "updated_at" timestamp DEFAULT now();--> statement-breakpoint
ALTER TABLE "appointment_key_share" ADD CONSTRAINT "appointment_key_share_appointment_id_appointment_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointment"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_tunnel_staff_key_share" ADD CONSTRAINT "client_tun_staff_keyShare_tId_client_app_tId_fk" FOREIGN KEY ("tunnel_id") REFERENCES "public"."client_appointment_tunnel"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointment" ADD CONSTRAINT "appointment_tunnel_id_client_appointment_tunnel_id_fk" FOREIGN KEY ("tunnel_id") REFERENCES "public"."client_appointment_tunnel"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent" DROP COLUMN "description";--> statement-breakpoint
ALTER TABLE "appointment" DROP COLUMN "client_id";--> statement-breakpoint
ALTER TABLE "appointment" DROP COLUMN "name";--> statement-breakpoint
ALTER TABLE "appointment" DROP COLUMN "phone";--> statement-breakpoint
ALTER TABLE "channel" DROP COLUMN "languages";