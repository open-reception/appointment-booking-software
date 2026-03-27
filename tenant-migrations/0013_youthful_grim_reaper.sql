CREATE TABLE "booking_access_token" (
	"id" text PRIMARY KEY NOT NULL,
	"scope" text NOT NULL,
	"tenant_id" uuid NOT NULL,
	"email_hash" text,
	"tunnel_id" uuid NOT NULL,
	"client_public_key" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL,
	"consumed" boolean DEFAULT false NOT NULL
);
