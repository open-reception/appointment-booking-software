DROP INDEX "staff_crypto_ua_idx";--> statement-breakpoint
ALTER TABLE "client_tunnel_staff_key_share" ADD COLUMN "passkey_id" text;--> statement-breakpoint
UPDATE "client_tunnel_staff_key_share" AS ks
SET "passkey_id" = latest."passkey_id"
FROM (
  SELECT DISTINCT ON ("user_id") "user_id", "passkey_id"
  FROM "staff_crypto"
  ORDER BY "user_id", "created_at" DESC
) AS latest
WHERE latest."user_id" = ks."user_id" AND ks."passkey_id" IS NULL;--> statement-breakpoint
DELETE FROM "client_tunnel_staff_key_share" WHERE "passkey_id" IS NULL;--> statement-breakpoint
ALTER TABLE "client_tunnel_staff_key_share" ALTER COLUMN "passkey_id" SET NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "staff_crypto_up_idx" ON "staff_crypto" USING btree ("user_id","passkey_id");
