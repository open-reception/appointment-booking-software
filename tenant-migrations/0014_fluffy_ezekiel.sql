ALTER TABLE "appointment" ADD COLUMN "timezone" text NOT NULL DEFAULT 'UTC';
ALTER TABLE "appointment" ALTER COLUMN "timezone" DROP DEFAULT;