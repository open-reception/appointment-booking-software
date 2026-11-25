ALTER TABLE "slotTemplate" ADD COLUMN "position" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
UPDATE "slotTemplate" AS st
SET "position" = ordered."position"
FROM (
  SELECT s."id", (ROW_NUMBER() OVER (PARTITION BY cst."channel_id" ORDER BY s."from", s."to", s."id") - 1)::integer AS "position"
  FROM "slotTemplate" s
  INNER JOIN "channel_slot_template" cst ON cst."slot_template_id" = s."id"
) AS ordered
WHERE st."id" = ordered."id";--> statement-breakpoint
DELETE FROM "cache_schedule";
