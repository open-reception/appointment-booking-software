ALTER TABLE "challenge_throttle" DROP CONSTRAINT "challenge_throttle_tenant_id_tenant_id_fk";
--> statement-breakpoint
ALTER TABLE "tenant" ADD COLUMN "features" json NOT NULL DEFAULT '[]';--> statement-breakpoint
ALTER TABLE "challenge_throttle" DROP COLUMN "tenant_id";