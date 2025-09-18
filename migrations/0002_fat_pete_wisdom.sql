CREATE TYPE "public"."setup_state" AS ENUM('NEW', 'SETTINGS_CREATED', 'AGENTS_SET_UP', 'FIRST_CHANNEL_CREATED');--> statement-breakpoint
CREATE TABLE "user_invite" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invite_code" uuid DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"role" "user_role" NOT NULL,
	"tenant_id" uuid NOT NULL,
	"invited_by" uuid NOT NULL,
	"language" text DEFAULT 'de' NOT NULL,
	"used" boolean DEFAULT false NOT NULL,
	"used_at" timestamp,
	"created_user_id" uuid,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"expires_at" timestamp NOT NULL,
	CONSTRAINT "user_invite_invite_code_unique" UNIQUE("invite_code")
);
--> statement-breakpoint
ALTER TABLE "user" ALTER COLUMN "role" SET DEFAULT 'STAFF';--> statement-breakpoint
ALTER TABLE "tenant" ADD COLUMN "setup_state" "setup_state" DEFAULT 'NEW' NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "language" text DEFAULT 'de' NOT NULL;--> statement-breakpoint
ALTER TABLE "user_invite" ADD CONSTRAINT "user_invite_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_invite" ADD CONSTRAINT "user_invite_invited_by_user_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_invite" ADD CONSTRAINT "user_invite_created_user_id_user_id_fk" FOREIGN KEY ("created_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "user_invite_code_idx" ON "user_invite" USING btree ("invite_code");--> statement-breakpoint
CREATE INDEX "user_invite_email_idx" ON "user_invite" USING btree ("email");--> statement-breakpoint
CREATE INDEX "user_invite_tenant_idx" ON "user_invite" USING btree ("tenant_id");