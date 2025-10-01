ALTER TABLE "tenant" 
ALTER COLUMN "description" 
SET DATA TYPE json 
USING CASE 
    WHEN description IS NULL THEN NULL
    WHEN description::text = '' THEN NULL
    ELSE description::json 
END;--> statement-breakpoint
ALTER TABLE "tenant" RENAME COLUMN "description" TO "descriptions";--> statement-breakpoint
ALTER TABLE "tenant" ADD COLUMN "languages" json NOT NULL;