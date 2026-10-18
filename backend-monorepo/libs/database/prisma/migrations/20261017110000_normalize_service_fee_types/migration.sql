-- Keep legacy service rows compatible with the canonical API vocabulary.
UPDATE "service_configs"
SET "platform_fee_type" = 'percentage'
WHERE LOWER(COALESCE("platform_fee_type", '')) IN ('percent', 'percentage');

ALTER TABLE "service_configs"
  ADD CONSTRAINT "service_configs_platform_fee_type_check"
  CHECK ("platform_fee_type" IS NULL OR "platform_fee_type" IN ('percentage', 'fixed'));
