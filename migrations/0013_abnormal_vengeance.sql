ALTER TABLE "user_invite" ALTER COLUMN "tenant_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "user_invite" ALTER COLUMN "invited_by" DROP NOT NULL;