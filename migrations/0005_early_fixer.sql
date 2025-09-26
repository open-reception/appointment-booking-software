ALTER TABLE "tenant" ADD COLUMN "languages" json NOT NULL;
ALTER TABLE "tenant" RENAME COLUMN "description" TO "descriptions";