CREATE TYPE "public"."confirmation_state" AS ENUM('INVITED', 'CONFIRMED', 'ACCESS_GRANTED');--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "confirmation_state" "confirmation_state" DEFAULT 'INVITED';--> statement-breakpoint
ALTER TABLE "user" DROP COLUMN "confirmed";