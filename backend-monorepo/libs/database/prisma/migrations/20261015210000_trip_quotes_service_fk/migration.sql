-- Retain historical quotes even when their service row was already removed.
-- Such quotes cannot be consumed into a trip and have no live service relation.
UPDATE "trip_quotes" AS quote
SET "service_config_id" = NULL
WHERE quote."service_config_id" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM "service_configs" AS service
    WHERE service."id" = quote."service_config_id"
  );

ALTER TABLE "trip_quotes"
  ALTER COLUMN "service_config_id" DROP NOT NULL;

ALTER TABLE "trip_quotes"
  ADD CONSTRAINT "trip_quotes_service_config_id_fkey"
  FOREIGN KEY ("service_config_id")
  REFERENCES "service_configs"("id")
  ON DELETE SET NULL
  ON UPDATE NO ACTION;
