ALTER TABLE "service_configs"
ADD COLUMN "routing_mode" VARCHAR(20) NOT NULL DEFAULT 'car';

UPDATE "service_configs"
SET "routing_mode" = 'scooter'
WHERE COALESCE("vehicle_category", '') ~* '(moto|motorcycle|scooter|bike)';

UPDATE "service_configs"
SET "routing_mode" = 'truck'
WHERE COALESCE("vehicle_category", '') ~* '(truck|caminh|van)';

ALTER TABLE "service_configs"
ADD CONSTRAINT "service_configs_routing_mode_check"
CHECK ("routing_mode" IN ('car', 'scooter', 'truck'));
