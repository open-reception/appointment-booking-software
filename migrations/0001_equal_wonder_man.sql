ALTER TABLE "user" ADD COLUMN "passphrase_hash" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "recovery_passphrase" text;